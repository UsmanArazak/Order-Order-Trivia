import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
  const { data } = await s.from('questions').select('id, question_text');
  console.log('Total questions:', data.length);
  
  const newTexts = [
    'What is a Parliament?',
    'Who presides over a parliamentary sitting?',
    'Who keeps the official records of a sitting?',
    'What is a motion?',
    'What is an Order Paper?',
    'Who moves a motion?',
    'Why must a motion be seconded?',
    'What is the role of the Majority Leader?',
    'What is the role of the Chief Whip?',
    'What is a debate?',
    'What does "quorum" mean?',
    'How do you get permission to speak?',
    'When is a Point of Order used?',
    'What is a parliamentary vote?',
    'What does the Secretary General do?',
    'What makes a good parliamentarian?',
    'Why speak only through the Speaker?',
    'If a motion gets majority support, what happens?',
    'Why form a Student Parliamentary Club?',
    'What is the main aim of the Club?'
  ];
  
  const toDelete = data.filter(q => !newTexts.includes(q.question_text));
  console.log('Found', toDelete.length, 'old questions to delete.');
  
  for (const oldQ of toDelete) {
    const { error } = await s.from('questions').delete().eq('id', oldQ.id);
    if (error) {
      console.error('Failed to delete', oldQ.id, error.message);
    } else {
      console.log('Deleted:', oldQ.question_text);
    }
  }
}

run();
