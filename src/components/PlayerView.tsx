import React, { useState, useEffect, useRef } from 'react';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import type { Player, Room, Question, Answer } from '../types';
import { ArrowLeft, Clock, Award, LogOut, Sparkles, Crown } from 'lucide-react';

interface PlayerViewProps {
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

export const PlayerView: React.FC<PlayerViewProps> = ({ onBack }) => {
  // Authentication & Session State
  const [roomCode, setRoomCode] = useState<string>('');
  const [nickname, setNickname] = useState<string>('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  // Game UI State
  const [timer, setTimer] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(20);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayersCount, setTotalPlayersCount] = useState<number>(5);
  const [neighborPlayers, setNeighborPlayers] = useState<(Player & { rank: number })[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const countdownIntervalRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const roomStartedAtRef = useRef<string | null>(null);

  // Sandbox Mode state: track current question index during solo play
  const [sandboxQuestionIndex, setSandboxQuestionIndex] = useState<number>(0);

  // 1. Auto-reconnect on mount
  useEffect(() => {
    const savedPlayerId = localStorage.getItem('order_trivia_player_id');
    const savedRoomCode = localStorage.getItem('order_trivia_room_code');
    const savedNickname = localStorage.getItem('order_trivia_nickname');

    if (savedPlayerId && savedRoomCode && savedNickname) {
      attemptAutoReconnect(savedPlayerId, savedRoomCode, savedNickname);
    }
    
    // Fetch total questions for the progress display
    const fetchTotalQuestions = async () => {
      if (hasSupabaseConfig) {
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
        if (count) setTotalQuestions(count);
      } else {
        setTotalQuestions(MOCK_QUESTIONS.length);
      }
    };
    fetchTotalQuestions();

    return () => {
      cleanupRealtime();
    };
  }, []);

  // Realtime Fallback Polling for room status changes
  useEffect(() => {
    if (!hasSupabaseConfig || !roomCode || !player) return;
    
    // Poll room status every 2 seconds
    const interval = setInterval(async () => {
      try {
        const { data: updatedRoom, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .maybeSingle();
          
        if (!error && updatedRoom) {
          setRoom(prev => {
            // Only update and trigger state change if something actually changed
            if (!prev || 
                prev.game_status !== updatedRoom.game_status || 
                prev.current_question_index !== updatedRoom.current_question_index || 
                prev.question_started_at !== updatedRoom.question_started_at) {
              handleRoomStateChange(updatedRoom, player.id);
              return updatedRoom;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error polling room status:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [roomCode, player?.id]);

  const cleanupRealtime = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (channelRef.current && hasSupabaseConfig) {
      supabase.removeChannel(channelRef.current);
    }
  };

  const attemptAutoReconnect = async (id: string, code: string, name: string) => {
    setLoading(true);
    
    if (!hasSupabaseConfig) {
      // Sandbox Mode Mock Reconnect
      setPlayer({
        id,
        name,
        room_code: code,
        score: 0,
        previous_score: 0
      });
      setRoomCode(code);
      setNickname(name);
      setRoom({
        code,
        current_question_index: 0,
        game_status: 'lobby',
        question_started_at: null
      });
      setLoading(false);
      return;
    }

    try {
      const { data: roomData, error: rErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (rErr || !roomData) {
        clearSavedSession();
        setLoading(false);
        return;
      }

      const { data: playerData, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .eq('room_code', code)
        .maybeSingle();

      if (pErr || !playerData) {
        clearSavedSession();
        setLoading(false);
        return;
      }

      setPlayer(playerData);
      setRoomCode(code);
      setNickname(name);
      setRoom(roomData);

      // Restore active question if game is in progress
      if (roomData.game_status !== 'lobby' && roomData.current_question_index !== undefined) {
        const { data: qData } = await supabase.from('questions')
          .select('*')
          .eq('room_code', code)
          .order('created_at', { ascending: true });
        
        if (qData && qData.length > roomData.current_question_index) {
          setCurrentQuestion(qData[roomData.current_question_index]);
        }
      }

      setupRealtimeSubscriptions(code, playerData.id);
    } catch (err) {
      clearSavedSession();
    } finally {
      setLoading(false);
    }
  };

  const saveSession = (id: string, code: string, name: string) => {
    localStorage.setItem('order_trivia_player_id', id);
    localStorage.setItem('order_trivia_room_code', code);
    localStorage.setItem('order_trivia_nickname', name);
  };

  const clearSavedSession = () => {
    localStorage.removeItem('order_trivia_player_id');
    localStorage.removeItem('order_trivia_room_code');
    localStorage.removeItem('order_trivia_nickname');
    setPlayer(null);
    setRoom(null);
  };

  // 2. Manual Join / Rejoin
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    const codeUpper = roomCode.trim().toUpperCase();
    const nameTrimmed = nickname.trim();

    setLoading(true);
    setError('');

    if (!hasSupabaseConfig) {
      // Sandbox Mode: mock join instantly
      const mockPlayerId = 'mock-' + Math.random().toString(36).substr(2, 9);
      saveSession(mockPlayerId, codeUpper, nameTrimmed);
      setPlayer({
        id: mockPlayerId,
        name: nameTrimmed,
        room_code: codeUpper,
        score: 0,
        previous_score: 0
      });
      setRoom({
        code: codeUpper,
        current_question_index: 0,
        game_status: 'lobby',
        question_started_at: null
      });
      setLoading(false);
      return;
    }

    try {
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codeUpper)
        .maybeSingle();

      if (roomErr) throw roomErr;
      if (!roomData) {
        setError('Room not found! Verify the code with Usman.');
        setLoading(false);
        return;
      }

      if (roomData.game_status === 'finished') {
        setError('This game has already finished!');
        setLoading(false);
        return;
      }

      const { data: existingPlayer, error: playErr } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', codeUpper)
        .eq('name', nameTrimmed)
        .maybeSingle();

      if (playErr) throw playErr;

      let joinedPlayer: Player;

      if (existingPlayer) {
        joinedPlayer = existingPlayer;
      } else {
        if (roomData.game_status !== 'lobby') {
          setError('The game has already started! Please wait for the next session.');
          setLoading(false);
          return;
        }

        const { data: newPlayer, error: createErr } = await supabase
          .from('players')
          .insert([
            {
              name: nameTrimmed,
              room_code: codeUpper,
              score: 0,
              previous_score: 0,
            },
          ])
          .select()
          .single();

        if (createErr) throw createErr;
        joinedPlayer = newPlayer;
      }

      saveSession(joinedPlayer.id, codeUpper, nameTrimmed);
      setPlayer(joinedPlayer);
      setRoom(roomData);

      setupRealtimeSubscriptions(codeUpper, joinedPlayer.id);
    } catch (err: any) {
      setError(err.message || 'Error joining the game');
    } finally {
      setLoading(false);
    }
  };

  // 3. Realtime Subscription Setup
  const setupRealtimeSubscriptions = (code: string, playerId: string) => {
    cleanupRealtime();

    const broadcastChannel = supabase.channel(`room_${code}`);
    broadcastChannel
      .on('broadcast', { event: 'question_started' }, ({ payload }: { payload: any }) => {
        const { questionId, startedAt, duration, questionData } = payload;
        handleQuestionStartedBroadcast(questionId, startedAt, duration, playerId, questionData);
      })
      .subscribe();

    channelRef.current = broadcastChannel;

    const roomChannel = supabase.channel(`room-db-${code}`);
    roomChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${code}`,
        },
        (payload: any) => {
          setRoom((prev) => {
            if (!prev) return prev;
            const mergedRoom = { ...prev, ...payload.new } as Room;
            
            // Only trigger state change if something actually changed
            if (prev.game_status !== mergedRoom.game_status || 
                prev.current_question_index !== mergedRoom.current_question_index || 
                prev.question_started_at !== mergedRoom.question_started_at) {
              handleRoomStateChange(mergedRoom, playerId);
            }
            return mergedRoom;
          });
        }
      )
      .subscribe();

    if (room) {
      handleRoomStateChange(room, playerId);
    }
  };

  // Sync state when DB Room status changes
  const handleRoomStateChange = async (updatedRoom: Room, playerId: string) => {
    if (!updatedRoom || !updatedRoom.code) {
      clearSavedSession();
      return;
    }

    if (updatedRoom.game_status === 'lobby') {
      setCurrentQuestion(null);
      setHasSubmitted(false);
      setSelectedOption(null);
      setMyAnswer(null);
      setNeighborPlayers([]);
    }

    if (updatedRoom.game_status === 'question') {
      setNeighborPlayers([]);
      if (updatedRoom.question_started_at) {
        fetchQuestionAndSyncTimer(updatedRoom, playerId);
      }
    }

    if (updatedRoom.game_status === 'reveal') {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      fetchMyAnswerPoints(playerId);
    }

    if (updatedRoom.game_status === 'leaderboard' || updatedRoom.game_status === 'finished') {
      fetchMyRank(updatedRoom.code, playerId);
    }
  };

  // Timer sync from Broadcast
  const handleQuestionStartedBroadcast = async (
    questionId: string,
    startedAt: string,
    duration: number,
    playerId: string,
    questionData?: any
  ) => {
    if (currentQuestion?.id === questionId && roomStartedAtRef.current === startedAt) {
      // We already have this exact question session loaded! Ignore the heartbeat broadcast.
      return;
    }

    roomStartedAtRef.current = startedAt;
    setHasSubmitted(false);
    setSelectedOption(null);
    setMyAnswer(null);

    if (questionData) {
      setCurrentQuestion(questionData);
    } else {
      setCurrentQuestion(null);
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();
      if (qData) setCurrentQuestion(qData);
    }

    // Always start the local timer from full duration for a smooth experience
    setTimer(duration || 20);
    setTotalDuration(duration || 20);

    const { data: existingAns } = await supabase
      .from('answers')
      .select('*')
      .eq('player_id', playerId)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existingAns) {
      setHasSubmitted(true);
      setSelectedOption(existingAns.selected_option);
    }

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Database fallback for question sync (if broadcast missed)
  const fetchQuestionAndSyncTimer = async (dbRoom: Room, playerId: string) => {
    if (currentQuestion && dbRoom.question_started_at === roomStartedAtRef.current) {
      return;
    }

    if (hasSupabaseConfig && channelRef.current) {
      // Instead of guessing the question from chronological DB order, ping the Host for the true randomized question!
      channelRef.current.send({
        type: 'broadcast',
        event: 'request_sync',
        payload: { playerId },
      });
      return; // The Host will respond with a question_started broadcast that sets everything up
    }

    // Fallback for Sandbox Mode
    setCurrentQuestion(null);
    const qData = MOCK_QUESTIONS[dbRoom.current_question_index];
    if (qData) setCurrentQuestion(qData);

    const startedAt = dbRoom.question_started_at || new Date().toISOString();
    roomStartedAtRef.current = startedAt;
    setHasSubmitted(false);
    setSelectedOption(null);
    setMyAnswer(null);

    const { data: existingAns } = await supabase
      .from('answers')
      .select('*')
      .eq('player_id', playerId)
      .eq('question_id', qData.id)
      .maybeSingle();

    if (existingAns) {
      setHasSubmitted(true);
      setSelectedOption(existingAns.selected_option);
    }

    // Ignore Date.now() to prevent device clock desync issues
    setTimer(20);
    setTotalDuration(20);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchMyAnswerPoints = async (playerId: string) => {
    if (!currentQuestion) return;
    
    // Fetch this specific answer
    const { data: ans } = await supabase
      .from('answers')
      .select('*')
      .eq('player_id', playerId)
      .eq('question_id', currentQuestion.id)
      .maybeSingle();

    setMyAnswer(ans || null);

    // Fetch player baseline data
    const { data: playData } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .maybeSingle();

    // Fetch all answers to calculate score
    const { data: allAns } = await supabase
      .from('answers')
      .select('points')
      .eq('player_id', playerId);

    if (playData) {
      const totalPoints = (allAns || []).reduce((sum: number, a: any) => sum + (a.points || 0), 0);
      setPlayer({ ...playData, score: totalPoints });
    }
  };

  const fetchMyRank = async (code: string, playerId: string) => {
    const { data: playData } = await supabase
      .from('players')
      .select('id, name, score')
      .eq('room_code', code);

    const { data: ansData } = await supabase
      .from('answers')
      .select('player_id, points')
      .eq('room_code', code);

    if (playData) {
      const dbPlayers = playData || [];
      const allAnswers = ansData || [];

      const playersWithScores = dbPlayers.map((p: any) => {
        const pAnswers = allAnswers.filter((a: any) => a.player_id === p.id);
        const total = pAnswers.reduce((sum: number, a: any) => sum + (a.points || 0), 0);
        return { ...p, score: total };
      });

      const sortedPlayers = [...playersWithScores].sort((a, b) => b.score - a.score);
      setTotalPlayersCount(sortedPlayers.length);
      
      const idx = sortedPlayers.findIndex((p: any) => p.id === playerId);
      if (idx !== -1) {
        const currentRank = idx + 1;
        setMyRank(currentRank);

        const playersWithRank = sortedPlayers.map((p: any, i: number) => ({
          ...p,
          room_code: code,
          previous_score: p.score,
          rank: i + 1
        }));

        setNeighborPlayers(playersWithRank);
        setTopPlayers(playersWithRank.slice(0, 3));
      }
    }
  };

  // Submit Answer Tap
  const submitAnswer = async (optionIdx: number) => {
    if (hasSubmitted || !currentQuestion || !player || !room || timer <= 0) return;

    setSelectedOption(optionIdx);
    setHasSubmitted(true);

    const startedAt = roomStartedAtRef.current || room.question_started_at || new Date().toISOString();
    const responseTimeSec = (Date.now() - new Date(startedAt).getTime()) / 1000;

    if (!hasSupabaseConfig) {
      // Sandbox Mode: simulate response locally
      const isCorrect = optionIdx === currentQuestion.correct_index;
      const points = isCorrect ? Math.max(500, Math.round(1000 * (1 - (responseTimeSec / 20) * 0.5))) : 0;

      setTimeout(() => {
        setMyAnswer({
          id: 'mock-ans',
          player_id: player.id,
          room_code: roomCode,
          question_id: currentQuestion.id,
          selected_option: optionIdx,
          response_time: responseTimeSec,
          points
        });
        
        setPlayer(prev => prev ? {
          ...prev,
          previous_score: prev.score,
          score: prev.score + points
        } : null);

        setRoom(prev => prev ? { ...prev, game_status: 'reveal' } : null);
      }, 1500);
      return;
    }

    try {
      const isCorrect = optionIdx === currentQuestion.correct_index;
      const points = isCorrect ? Math.max(500, Math.round(1000 * (1 - (responseTimeSec / 20) * 0.5))) : 0;

      const { error: ansErr } = await supabase.from('answers').insert([
        {
          player_id: player.id,
          room_code: room.code,
          question_id: currentQuestion.id,
          selected_option: optionIdx,
          response_time: responseTimeSec,
          points: points,
        },
      ]);
      if (ansErr) throw ansErr;

      // We ONLY insert the answer here. 
      // The Host will safely calculate and update the master player score when the round ends to prevent double-counting!

      setMyAnswer({
        id: 'temp',
        player_id: player.id,
        room_code: room.code,
        question_id: currentQuestion.id,
        selected_option: optionIdx,
        response_time: responseTimeSec,
        points: points
      });
    } catch (err: any) {
      console.error('Error submitting answer:', err.message);
      setHasSubmitted(false);
      setSelectedOption(null);
    }
  };

  // Sandbox Mode: Solo Game state progression
  const startSandboxGame = () => {
    setSandboxQuestionIndex(0);
    loadSandboxQuestion(0);
  };

  const loadSandboxQuestion = (index: number) => {
    setHasSubmitted(false);
    setSelectedOption(null);
    setMyAnswer(null);
    const question = MOCK_QUESTIONS[index];
    setCurrentQuestion(question);
    setTimer(20);
    setTotalDuration(20);
    setRoom(prev => prev ? {
      ...prev,
      game_status: 'question',
      current_question_index: index,
      question_started_at: new Date().toISOString()
    } : null);

    roomStartedAtRef.current = new Date().toISOString();

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          // Times up simulator
          setRoom(p => p ? { ...p, game_status: 'reveal' } : null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const nextSandboxQuestion = () => {
    const nextIdx = sandboxQuestionIndex + 1;
    if (nextIdx < MOCK_QUESTIONS.length) {
      setSandboxQuestionIndex(nextIdx);
      loadSandboxQuestion(nextIdx);
    } else {
      // End game standing simulator
      const finalScore = player?.score || 0;
      setMyRank(2); // Mock placing 2nd
      setNeighborPlayers([
        {
          id: 'mock-above',
          name: 'Senator Abubakar',
          room_code: 'DEMO',
          score: finalScore + 120,
          previous_score: finalScore + 120,
          rank: 1
        },
        {
          id: player?.id || 'mock-current',
          name: player?.name || 'You',
          room_code: 'DEMO',
          score: finalScore,
          previous_score: finalScore,
          rank: 2
        },
        {
          id: 'mock-below',
          name: 'Senator Amina',
          room_code: 'DEMO',
          score: Math.max(0, finalScore - 80),
          previous_score: Math.max(0, finalScore - 80),
          rank: 3
        }
      ]);
      setRoom(prev => prev ? { ...prev, game_status: 'finished' } : null);
    }
  };

  // Leave Game Room
  const leaveGame = () => {
    if (window.confirm('Are you sure you want to leave the game?')) {
      cleanupRealtime();
      clearSavedSession();
    }
  };

  // ----------------------------------------------------
  // RENDER SCREENS
  // ----------------------------------------------------

  // 1. Join Screen
  if (!player || !room) {
    return (
      <div className="player-layout">
        <div className="join-card">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span className="tagline">Daura LGA Students Parliamentary Club</span>
            <h2 style={{ marginTop: '0.5rem', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--primary-dark)', fontWeight: 900 }}>ORDER! ORDER!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Enter the room code and your nickname to join the assembly.
            </p>
          </div>

          {error && (
            <p style={{ color: 'var(--color-red)', marginBottom: '1rem', fontWeight: 600, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label>Room Code</label>
              <input
                type="text"
                className="form-input"
                placeholder={hasSupabaseConfig ? 'ABCD' : 'DEMO'}
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                autoFocus
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label>Nickname</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Hon. Gidado"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onBack} disabled={loading} style={{ flex: 1 }}>
                <ArrowLeft size={18} /> Exit
              </button>
              <button type="submit" className="btn btn-gold" disabled={loading} style={{ flex: 2 }}>
                {loading ? 'Entering...' : 'Enter Chamber'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. Waiting Lobby (waiting for host to start)
  if (room.game_status === 'lobby') {
    return (
      <div className="player-layout">
        <div className="join-card" style={{ textAlign: 'center', borderTop: '5px solid var(--primary)' }}>
          {!hasSupabaseConfig ? (
            <div>
              <Sparkles size={48} style={{ color: 'var(--gold)', marginBottom: '1rem', marginInline: 'auto' }} />
              <span className="tagline">Sandbox Lobby</span>
              <h2 style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>Welcome, {player.name}!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                You are in Sandbox Mode. Since there is no live host screen running to start questions, you can launch a simulated solo run on this phone.
              </p>
              <button className="btn btn-gold" onClick={startSandboxGame} style={{ width: '100%', marginBottom: '1rem' }}>
                Start Simulated Solo Game
              </button>
            </div>
          ) : (
            <div>
              <div className="loading-spinner" style={{ margin: '1rem auto 2rem' }}></div>
              <span className="tagline">Chamber Connected</span>
              <h2 style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>Welcome, {player.name}!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.8' }}>
                You are seated in the chambers. Waiting for <span style={{ color: 'var(--gold-dark)', backgroundColor: 'var(--bg-surface)', border: '2px solid var(--gold)', padding: '0.15rem 0.6rem', borderRadius: '6px', fontWeight: 900, boxShadow: '0 2px 4px rgba(205,127,50,0.2)', margin: '0 0.15rem', display: 'inline-block', transform: 'translateY(-1px)' }}>Usman</span> to start the parliamentary session.
              </p>
            </div>
          )}
          <button className="btn btn-secondary" onClick={leaveGame} style={{ width: '100%' }}>
            <LogOut size={16} /> Leave Room
          </button>
        </div>
      </div>
    );
  }

  // 3. Question Active (taping canvas)
  if (room.game_status === 'question' && currentQuestion) {
    if (hasSubmitted) {
      return (
        <div className="player-layout">
          <div className="player-status-waiting">
            <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question {room.current_question_index + 1}/{totalQuestions}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90px', height: '90px', borderRadius: '50%', backgroundColor: timer <= 5 ? 'rgba(226, 27, 60, 0.1)' : 'rgba(11, 102, 35, 0.05)', border: `4px solid ${timer <= 5 ? 'var(--color-red)' : 'var(--primary)'}`, margin: '0 auto 1.5rem', color: timer <= 5 ? 'var(--color-red)' : 'var(--primary-dark)', transition: 'all 0.3s ease' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>{timer}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>sec</span>
            </div>
            <h2>Answer Recorded!</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
              {!hasSupabaseConfig ? 'Simulating submission reveal...' : 'Waiting for other parliamentarians to lock in their arguments.'}
            </p>
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', textAlign: 'left', width: '100%' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Your Selection</span>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '36px', height: '36px', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 800, borderRadius: '50%', fontSize: '1.1rem' }}>
                  {['A', 'B', 'C', 'D'][selectedOption ?? 0]}
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary-dark)' }}>
                  {currentQuestion.options[selectedOption ?? 0]}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="player-layout">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700 }}>{player.name}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{room.current_question_index + 1}/{totalQuestions}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '1.2rem', fontWeight: 800, color: timer <= 5 ? 'var(--color-red)' : 'var(--primary-dark)' }}>
            <Clock size={16} /> {timer}s
          </div>
        </div>

        {/* Visual Timer Progress Bar */}
        <div className="timer-progress-bar-container">
          <div 
            className={`timer-progress-bar-fill ${timer <= 5 ? 'critical' : ''}`}
            style={{ 
              width: `${(timer / totalDuration) * 100}%`,
              backgroundColor: timer <= 5 ? 'var(--color-red)' : timer <= 10 ? 'var(--gold)' : 'var(--primary)',
              transition: timer === totalDuration ? 'none' : 'width 1s linear, background-color 0.4s ease'
            }}
          />
        </div>

        {/* Question text card displayed on player phone */}
        <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)', lineHeight: '1.5', margin: 0, fontWeight: 700 }}>
            {currentQuestion.question_text}
          </h3>
        </div>

        {/* Options list A, B, C, D */}
        <div className="player-options-list">
          {currentQuestion.options.map((option, idx) => (
            <button key={idx} className="player-option-btn" onClick={() => submitAnswer(idx)}>
              <span className="player-option-letter">{['A', 'B', 'C', 'D'][idx]}</span>
              <span className="player-option-text">{option}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 4. Reveal / Feedback Screen
  if (room.game_status === 'reveal' && currentQuestion) {
    const isCorrect = myAnswer && myAnswer.selected_option === currentQuestion.correct_index;
    const pointsEarned = myAnswer ? myAnswer.points : 0;

    return (
      <div className="player-layout" style={{ padding: '0.5rem' }}>
        <div className={`player-feedback ${isCorrect ? 'correct' : 'incorrect'}`} style={{ padding: '1.25rem 1rem', margin: 0, width: '100%', maxWidth: '400px' }}>
          <div className="player-feedback-icon" style={{ 
            color: isCorrect ? 'var(--color-green)' : 'var(--color-red)', 
            fontSize: '3.5rem', 
            marginBottom: '0.25rem',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginInline: 'auto'
          }}>
            {isCorrect ? '✓' : myAnswer ? '✗' : <Clock size={56} />}
          </div>
          <h2 className="player-feedback-title" style={{ 
            color: isCorrect ? 'var(--color-green)' : 'var(--color-red)',
            fontSize: '2rem',
            marginBottom: '0.25rem',
            fontWeight: 900
          }}>
            {isCorrect ? 'CORRECT!' : 'INCORRECT!'}
          </h2>
          {!myAnswer && (
            <div style={{ color: 'var(--color-red)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
              (Time's Up - No Answer)
            </div>
          )}
          
          {/* Answer validation and correct option details */}
          <div style={{ margin: '1rem 0', padding: '0.75rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'left', width: '100%' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--primary-dark)', marginBottom: '0.75rem', fontWeight: 700, lineHeight: '1.3' }}>
              {currentQuestion.question_text}
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: isCorrect ? 'rgba(11, 102, 35, 0.08)' : 'rgba(226, 27, 60, 0.08)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isCorrect ? 'var(--color-green)' : 'var(--color-red)' }}>YOURS:</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {myAnswer ? ['A', 'B', 'C', 'D'][myAnswer.selected_option] : '—'}
                </span>
                <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {myAnswer ? currentQuestion.options[myAnswer.selected_option] : "No answer"}
                </span>
              </div>
              
              {!isCorrect && (
                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'rgba(11, 102, 35, 0.08)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>CORRECT:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                    {['A', 'B', 'C', 'D'][currentQuestion.correct_index]}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary-dark)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentQuestion.options[currentQuestion.correct_index]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Points Gained</span>
              <div style={{ color: isCorrect ? 'var(--color-green)' : 'var(--color-red)', fontSize: '1.35rem', fontWeight: 800, marginTop: '0.25rem' }}>
                +{pointsEarned}
              </div>
            </div>
            <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Total Score</span>
              <div style={{ color: 'var(--primary-dark)', fontSize: '1.35rem', fontWeight: 800, marginTop: '0.25rem' }}>
                {player.score}
              </div>
            </div>
          </div>

          {!hasSupabaseConfig && (
            <button className="btn btn-primary" onClick={nextSandboxQuestion} style={{ marginTop: '1.5rem', width: '100%' }}>
              {sandboxQuestionIndex + 1 >= MOCK_QUESTIONS.length ? 'Show Standings' : 'Next Motion'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. Leaderboard Feedback Screen
  if (room.game_status === 'leaderboard') {
    return (
      <div className="player-layout" style={{ padding: '0.5rem' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderTop: '4px solid var(--gold)', textAlign: 'center', width: '100%' }}>
          <Award size={36} style={{ display: 'block', color: 'var(--gold)', marginBottom: '0.5rem', marginInline: 'auto' }} />
          <span className="tagline" style={{ fontSize: '0.75rem', margin: 0 }}>Leaderboard</span>
          <h1 style={{ fontSize: '2.5rem', margin: '0.25rem 0', color: 'var(--gold-dark)', lineHeight: 1 }}>
            No. {myRank || '—'}
          </h1>
          <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
            out of {totalPlayersCount} members
          </p>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Total Score: {player.score} pts
          </p>

          {/* Mini Leaderboard Chamber Neighbors */}
          {neighborPlayers.length > 0 && (
            <div style={{ marginTop: '1rem', marginBottom: '1rem', textAlign: 'left' }}>
              <span className="tagline" style={{ display: 'block', marginBottom: '0.5rem', textAlign: 'center', fontSize: '0.75rem' }}>
                All Players Standings
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {neighborPlayers.map((p) => {
                  const isMe = p.id === player.id;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        backgroundColor: isMe ? 'rgba(11, 102, 35, 0.08)' : 'var(--bg-card)',
                        border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: isMe ? 700 : 500
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: isMe ? 'var(--primary-dark)' : 'var(--text-secondary)', fontWeight: 800 }}>
                          No. {p.rank}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: isMe ? 'var(--primary-dark)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                          {p.name} {isMe && '(You)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: isMe ? 'var(--primary-dark)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {p.score} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivational comment */}
          {(() => {
            const myIdx = neighborPlayers.findIndex(p => p.id === player.id);
            if (myIdx > 0) {
              const playerAbove = neighborPlayers[myIdx - 1];
              const diff = playerAbove.score - neighborPlayers[myIdx].score;
              return (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.5rem 0 1rem 0' }}>
                  Only <strong style={{ color: 'var(--primary-dark)' }}>{diff} pts</strong> behind {playerAbove.name}!
                </p>
              );
            } else if (neighborPlayers.length > 0 && myRank === 1) {
              return (
                <p style={{ fontSize: '0.8rem', color: 'var(--primary-dark)', fontWeight: 700, margin: '0.5rem 0 1rem 0' }}>
                  🎉 You're leading the Chamber!
                </p>
              );
            }
            return null;
          })()}
        </div>
      </div>
    );
  }

  // 6. Finished Screen
  if (room.game_status === 'finished') {
    return (
      <div className="player-layout">
        <div style={{ textAlign: 'center', padding: '2rem 1rem', width: '100%', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
          <Award size={64} style={{ display: 'block', color: 'var(--gold)', marginBottom: '1rem', marginInline: 'auto' }} />
          <h2 style={{ color: 'var(--gold-dark)', marginBottom: '1.5rem', fontSize: '2.25rem', fontWeight: 900 }}>Game Finished!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>You completed the parliamentary trivia quiz.</p>

          {/* Podium */}
          {topPlayers.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.5rem', height: '180px', margin: '2rem 0' }}>
              {/* Silver: 2nd Place */}
              {topPlayers[1] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#C0C0C0', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{topPlayers[1].name}</span>
                  <div style={{ width: '100%', height: '100px', backgroundColor: '#e0e0e0', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid #C0C0C0' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a0a0a0', whiteSpace: 'nowrap' }}>No. 2</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: 'auto', marginBottom: '0.5rem' }}>{topPlayers[1].score}</span>
                  </div>
                </div>
              )}

              {/* Gold: 1st Place */}
              {topPlayers[0] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%', zIndex: 2 }}>
                  <Crown size={24} style={{ color: 'var(--gold)', marginBottom: '0.25rem' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--gold-dark)', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{topPlayers[0].name}</span>
                  <div style={{ width: '100%', height: '140px', backgroundColor: 'var(--gold)', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid var(--gold-dark)', boxShadow: '0 -4px 12px rgba(212, 175, 55, 0.4)' }}>
                    <span style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>No. 1</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', marginTop: 'auto', marginBottom: '0.5rem' }}>{topPlayers[0].score}</span>
                  </div>
                </div>
              )}

              {/* Bronze: 3rd Place */}
              {topPlayers[2] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cd7f32', textAlign: 'center', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{topPlayers[2].name}</span>
                  <div style={{ width: '100%', height: '80px', backgroundColor: '#f0e6d2', borderRadius: '4px 4px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '0.5rem', border: '1px solid #cd7f32' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b87333', whiteSpace: 'nowrap' }}>No. 3</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: 'auto', marginBottom: '0.5rem' }}>{topPlayers[2].score}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ margin: '1.5rem 0' }}>
            <span className="tagline">Final Position</span>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
              No. {myRank || '—'}
            </div>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
              Score: {neighborPlayers.find(p => p.id === player.id)?.score || player.score} pts
            </p>
          </div>

          {/* Final Standing Neighbors */}
          {neighborPlayers.length > 0 && (
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <span className="tagline" style={{ display: 'block', marginBottom: '0.75rem', textAlign: 'center' }}>
                All Players Final Standings
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                {neighborPlayers.map((p) => {
                  const isMe = p.id === player.id;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.8rem',
                        backgroundColor: isMe ? 'rgba(11, 102, 35, 0.08)' : 'transparent',
                        border: isMe ? '1px solid var(--primary)' : '1px solid transparent',
                        borderRadius: '6px',
                        fontWeight: isMe ? 700 : 500
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-dark)', minWidth: '2.5rem' }}>
                          No. {p.rank}
                        </span>
                        <span style={{ color: isMe ? 'var(--primary-dark)' : 'var(--text-primary)' }}>
                          {p.name} {isMe && '(You)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: isMe ? 'var(--primary-dark)' : 'var(--text-secondary)', fontSize: '0.95rem' }}>
                          {p.score} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className="btn btn-secondary" onClick={leaveGame} style={{ width: '100%' }}>
            Exit Chambers
          </button>
        </div>
      </div>
    );
  }

  // Fallback Loading Screen (for any desynced state)
  return (
    <div className="player-layout">
      <div className="player-status-waiting">
        <div className="loading-spinner"></div>
        <h2>Syncing with Chambers...</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '2rem' }}>
          Reconnecting you to the live parliamentary session.
        </p>
        <button className="btn btn-secondary" onClick={leaveGame} style={{ width: '100%' }}>
          <LogOut size={16} /> Force Exit Room
        </button>
      </div>
    </div>
  );
};
