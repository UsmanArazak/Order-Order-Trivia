-- ==========================================
-- 1. DROP EXISTING TABLES (If any, for fresh setup)
-- ==========================================
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS questions CASCADE;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- QUESTIONS TABLE
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    options TEXT[] NOT NULL, -- Array of 4 options
    correct_index INTEGER NOT NULL, -- 0 to 3
    category TEXT NOT NULL DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOMS TABLE
CREATE TABLE rooms (
    code VARCHAR(4) PRIMARY KEY, -- 4-letter room code (e.g. ABCD)
    current_question_index INTEGER DEFAULT 0,
    game_status VARCHAR(20) DEFAULT 'lobby', -- 'lobby', 'question', 'reveal', 'leaderboard', 'finished'
    question_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PLAYERS TABLE
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    room_code VARCHAR(4) REFERENCES rooms(code) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    previous_score INTEGER DEFAULT 0,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_player_in_room UNIQUE (room_code, name)
);

-- ANSWERS TABLE
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    room_code VARCHAR(4) REFERENCES rooms(code) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    selected_option INTEGER NOT NULL, -- 0 to 3
    response_time FLOAT NOT NULL, -- seconds
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_player_question UNIQUE (player_id, question_id)
);

-- ==========================================
-- 3. BYPASS ROW LEVEL SECURITY & GRANT PERMISSIONS
-- ==========================================
-- Disable RLS on all tables so they are open with the anon key
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to the anon, authenticated, and service_role roles
GRANT ALL ON TABLE questions TO anon, authenticated, service_role;
GRANT ALL ON TABLE rooms TO anon, authenticated, service_role;
GRANT ALL ON TABLE players TO anon, authenticated, service_role;
GRANT ALL ON TABLE answers TO anon, authenticated, service_role;

-- ==========================================
-- 4. ENABLE REALTIME REPLICATION
-- ==========================================
begin;
  alter publication supabase_realtime add table rooms, players, answers;
commit;

-- ==========================================
-- 5. SEED INITIAL QUESTIONS (Daura & Parliamentary Theme)
-- ==========================================
INSERT INTO questions (question_text, options, correct_index, category) VALUES
(
    'What is the primary role of the Speaker in a parliamentary debate?',
    ARRAY['To vote on every bill', 'To maintain order and enforce the rules of debate', 'To write the laws', 'To represent the President'],
    1,
    'Parliamentary Procedures'
),
(
    'Which of these is the correct way for a parliamentarian to address the assembly?',
    ARRAY['Mr. Speaker / Madam Speaker', 'Hey everyone', 'Distinguished guests', 'My friends'],
    0,
    'Parliamentary Procedures'
),
(
    'Daura LGA is historically famous as the spiritual home of which ethnic group?',
    ARRAY['Yoruba', 'Hausa', 'Igbo', 'Kanuri'],
    1,
    'Local History'
),
(
    'What is the legendary well in Daura associated with the Bayajidda legend?',
    ARRAY['Kusugu Well', 'Zuma Well', 'Gobirau Well', 'Hadejia Well'],
    0,
    'Local History'
),
(
    'What is a proposed law presented to parliament for debate called before it is passed?',
    ARRAY['An Act', 'A Resolution', 'A Bill', 'A Decree'],
    2,
    'Parliamentary Procedures'
),
(
    'What is the minimum number of members required to be present to conduct parliamentary business?',
    ARRAY['Majority', 'Quorum', 'Plurality', 'Session'],
    1,
    'Parliamentary Procedures'
),
(
    'Who is the current Emir of Daura (ruling since 2007)?',
    ARRAY['Alhaji Faruk Umar Faruk', 'Alhaji Muhammadu Kabir Usman', 'Alhaji Ado Bayero', 'Alhaji Shehu Idris'],
    0,
    'Local Governance'
),
(
    'In a parliamentary vote, what does it mean to "abstain"?',
    ARRAY['Vote in favor', 'Vote against', 'Choose not to vote either way', 'Vote twice'],
    2,
    'Parliamentary Procedures'
);
