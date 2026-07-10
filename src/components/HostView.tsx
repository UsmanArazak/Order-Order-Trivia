import React, { useState, useEffect, useRef } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import type { Question, Room, Player, Answer } from '../types';
import { ArrowLeft, Play, Award, ChevronRight, Users, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface HostViewProps {
  onBack: () => void;
}

const MOCK_QUESTIONS: Question[] = [
  { id: 'mock-1', question_text: 'What is a Parliament?', options: ['A military command center', 'An assembly of elected representatives', 'A private social club', 'A group of judges'], correct_index: 1 },
  { id: 'mock-2', question_text: 'Who presides over a parliamentary sitting?', options: ['The President', 'The Speaker', 'The Chief Whip', 'The Clerk'], correct_index: 1 },
  { id: 'mock-3', question_text: 'Who keeps the official records of a sitting?', options: ['The Secretary General', 'The Speaker', 'The Clerk', 'The Majority Leader'], correct_index: 2 },
  { id: 'mock-4', question_text: 'What is a motion?', options: ['A physical movement in the House', 'An order from the Speaker', 'A formal proposal for debate', 'A signed law'], correct_index: 2 },
  { id: 'mock-5', question_text: 'What is an Order Paper?', options: ['A rulebook for members', 'A record of past decisions', 'The daily agenda of business', 'A voting ballot'], correct_index: 2 },
  { id: 'mock-6', question_text: 'Who moves a motion?', options: ['The Speaker', 'The Proposer', 'The Seconder', 'The Clerk'], correct_index: 1 },
  { id: 'mock-7', question_text: 'Why must a motion be seconded?', options: ['To immediately pass the motion', 'To challenge the Speaker', 'To record the vote', 'To show support before debate'], correct_index: 3 },
  { id: 'mock-8', question_text: 'What is the role of the Majority Leader?', options: ['To enforce discipline', 'To coordinate government business', 'To keep official records', 'To preside over the House'], correct_index: 1 },
  { id: 'mock-9', question_text: 'What is the role of the Chief Whip?', options: ['To manage House finances', 'To advise the Speaker', 'To maintain member discipline', 'To present new laws'], correct_index: 2 },
  { id: 'mock-10', question_text: 'What is a debate?', options: ['A physical altercation', 'Formal discussion of a motion', 'A private meeting of leaders', 'A direct order from the Speaker'], correct_index: 1 },
  { id: 'mock-11', question_text: 'What does \'quorum\' mean?', options: ['Maximum members allowed to speak', 'A type of parliamentary vote', 'Minimum members required to begin', 'The end of a sitting'], correct_index: 2 },
  { id: 'mock-12', question_text: 'How do you get permission to speak?', options: ['Shout your name loudly', 'Stand and wait for the Speaker', 'Walk to the center floor', 'Pass a note to the Clerk'], correct_index: 1 },
  { id: 'mock-13', question_text: 'When is a Point of Order used?', options: ['When a member wants to leave', 'When a vote is tied', 'When parliamentary rules are broken', 'When introducing a guest'], correct_index: 2 },
  { id: 'mock-14', question_text: 'What is a parliamentary vote?', options: ['Choosing a seat in the House', 'Selecting the days agenda', 'Deciding to accept or reject a motion', 'Electing a new President'], correct_index: 2 },
  { id: 'mock-15', question_text: 'What does the Secretary General do?', options: ['Leads the majority party', 'Handles documents and admin duties', 'Forces members to attend', 'Resolves rule disputes'], correct_index: 1 },
  { id: 'mock-16', question_text: 'What makes a good parliamentarian?', options: ['Wealth and social status', 'Aggression and loudness', 'Ability to write fast', 'Discipline, respect, and confidence'], correct_index: 3 },
  { id: 'mock-17', question_text: 'Why speak only through the Speaker?', options: ['To waste debate time', 'To ensure the microphone is on', 'To maintain order and respect', 'To bypass the Chief Whip'], correct_index: 2 },
  { id: 'mock-18', question_text: 'If a motion gets majority support, what happens?', options: ['It is debated again tomorrow', 'It is passed by the House', 'It is sent to the Clerk', 'It is immediately rejected'], correct_index: 1 },
  { id: 'mock-19', question_text: 'Why form a Student Parliamentary Club?', options: ['To organize school parties', 'To bypass school exams', 'To develop leadership and public speaking', 'To protest against teachers'], correct_index: 2 },
  { id: 'mock-20', question_text: 'What is the main aim of the Club?', options: ['Raising money for the school', 'Punishing misbehaving students', 'Playing political games', 'Training in democratic values'], correct_index: 3 }
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
  const roomRef = useRef<Room | null>(null);
  const currentQuestionRef = useRef<Question | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // Heartbeat broadcast: constantly pulse the active question to ensure late joiners sync perfectly
  useEffect(() => {
    if (room?.game_status === 'question' && currentQuestion) {
      const interval = setInterval(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'question_started',
            payload: {
              questionIndex: room.current_question_index,
              questionId: currentQuestion.id,
              startedAt: room.question_started_at,
              duration: 20,
              questionData: currentQuestion,
            },
          });
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [room?.game_status, currentQuestion, room?.current_question_index, room?.question_started_at]);

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

  // Bulletproof Auto-Reveal
  useEffect(() => {
    if (room?.game_status === 'question' && timer === 0) {
      revealAnswer();
    }
  }, [timer, room?.game_status]);

  // Realtime Fallback Polling
  useEffect(() => {
    if (!room || room.game_status !== 'question') return;
    const pollInterval = setInterval(() => {
      supabase.from('rooms').select('game_status').eq('code', room.code).single().then(({ data }: { data: any }) => {
        if (data && data.game_status !== room.game_status) {
          setRoom(prev => prev ? { ...prev, game_status: data.game_status } : prev);
        }
      });
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [room?.game_status, room?.code]);

  // Timer countdown
  useEffect(() => {
    if (!room || room.game_status !== 'question') return;
    
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-reveal is handled by Bulletproof Auto-Reveal
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
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
        setQuestions(JSON.parse(local).slice(0, 20));
      } else {
        setQuestions([...MOCK_QUESTIONS].slice(0, 20));
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

      setQuestions((data || []).slice(0, 20));
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
      .on('broadcast', { event: 'request_sync' }, () => {
        if (currentQuestionRef.current && roomRef.current?.game_status === 'question') {
          channel.send({
            type: 'broadcast',
            event: 'question_started',
            payload: {
              questionIndex: roomRef.current.current_question_index,
              questionId: currentQuestionRef.current.id,
              startedAt: roomRef.current.question_started_at,
              duration: 20,
              questionData: currentQuestionRef.current,
            },
          });
        }
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
    
    const { data: playData, error: pErr } = await supabase
      .from('players')
      .select('*')
      .eq('room_code', code);

    const { data: ansData } = await supabase
      .from('answers')
      .select('player_id, points')
      .eq('room_code', code);

    if (!pErr && playData) {
      const allAnswers = ansData || [];
      const playersWithScores = playData.map((p: Player) => {
        const pAnswers = allAnswers.filter((a: any) => a.player_id === p.id);
        const total = pAnswers.reduce((sum: number, a: any) => sum + (a.points || 0), 0);
        return { ...p, score: total };
      });

      const ranked = [...playersWithScores].sort((a, b) => b.score - a.score);
      ranked.forEach((p, idx) => { p.rank = idx + 1; });
      setPlayers(ranked);
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

      return;
    }

    try {
      // 1. Broadcast "question started" message to all connected phones immediately!
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'question_started',
          payload: {
            questionIndex: index,
            questionId: question.id,
            startedAt,
            duration: 20,
            questionData: question,
          },
        });
      }

      // 2. Update local state immediately so Host timer starts in perfect sync
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

      // 3. Update the database room state in the background
      supabase
        .from('rooms')
        .update({
          current_question_index: index,
          game_status: 'question',
          question_started_at: startedAt,
        })
        .eq('code', roomCode)
        .then((res: any) => {
          if (res.error) console.error("Error updating room state", res.error);
        });

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

        // Update player in database (set score to newScore)
        const { error: pUpErr } = await supabase
          .from('players')
          .update({
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
    const dist = [0, 0, 0, 0];
    const currentQAnswers = answers.filter(a => a.question_id === currentQuestion?.id);
    
    // Deduplicate to ensure one vote per player
    const uniqueAnswers = new Map();
    currentQAnswers.forEach(a => uniqueAnswers.set(a.player_id, a));
    
    uniqueAnswers.forEach((ans) => {
      if (ans.selected_option >= 0 && ans.selected_option < 4) {
        dist[ans.selected_option]++;
      }
    });
    return dist;
  };

  // Rank players for Leaderboard (including rank change indicators)
  const getRankedPlayers = () => {
    const currentSorted = [...players].sort((a, b) => b.score - a.score);

    return currentSorted.map((player, idx) => {
      const currentRank = idx + 1;
      const change = player.score - player.previous_score;

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
            <h2 style={{ marginTop: '0.5rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--primary-dark)', fontWeight: 900 }}>ORDER! ORDER!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Start the session and manage the trivia game.
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

        <div className="lobby-grid" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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

  if (room.game_status === 'question' && currentQuestion) {
    const currentQAnswers = answers.filter(a => a.question_id === currentQuestion.id);
    const uniqueAnswers = new Map();
    currentQAnswers.forEach(a => uniqueAnswers.set(a.player_id, a));
    
    const answeredCount = uniqueAnswers.size;
    const totalCount = players.length;

    return (
      <div className="host-layout container" style={{ padding: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span className="tagline" style={{ color: 'var(--gold-dark)', margin: 0 }}>
            Q {room.current_question_index + 1} of {questions.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ padding: '0.2rem 0.6rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
              {answeredCount}/{totalCount} Logs
            </div>
            <div style={{ padding: '0.2rem 0.6rem', backgroundColor: timer <= 5 ? 'var(--color-red)' : 'var(--primary-dark)', color: 'white', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={14} /> {timer}s
            </div>
          </div>
        </div>

        <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
          <h1 style={{ fontSize: '1.1rem', lineHeight: '1.4', margin: 0 }}>{currentQuestion.question_text}</h1>
        </div>

        {/* Options grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {currentQuestion.options.map((option, idx) => (
            <div key={idx} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '0.85rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', flexShrink: 0 }}>
                {['A', 'B', 'C', 'D'][idx]}
              </span>
              <span style={{ fontSize: '0.95rem', flex: 1, wordBreak: 'break-word' }}>{option}</span>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={endGame} style={{ width: '100%', padding: '0.5rem' }}>
          Cancel Game Early
        </button>
      </div>
    );
  }

  // 3. Question Reveal Screen
  if (room.game_status === 'reveal' && currentQuestion) {
    const dist = getAnswersDistribution();
    const maxVal = Math.max(...dist, 1);

    return (
      <div className="host-layout container" style={{ padding: '0.5rem' }}>
        <div className="question-header" style={{ marginBottom: '1rem' }}>
          <span className="tagline" style={{ fontSize: '0.8rem', margin: 0 }}>Answer Distribution</span>
          <h1 className="question-text" style={{ fontSize: '1.1rem', margin: '0.5rem 0 0 0' }}>{currentQuestion.question_text}</h1>
        </div>

        {/* Answer Bar Chart */}
        <div className="chart-container" style={{ height: '120px', marginBottom: '1rem', padding: '1rem', gap: '0.5rem' }}>
          {dist.map((count, idx) => {
            const pct = (count / maxVal) * 80 + 10;
            const isCorrect = idx === currentQuestion.correct_index;
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']; // Blue, Green, Yellow, Red
            return (
              <div key={idx} className="chart-bar-wrapper">
                <div
                  className={`chart-bar bar-${idx}`}
                  style={{
                    height: `${pct}%`,
                    border: isCorrect ? '3px solid var(--primary-dark)' : 'none',
                    backgroundColor: colors[idx],
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    minWidth: '30px'
                  }}
                >
                  {count}
                </div>
                <div className="chart-label">
                  <span className="option-shape" style={{ width: '24px', height: '24px', fontSize: '0.8rem', backgroundColor: isCorrect ? 'var(--primary)' : 'rgba(0,0,0,0.05)', color: isCorrect ? '#fff' : 'var(--text-secondary)', borderRadius: '50%', fontWeight: 800, display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                    {isCorrect ? '✓' : ['A', 'B', 'C', 'D'][idx]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Options grid showing the correct answer highlighted */}
        <div className="options-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {currentQuestion.options.map((option, idx) => {
            const isCorrect = idx === currentQuestion.correct_index;
            return (
              <div
                key={idx}
                className={`option-card option-${idx} ${isCorrect ? 'correct-answer-card' : 'dimmed'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}
              >
                <span className="option-shape" style={{ borderRadius: '50%', width: '24px', height: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                  {['A', 'B', 'C', 'D'][idx]}
                </span>
                <span style={{ flex: 1, textAlign: 'left', wordBreak: 'break-word', fontSize: '0.9rem' }}>{option}</span>
                {isCorrect && <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 800 }}>CORRECT</span>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn btn-gold" onClick={showLeaderboard} disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
            Show Leaderboard <ChevronRight size={18} />
          </button>
          <button className="btn btn-secondary" onClick={endGame} style={{ width: '100%', padding: '0.75rem' }}>
            Cancel Game Early
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
      <div className="host-layout container" style={{ padding: '0.25rem', width: '100%', maxWidth: '100%' }}>
        <div className="leaderboard-container" style={{ padding: '0.5rem', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <Award size={36} style={{ color: 'var(--gold)', marginBottom: '0.5rem' }} />
            <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '1.2rem', margin: 0 }}>Leaderboard</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0' }}>
              Round {room.current_question_index + 1}
            </p>
          </div>

          <div className="leaderboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ranked.slice(0, 5).map((player) => (
              <div key={player.id} className={`leaderboard-item rank-${player.rank}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0.75rem 0.75rem', gap: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', width: '100%' }}>
                <span className="leaderboard-rank" style={{ fontSize: '1.1rem', fontWeight: 800, minWidth: '65px', flexShrink: 0, textAlign: 'center', color: 'var(--text-secondary)' }}>{`No.\u00A0${player.rank}`}</span>
                <span className="leaderboard-name" style={{ fontSize: '1rem', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700, color: 'var(--primary-dark)' }}>{player.name}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '0.1rem' }}>
                  <span className="leaderboard-score" style={{ fontSize: '0.95rem', fontWeight: 800 }}>{player.score} pts</span>
                  <span className={`leaderboard-change ${player.change > 0 ? 'up' : player.change < 0 ? 'down' : ''}`} style={{ fontSize: '0.75rem', fontWeight: 800, color: player.change > 0 ? 'var(--color-green)' : player.change < 0 ? 'var(--color-red)' : 'var(--text-muted)' }}>
                    {player.change > 0 ? `+${player.change}` : player.change < 0 ? `${player.change}` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button className="btn btn-gold" onClick={handleNext} disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
              {isLastQuestion ? 'Show Final Podium' : 'Next Question'} <ChevronRight size={18} />
            </button>
            <button className="btn btn-secondary" onClick={endGame} style={{ width: '100%', padding: '0.75rem' }}>
              Cancel Game Early
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
      <div className="host-layout container" style={{ padding: '0.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span className="tagline" style={{ fontSize: '0.8rem', margin: 0 }}>Quiz Completed</span>
          <h1 style={{ color: 'var(--primary-dark)', fontSize: '1.5rem', margin: '0.25rem 0' }}>The Podium</h1>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.5rem', height: '180px', margin: '1rem 0 2rem 0' }}>
          {/* Silver: 2nd Place */}
          {p2 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#C0C0C0', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p2.name}</span>
              <div style={{ width: '100%', height: '100px', backgroundColor: '#e0e0e0', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid #C0C0C0' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a0a0a0', whiteSpace: 'nowrap' }}>No. 2</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: 'auto', marginBottom: '0.5rem' }}>{p2.score}</span>
              </div>
            </div>
          )}

          {/* Gold: 1st Place */}
          {p1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%', zIndex: 2 }}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.1rem' }}>👑</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--gold-dark)', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p1.name}</span>
              <div style={{ width: '100%', height: '140px', backgroundColor: 'var(--gold)', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid var(--gold-dark)', boxShadow: '0 -4px 12px rgba(212, 175, 55, 0.4)' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>No. 1</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', marginTop: 'auto', marginBottom: '0.5rem' }}>{p1.score}</span>
              </div>
            </div>
          )}

          {/* Bronze: 3rd Place */}
          {p3 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cd7f32', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p3.name}</span>
              <div style={{ width: '100%', height: '80px', backgroundColor: '#f0e6d2', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid #cd7f32' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b87333', whiteSpace: 'nowrap' }}>No. 3</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: 'auto', marginBottom: '0.5rem' }}>{p3.score}</span>
              </div>
            </div>
          )}
        </div>

        {/* List remaining participants if any */}
        {sorted.length > 3 && (
          <div style={{ margin: '1rem 0', backgroundColor: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>Honorable Mentions</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              {sorted.slice(3).map((p, idx) => (
                <span key={p.id} className="player-bubble" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {`No.\u00A0${idx + 4} `} {p.name}
                  </div>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-gold" onClick={endGame} style={{ width: '100%', padding: '0.75rem' }}>
            Close Assembly
          </button>
        </div>
      </div>
    );
  }

  return null;
};
