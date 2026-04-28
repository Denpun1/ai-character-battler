
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiyrlsbyrwlgagcvbklu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeXJsc2J5cndsZ2FnY3Zia2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg4NDcsImV4cCI6MjA5MTA3NDg0N30.ATybPp1-OaMRvMy8IgBx2_uZOJbdj8MBy0vSRqciCN0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Explicitly selecting participant_ids from battle_history...');
  const { data, error } = await supabase.from('battle_history').select('participant_ids').limit(1);
  if (error) {
    console.error('Column participant_ids DOES NOT EXIST or other error:', error.message);
  } else {
    console.log('Column participant_ids EXISTS. Sample:', data[0]);
  }

  console.log('\nExplicitly selecting participant_ids from battle_queue...');
  const { data: qData, error: qError } = await supabase.from('battle_queue').select('participant_ids').limit(1);
  if (qError) {
    console.error('Column participant_ids DOES NOT EXIST in battle_queue:', qError.message);
  } else {
    console.log('Column participant_ids EXISTS in battle_queue.');
  }
}

checkSchema();
