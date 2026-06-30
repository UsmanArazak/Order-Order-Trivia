import React, { useState, useEffect, useRef } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import type { Question, Room, Player, Answer } from '../types';
import { ArrowLeft, Play, Award, CheckCircle, ChevronRight, Users, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HostViewProps {
  onBack: () => void;
}

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'mock-1',
    question_text: 'Which historical monument in Daura is associated with the slaying of the legendary snake Sarki?',
    options: ['Kusugu Well', 'Emir’s Palace', 'Gezo Well', 'Kogi Gate'],
    correct_index: 0
  },
  {
    id: 'mock-2',
    question_text: 'In parliamentary terminology, what refers to the minimum number of members required to conduct business?',
    options: ['Forum', 'Quorum', 'Division', 'Conclave'],
    correct_index: 1
  },
  {
    id: 'mock-3',
    question_text: 'Who is widely regarded as the first female monarch of the Daura Kingdom?',
    options: ['Queen Amina', 'Queen Daurama', 'Kufuru', 'Queen Zaria'],
    correct_index: 1
  },
  {
    id: 'mock-4',
    question_text: 'What is the designation given to a legislative proposal before it is passed into a law or act?',
    options: ['Motion', 'Statute', 'Bill', 'Resolution'],
    correct_index: 2
  }
];

export const HostView: React.FC<HostViewProps> = ({ onBack }) => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timer, setTimer] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const countdownIntervalRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  // Load questions on mount
  useEffect(() => {
    fetchQuestions();
    return () => {
      cleanupRealtime();
    };
  }, []);

  // Sandbox Mode: Player joins simulation
  useEffect(() => {
    if (!hasSupabaseConfig && room && room.game_status === 'lobby') {
      const timers = [
        setTimeout(() => {
          setPlayers(prev => [...prev, { id: 'p1', name: 'Hon. Yusuf', room_code: 'DEMO', score: 0, previous_score: 0 }]);
        }, 1500),
        setTimeout(() => {
          setPlayers(prev => [...prev, { id: 'p2', name: 'Hon. Amina', room_code: 'DEMO', score: 0, previous_score: 0 }]);
        }, 3500),
        setTimeout(() => {
          setPlayers(prev => [...prev, { id: 'p3', name: 'Hon. Ibrahim', room_code: 'DEMO', score: 0, previous_score: 0 }]);
        }, 5000),
        setTimeout(() => {
          setPlayers(prev => [...prev, { id: 'p4', name: 'Hon. Fatima', room_code: 'DEMO', score: 0, previous_score: 0 }]);
        }, 6500)
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [room?.game_status]);

  // Sandbox Mode: Answer submissions simulation
  useEffect(() => {
    if (!hasSupabaseConfig && room && room.game_status === 'question' && currentQuestion) {
      const mockSubmissions = [
        { pid: 'p1', opt: 0, delay: 2500 },
        { pid: 'p2', opt: currentQuestion.correct_index, delay: 4200 },
        { pid: 'p3', opt: currentQuestion.correct_index, delay: 6800 },
        { pid: 'p4', opt: (currentQuestion.correct_index + 1) % 4, delay: 9100 }
      ];

      const timers = mockSubmissions.map(sub => 
        setTimeout(() => {
          setAnswers(prev => {
            if (prev.some(a => a.player_id === sub.pid)) return prev;
            return [...prev, {
              id: `ans-${sub.pid}-${currentQuestion.id}`,
              player_id: sub.pid,
              room_code: 'DEMO',
              question_id: currentQuestion.id,
              selected_option: sub.opt,
              response_time: sub.delay / 1000,
              points: 0
            }];
          });
        }, sub.delay)
      );

      return () => timers.forEach(clearTimeout);
    }
  }, [room?.game_status, currentQuestion?.id]);

  // Realtime Fallback Polling
  useEffect(() => {
    if (!hasSupabaseConfig || !roomCode) return;
    
    let interval: any = null;
    
    if (room?.game_status === 'lobby') {
      // Poll players list in lobby every 2 seconds
      interval = setInterval(() => {
        fetchPlayers(roomCode);
      }, 2000);
    } else if (room?.game_status === 'question') {
      // Poll answers count in question phase every 2 seconds
      interval = setInterval(() => {
        fetchAnswers(roomCode);
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [room?.game_status, roomCode]);

  const fetchQuestions = async () => {
    setLoading(true);
    if (!hasSupabaseConfig) {
      const local = localStorage.getItem('order_trivia_mock_questions');
      if (local) {
        setQuestions(JSON.parse(local));
      } else {
        setQuestions(MOCK_QUESTIONS);
      }
      setLoading(false);
      return;
    }

    try {
      const { data, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: true });
      if (qErr) throw qErr;
      setQuestions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  const cleanupRealtime = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (channelRef.current && hasSupabaseConfig) {
      supabase.removeChannel(channelRef.current);
    }
  };

  // Generate Room Code and Start Lobby
  const createRoom = async () => {
    if (questions.length === 0) {
      setError('Please add questions in the Admin panel before hosting a game!');
      return;
    }

    setLoading(true);
    setError('');

    if (!hasSupabaseConfig) {
      setRoomCode('DEMO');
      setRoom({
        code: 'DEMO',
        current_question_index: 0,
        game_status: 'lobby',
        question_started_at: null
      });
      setPlayers([]);
      setAnswers([]);
      setLoading(false);
      return;
    }

    // Generate random 4-letter code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      // Insert room
      const { error: roomErr } = await supabase.from('rooms').insert([
        {
          code,
          current_question_index: 0,
          game_status: 'lobby',
          question_started_at: null,
        },
      ]);
      if (roomErr) throw roomErr;

      setRoomCode(code);
      setRoom({
        code,
        current_question_index: 0,
        game_status: 'lobby',
        question_started_at: null,
      });

      setupRealtimeSubscriptions(code);
    } catch (err: any) {
      setError(err.message || 'Error creating game room');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to Players and Answers, and create Broadcast channel
  const setupRealtimeSubscriptions = (code: string) => {
    cleanupRealtime();

    // 1. Setup Broadcast channel for low-latency timer synchronization
    const channel = supabase.channel(`room_${code}`, {
      config: {
        broadcast: { self: true },
      },
    });

    channel
      .on('broadcast', { event: 'player_ping' }, ({ payload }: { payload: any }) => {
        console.log('Player ping:', payload);
      })
      .subscribe((status: any) => {
        console.log(`Supabase Broadcast channel room_${code} status:`, status);
      });

    channelRef.current = channel;

    // 2. Setup database change listeners using supabase.channel
    const dbChangesChannel = supabase.channel(`db-changes-${code}`);

    dbChangesChannel
      // Listen for player joins/leaves
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${code}`,
        },
        () => {
          fetchPlayers(code);
        }
      )
      // Listen for answers
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers',
          filter: `room_code=eq.${code}`,
        },
        (payload: any) => {
          const newAnswer = payload.new as Answer;
          setAnswers((prev) => {
            // Avoid duplicates
            if (prev.some((a) => a.id === newAnswer.id)) return prev;
            return [...prev, newAnswer];
          });
        }
      )
      .subscribe();

    // Initial fetches
    fetchPlayers(code);
    fetchAnswers(code);
  };

  const fetchPlayers = async (code: string) => {
    if (!hasSupabaseConfig) return;
    const { data, error: pErr } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', code);
    if (!pErr && data) {
      setPlayers(data);
    }
  };

  const fetchAnswers = async (code: string) => {
    if (!hasSupabaseConfig) return;
    const { data, error: aErr } = await supabase
      .from('answers')
      .select('*')
      .eq('room_code', code);
    if (!aErr && data) {
      setAnswers(data);
    }
  };

  // ----------------------------------------------------
  // STATE MACHINE TRANSITIONS
  // ----------------------------------------------------

  // 1. Start the game (first question)
  const startGame = async () => {
    if (players.length === 0) {
      setError('Wait for at least one player to join!');
      return;
    }
    await loadQuestion(0);
  };

  // Load a question and transition to 'question'
  const loadQuestion = async (index: number) => {
    if (!roomCode || index >= questions.length) return;

    setError('');
    const question = questions[index];
    setCurrentQuestion(question);
    setAnswers([]); // clear answers for new question
    setTimer(20);

    const startedAt = new Date().toISOString();

    if (!hasSupabaseConfig) {
      setRoom({
        code: 'DEMO',
        current_question_index: index,
        game_status: 'question',
        question_started_at: startedAt
      });

      // Start host-side countdown timer
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            revealAnswer(); // Auto reveal when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    try {
      // First update the database room state
      const { error: roomErr } = await supabase
        .from('rooms')
        .update({
          current_question_index: index,
          game_status: 'question',
          question_started_at: startedAt,
        })
        .eq('code', roomCode);

      if (roomErr) throw roomErr;

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              current_question_index: index,
              game_status: 'question',
              question_started_at: startedAt,
            }
          : null
      );

      // Secondly, broadcast "question started" message to all connected phones immediately
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'question_started',
          payload: {
            questionIndex: index,
            questionId: question.id,
            startedAt,
            duration: 20,
          },
        });
      }

      // Start host-side countdown timer
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            revealAnswer(); // Auto reveal when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error starting question');
    }
  };

  // 2. Reveal answer and calculate scoring
  const revealAnswer = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (!roomCode || !currentQuestion || !room) return;

    setLoading(true);

    if (!hasSupabaseConfig) {
      // Mock Score Calculation
      setPlayers(prevPlayers => {
        return prevPlayers.map(player => {
          const playerAnswer = answers.find(a => a.player_id === player.id);
          let pointsEarned = 0;

          if (playerAnswer && playerAnswer.selected_option === currentQuestion.correct_index) {
            const respTime = Math.min(20, Math.max(0, playerAnswer.response_time));
            pointsEarned = Math.max(500, Math.round(1000 * (1 - (respTime / 20) * 0.5)));
          }

          if (playerAnswer) {
            playerAnswer.points = pointsEarned;
          }

          return {
            ...player,
            previous_score: player.score,
            score: player.score + pointsEarned
          };
        });
      });

      setRoom(prev => prev ? { ...prev, game_status: 'reveal' } : null);
      setLoading(false);
      return;
    }

    try {
      // Fetch fresh answers from DB to make sure we have everyone
      const { data: dbAnswers, error: ansErr } = await supabase
        .from('answers')
        .select('*')
        .eq('room_code', roomCode)
        .eq('question_id', currentQuestion.id);

      if (ansErr) throw ansErr;

      const currentAnswers = dbAnswers || [];
      setAnswers(currentAnswers);

      // Fetch fresh players list
      const { data: dbPlayers, error: playErr } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode);

      if (playErr) throw playErr;
      const currentPlayers = dbPlayers || [];

      // Calculate score differences
      const updates = currentPlayers.map(async (player: Player) => {
        const playerAnswer = currentAnswers.find((a: Answer) => a.player_id === player.id);
        let pointsEarned = 0;

        if (playerAnswer && playerAnswer.selected_option === currentQuestion.correct_index) {
          // Speed calculation
          const respTime = Math.min(20, Math.max(0, playerAnswer.response_time));
          pointsEarned = Math.max(500, Math.round(1000 * (1 - (respTime / 20) * 0.5)));
        }

        const newScore = player.score + pointsEarned;

        // Update player in database (set previous_score to current score, score to newScore)
        const { error: pUpErr } = await supabase
          .from('players')
          .update({
            previous_score: player.score,
            score: newScore,
          })
          .eq('id', player.id);

        if (pUpErr) throw pUpErr;

        // Update answer in database with points earned, if they submitted one
        if (playerAnswer) {
          await supabase
            .from('answers')
            .update({ points: pointsEarned })
            .eq('id', playerAnswer.id);
        }
      });

      await Promise.all(updates);

      // Fetch players again to update host view state
      await fetchPlayers(roomCode);

      // Transition Room status to 'reveal'
      const { error: roomErr } = await supabase
        .from('rooms')
        .update({ game_status: 'reveal' })
        .eq('code', roomCode);

      if (roomErr) throw roomErr;

      setRoom((prev) => (prev ? { ...prev, game_status: 'reveal' } : null));
    } catch (err: any) {
      setError(err.message || 'Error computing scores');
    } finally {
      setLoading(false);
    }
  };

  // 3. Show Leaderboard
  const showLeaderboard = async () => {
    if (!roomCode) return;
    setLoading(true);

    if (!hasSupabaseConfig) {
      setRoom(prev => prev ? { ...prev, game_status: 'leaderboard' } : null);
      setLoading(false);
      return;
    }

    try {
      const { error: roomErr } = await supabase
        .from('rooms')
        .update({ game_status: 'leaderboard' })
        .eq('code', roomCode);

      if (roomErr) throw roomErr;

      setRoom((prev) => (prev ? { ...prev, game_status: 'leaderboard' } : null));
    } catch (err: any) {
      setError(err.message || 'Error transitioning to leaderboard');
    } finally {
      setLoading(false);
    }
  };

  // 4. Proceed to next question or finish
  const handleNext = async () => {
    if (!room) return;
    const nextIdx = room.current_question_index + 1;
    if (nextIdx < questions.length) {
      await loadQuestion(nextIdx);
    } else {
      // Transition to Finished
      setLoading(true);

      if (!hasSupabaseConfig) {
        setRoom(prev => prev ? { ...prev, game_status: 'finished' } : null);
        setLoading(false);
        return;
      }

      try {
        const { error: roomErr } = await supabase
          .from('rooms')
          .update({ game_status: 'finished' })
          .eq('code', roomCode);

        if (roomErr) throw roomErr;

        setRoom((prev) => (prev ? { ...prev, game_status: 'finished' } : null));
      } catch (err: any) {
        setError(err.message || 'Error finishing game');
      } finally {
        setLoading(false);
      }
    }
  };

  // 5. Delete Room / End Game
  const endGame = async () => {
    if (!roomCode) return;
    if (!window.confirm('Are you sure you want to end this game? All player progress will be cleared.')) return;

    setLoading(true);

    if (!hasSupabaseConfig) {
      cleanupRealtime();
      setRoom(null);
      setRoomCode('');
      setPlayers([]);
      setAnswers([]);
      setLoading(false);
      return;
    }

    try {
      const { error: roomErr } = await supabase
        .from('rooms')
        .delete()
        .eq('code', roomCode);

      if (roomErr) throw roomErr;

      cleanupRealtime();
      setRoom(null);
      setRoomCode('');
      setPlayers([]);
      setAnswers([]);
    } catch (err: any) {
      setError(err.message || 'Error deleting room');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // HELPER CALCULATIONS
  // ----------------------------------------------------

  // Answers options distribution for the reveal screen
  const getAnswersDistribution = () => {
    const counts = [0, 0, 0, 0];
    answers.forEach((ans) => {
      if (ans.selected_option >= 0 && ans.selected_option < 4) {
        counts[ans.selected_option]++;
      }
    });
    return counts;
  };

  // Rank players for Leaderboard (including rank change indicators)
  const getRankedPlayers = () => {
    const currentSorted = [...players].sort((a, b) => b.score - a.score);
    const previousSorted = [...players].sort((a, b) => b.previous_score - a.previous_score);

    return currentSorted.map((player, idx) => {
      const currentRank = idx + 1;
      const prevIdx = previousSorted.findIndex((p) => p.id === player.id);
      const prevRank = prevIdx === -1 ? currentRank : prevIdx + 1;
      const change = prevRank - currentRank;

      return {
        ...player,
        rank: currentRank,
        change,
      };
    });
  };

  // ----------------------------------------------------
  // RENDER SCREENS
  // ----------------------------------------------------

  if (!room) {
    return (
      <div className="player-layout">
        <div className="join-card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span className="tagline">Daura LGA Students Parliamentary Club</span>
            <h2 style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Host Trivia Game</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Project the questions onto a screen while students join on their phones.
            </p>
          </div>
          {error && (
            <p style={{ color: 'var(--color-red)', marginBottom: '1rem', fontWeight: 600 }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button className="btn btn-gold" onClick={createRoom} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Loading...' : 'Create Game Lobby'}
            </button>
            <button className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1. Lobby Screen
  if (room.game_status === 'lobby') {
    return (
      <div className="host-layout container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="tagline">Parliamentary Club Trivia {!hasSupabaseConfig && '• Sandbox Mode'}</span>
            <h2>Game Lobby</h2>
          </div>
          <button className="btn btn-secondary" onClick={endGame}>
            Cancel Game
          </button>
        </div>

        <div className="lobby-grid">
          <div className="lobby-sidebar">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ROOM CODE</h3>
            <div className="room-code-display">{roomCode}</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {!hasSupabaseConfig 
                ? 'Sandbox Mode: 4 simulated members will join automatically in a moment.'
                : 'Go to the app and enter this code to join the session.'}
            </p>
            <button className="btn btn-gold" onClick={startGame} disabled={players.length === 0} style={{ width: '100%' }}>
              <Play size={18} /> Start Game
            </button>
          </div>

          <div className="lobby-main">
            <div className="lobby-players-title">
              <h3>Members in Chambers</h3>
              <span className="player-bubble" style={{ fontSize: '1rem', padding: '0.4rem 0.8rem', borderRadius: '4px', backgroundColor: 'var(--bg-card)' }}>
                <Users size={16} /> {players.length} Joined
              </span>
            </div>

            {players.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>
                <div className="loading-spinner"></div>
                <p style={{ fontWeight: 600 }}>Waiting for Parliamentarians to connect...</p>
              </div>
            ) : (
              <div className="player-bubble-grid">
                {players.map((player) => (
                  <div key={player.id} className="player-bubble">
                    {player.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Question Active Screen
  if (room.game_status === 'question' && currentQuestion) {
    const answeredCount = answers.length;
    const totalCount = players.length;

    return (
      <div className="host-layout container">
        <div className="question-header">
          <span className="tagline" style={{ color: 'var(--gold-dark)' }}>
            Question {room.current_question_index + 1} of {questions.length}
          </span>
          <h1 className="question-text">{currentQuestion.question_text}</h1>
        </div>

        <div className="question-middle-section">
          {/* Timer */}
          <div>
            <div className={`host-timer-circle ${timer <= 5 ? 'warning' : ''}`}>
              {timer}
              <span className="host-timer-label">seconds</span>
            </div>
          </div>

          {/* Visual Box */}
          <div className="question-visual-box">
            <Clock size={64} style={{ animation: 'spin 4s linear infinite', opacity: 0.1 }} />
            <span style={{ position: 'absolute', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Debate in Progress...
            </span>
          </div>

          {/* Answers Counter */}
          <div className="answers-count-box">
            <div className="answers-count-number">
              {answeredCount} / {totalCount}
            </div>
            <div className="answers-count-label">Answers Logged</div>
          </div>
        </div>

        {/* Options grid (displayed for reference, no correct answer marked yet) */}
        <div className="options-grid" style={{ marginBottom: '1.5rem' }}>
          {currentQuestion.options.map((option, idx) => (
            <div key={idx} className={`option-card option-${idx}`}>
              <span className="option-shape" style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '1rem' }}>
                {['A', 'B', 'C', 'D'][idx]}
              </span>
              {option}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={endGame}>
            End Game
          </button>
          <button className="btn btn-gold" onClick={revealAnswer} disabled={loading}>
            <CheckCircle size={18} /> Skip Timer & Reveal Answer
          </button>
        </div>
      </div>
    );
  }

  // 3. Question Reveal Screen
  if (room.game_status === 'reveal' && currentQuestion) {
    const dist = getAnswersDistribution();
    const maxVal = Math.max(...dist, 1);

    return (
      <div className="host-layout container">
        <div className="question-header">
          <span className="tagline">Question {room.current_question_index + 1} • Answer Distribution</span>
          <h1 className="question-text">{currentQuestion.question_text}</h1>
        </div>

        {/* Answer Bar Chart */}
        <div className="chart-container">
          {dist.map((count, idx) => {
            const pct = (count / maxVal) * 80 + 10;
            const isCorrect = idx === currentQuestion.correct_index;
            return (
              <div key={idx} className="chart-bar-wrapper">
                <div
                  className={`chart-bar bar-${idx}`}
                  style={{
                    height: `${pct}%`,
                    border: isCorrect ? '4px solid var(--primary-dark)' : 'none',
                  }}
                >
                  {count}
                </div>
                <div className="chart-label">
                  <span className="option-shape" style={{ width: '32px', height: '32px', fontSize: '1rem', backgroundColor: isCorrect ? 'var(--primary)' : 'rgba(0,0,0,0.05)', color: isCorrect ? '#fff' : 'var(--text-secondary)', borderRadius: '50%', fontWeight: 800, display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                    {isCorrect ? '✓' : ['A', 'B', 'C', 'D'][idx]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Options grid showing the correct answer highlighted */}
        <div className="options-grid" style={{ marginBottom: '1.5rem' }}>
          {currentQuestion.options.map((option, idx) => {
            const isCorrect = idx === currentQuestion.correct_index;
            return (
              <div
                key={idx}
                className={`option-card option-${idx} ${isCorrect ? 'correct-answer-card' : 'dimmed'}`}
              >
                <span className="option-shape" style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '1rem' }}>
                  {['A', 'B', 'C', 'D'][idx]}
                </span>
                {option}
                {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.85rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 700 }}>CORRECT MOTION</span>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-secondary" onClick={endGame}>
            End Game
          </button>
          <button className="btn btn-gold" onClick={showLeaderboard} disabled={loading}>
            Show Leaderboard <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // 4. Leaderboard Screen
  if (room.game_status === 'leaderboard') {
    const ranked = getRankedPlayers();
    const isLastQuestion = room.current_question_index + 1 >= questions.length;

    return (
      <div className="host-layout container">
        <div className="leaderboard-container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Award size={48} style={{ color: 'var(--gold)', marginBottom: '0.5rem' }} />
            <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leaderboard Standings</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Current standing in Chambers after Question {room.current_question_index + 1}
            </p>
          </div>

          <div className="leaderboard-list">
            {ranked.slice(0, 5).map((player) => (
              <div key={player.id} className={`leaderboard-item rank-${player.rank}`}>
                <span className="leaderboard-rank">#{player.rank}</span>
                <span className="leaderboard-name">{player.name}</span>
                <span className="leaderboard-score">{player.score} pts</span>
                <span className={`leaderboard-change ${player.change > 0 ? 'up' : player.change < 0 ? 'down' : ''}`}>
                  {player.change > 0 ? `▲ ${player.change}` : player.change < 0 ? `▼ ${Math.abs(player.change)}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
            <button className="btn btn-secondary" onClick={endGame}>
              End Game
            </button>
            <button className="btn btn-gold" onClick={handleNext} disabled={loading}>
              {isLastQuestion ? 'Show Podium' : 'Next Question'} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Final Podium Screen
  if (room.game_status === 'finished') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];

    // Trigger confetti on render
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }, 200);

    return (
      <div className="host-layout container">
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span className="tagline">Quiz Completed</span>
          <h1 style={{ color: 'var(--primary-dark)' }}>The Parliamentary Podium</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Congratulations to our top legislators of the day!
          </p>
        </div>

        <div className="podium-layout">
          {/* 2nd Place */}
          {p2 ? (
            <div className="podium-place second">
              <div className="podium-avatar">🥈</div>
              <div className="podium-name">{p2.name}</div>
              <div className="podium-score">{p2.score} pts</div>
              <div className="podium-pillar">2</div>
            </div>
          ) : (
            <div style={{ width: '30%' }}></div>
          )}

          {/* 1st Place */}
          {p1 ? (
            <div className="podium-place first">
              <div className="podium-avatar">👑</div>
              <div className="podium-name">{p1.name}</div>
              <div className="podium-score">{p1.score} pts</div>
              <div className="podium-pillar">1</div>
            </div>
          ) : (
            <div style={{ width: '30%' }}></div>
          )}

          {/* 3rd Place */}
          {p3 ? (
            <div className="podium-place third">
              <div className="podium-avatar">🥉</div>
              <div className="podium-name">{p3.name}</div>
              <div className="podium-score">{p3.score} pts</div>
              <div className="podium-pillar">3</div>
            </div>
          ) : (
            <div style={{ width: '30%' }}></div>
          )}
        </div>

        {/* List remaining participants if any */}
        {sorted.length > 3 && (
          <div style={{ maxWidth: '600px', margin: '2rem auto', backgroundColor: 'var(--bg-surface)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Honorable Mentions</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
              {sorted.slice(3).map((p, idx) => (
                <span key={p.id} className="player-bubble" style={{ fontSize: '0.9rem', padding: '0.3rem 0.6rem' }}>
                  #{idx + 4} {p.name} ({p.score} pts)
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn btn-gold" onClick={endGame}>
            Close Session
          </button>
        </div>
      </div>
    );
  }

  return null;
};
