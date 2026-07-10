import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
  const { data: questions } = await s.from('questions').select('*');
  console.log('Total questions fetched:', questions.length);

  for (const q of questions) {
    // Save the text of the currently correct answer so we can track it
    const correctAnswerText = q.options[q.correct_index];

    // Clone the options array so we can shuffle it safely
    let newOptions = [...q.options];

    // Fisher-Yates Shuffle on the options array
    for (let i = newOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newOptions[i], newOptions[j]] = [newOptions[j], newOptions[i]];
    }

    // Find the new index of the correct answer
    const newCorrectIndex = newOptions.indexOf(correctAnswerText);

    // Update the database
    const { error } = await s.from('questions')
      .update({ options: newOptions, correct_index: newCorrectIndex })
      .eq('id', q.id);

    if (error) {
      console.error('Failed to update question', q.id, error.message);
    } else {
      console.log(`Shuffled options for: "${q.question_text.substring(0, 30)}..." | New Correct Index: ${newCorrectIndex}`);
    }
  }

  console.log('Finished shuffling all options in the database!');
}

run();
