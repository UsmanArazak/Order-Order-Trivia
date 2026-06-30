export interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  created_at?: string;
}

export interface Room {
  code: string;
  current_question_index: number;
  game_status: 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';
  question_started_at: string | null;
  created_at?: string;
}

export interface Player {
  id: string;
  name: string;
  room_code: string;
  score: number;
  previous_score: number;
  joined_at?: string;
}

export interface Answer {
  id: string;
  player_id: string;
  room_code: string;
  question_id: string;
  selected_option: number;
  response_time: number;
  points: number;
  created_at?: string;
}
