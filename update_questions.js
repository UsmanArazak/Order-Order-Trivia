import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const s = createClient(url, key);

async function run() {
  console.log('Deleting old answers...');
  await s.from('answers').delete().neq('id', '0');

  console.log('Deleting old questions...');
  await s.from('questions').delete().neq('id', '0');

  const questions = [
    { question_text: 'What is a Parliament?', options: ['An assembly of elected representatives', 'A military command center', 'A private social club', 'A group of judges'], correct_index: 0 },
    { question_text: 'Who presides over a parliamentary sitting?', options: ['The Speaker', 'The President', 'The Chief Whip', 'The Clerk'], correct_index: 0 },
    { question_text: 'Who keeps the official records of a sitting?', options: ['The Clerk', 'The Secretary General', 'The Speaker', 'The Majority Leader'], correct_index: 0 },
    { question_text: 'What is a motion?', options: ['A formal proposal for debate', 'A physical movement in the House', 'An order from the Speaker', 'A signed law'], correct_index: 0 },
    { question_text: 'What is an Order Paper?', options: ['The daily agenda of business', 'A record of past decisions', 'A rulebook for members', 'A voting ballot'], correct_index: 0 },
    { question_text: 'Who moves a motion?', options: ['The Proposer', 'The Seconder', 'The Speaker', 'The Clerk'], correct_index: 0 },
    { question_text: 'Why must a motion be seconded?', options: ['To show support before debate', 'To immediately pass the motion', 'To challenge the Speaker', 'To record the vote'], correct_index: 0 },
    { question_text: 'What is the role of the Majority Leader?', options: ['To coordinate government business', 'To enforce discipline', 'To keep official records', 'To preside over the House'], correct_index: 0 },
    { question_text: 'What is the role of the Chief Whip?', options: ['To maintain member discipline', 'To present new laws', 'To manage House finances', 'To advise the Speaker'], correct_index: 0 },
    { question_text: 'What is a debate?', options: ['Formal discussion of a motion', 'A physical altercation', 'A private meeting of leaders', 'A direct order from the Speaker'], correct_index: 0 },
    { question_text: 'What does "quorum" mean?', options: ['Minimum members required to begin', 'Maximum members allowed to speak', 'A type of parliamentary vote', 'The end of a sitting'], correct_index: 0 },
    { question_text: 'How do you get permission to speak?', options: ['Stand and wait for the Speaker', 'Shout your name loudly', 'Walk to the center floor', 'Pass a note to the Clerk'], correct_index: 0 },
    { question_text: 'When is a Point of Order used?', options: ['When parliamentary rules are broken', 'When a member wants to leave', 'When a vote is tied', 'When introducing a guest'], correct_index: 0 },
    { question_text: 'What is a parliamentary vote?', options: ['Deciding to accept or reject a motion', 'Electing a new President', 'Choosing a seat in the House', 'Selecting the days agenda'], correct_index: 0 },
    { question_text: 'What does the Secretary General do?', options: ['Handles documents and admin duties', 'Leads the majority party', 'Forces members to attend', 'Resolves rule disputes'], correct_index: 0 },
    { question_text: 'What makes a good parliamentarian?', options: ['Discipline, respect, and confidence', 'Wealth and social status', 'Aggression and loudness', 'Ability to write fast'], correct_index: 0 },
    { question_text: 'Why speak only through the Speaker?', options: ['To maintain order and respect', 'To ensure the microphone is on', 'To waste debate time', 'To bypass the Chief Whip'], correct_index: 0 },
    { question_text: 'If a motion gets majority support, what happens?', options: ['It is passed by the House', 'It is debated again tomorrow', 'It is sent to the Clerk', 'It is immediately rejected'], correct_index: 0 },
    { question_text: 'Why form a Student Parliamentary Club?', options: ['To develop leadership and public speaking', 'To organize school parties', 'To bypass school exams', 'To protest against teachers'], correct_index: 0 },
    { question_text: 'What is the main aim of the Club?', options: ['Training in democratic values', 'Raising money for the school', 'Punishing misbehaving students', 'Playing political games'], correct_index: 0 }
  ];

  console.log('Inserting new questions...');
  const { data, error } = await s.from('questions').insert(questions);
  console.log('Done!', error);
}

run();
