const { createClient } = require('@supabase/supabase-js');

const URL = process.env.VITE_SUPABASE_URL || 'https://eacvyczwrjnbkwikwvxn.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(URL, KEY);

const SEED_QUESTIONS = [
  {
    question_text: 'What is the primary role of the Speaker in a parliamentary debate?',
    options: ['To vote on every bill', 'To maintain order and enforce the rules of debate', 'To write the laws', 'To represent the President'],
    correct_index: 1,
    category: 'Parliamentary Procedures'
  },
  {
    question_text: 'Which of these is the correct way for a parliamentarian to address the assembly?',
    options: ['Mr. Speaker / Madam Speaker', 'Hey everyone', 'Distinguished guests', 'My friends'],
    correct_index: 0,
    category: 'Parliamentary Procedures'
  },
  {
    question_text: 'Daura LGA is historically famous as the spiritual home of which ethnic group?',
    options: ['Yoruba', 'Hausa', 'Igbo', 'Kanuri'],
    correct_index: 1,
    category: 'Local History'
  },
  {
    question_text: 'What is the legendary well in Daura associated with the Bayajidda legend?',
    options: ['Kusugu Well', 'Zuma Well', 'Gobirau Well', 'Hadejia Well'],
    correct_index: 0,
    category: 'Local History'
  },
  {
    question_text: 'What is a proposed law presented to parliament for debate called before it is passed?',
    options: ['An Act', 'A Resolution', 'A Bill', 'A Decree'],
    correct_index: 2,
    category: 'Parliamentary Procedures'
  },
  {
    question_text: 'What is the minimum number of members required to be present to conduct parliamentary business?',
    options: ['Majority', 'Quorum', 'Plurality', 'Session'],
    correct_index: 1,
    category: 'Parliamentary Procedures'
  },
  {
    question_text: 'Who is the current Emir of Daura (ruling since 2007)?',
    options: ['Alhaji Faruk Umar Faruk', 'Alhaji Muhammadu Kabir Usman', 'Alhaji Ado Bayero', 'Alhaji Shehu Idris'],
    correct_index: 0,
    category: 'Local Governance'
  },
  {
    question_text: 'In a parliamentary vote, what does it mean to "abstain"?',
    options: ['Vote in favor', 'Vote against', 'Choose not to vote either way', 'Vote twice'],
    correct_index: 2,
    category: 'Parliamentary Procedures'
  }
];

async function seed() {
  console.log('Checking database questions...');
  try {
    const { data: existing, error: qErr } = await supabase
      .from('questions')
      .select('id');
      
    if (qErr) {
      console.error('Error connecting to questions table:', qErr.message);
      return;
    }
    
    if (existing && existing.length > 0) {
      console.log(`Database already contains ${existing.length} questions. Skipping seed.`);
      return;
    }
    
    console.log('Seeding initial questions...');
    const { data, error: insertErr } = await supabase
      .from('questions')
      .insert(SEED_QUESTIONS)
      .select();
      
    if (insertErr) {
      console.error('Error inserting seed questions:', insertErr.message);
      return;
    }
    
    console.log(`Successfully seeded ${data.length} questions in the database!`);
  } catch (err) {
    console.error('Failed to seed database:', err.message);
  }
}

seed();
