
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiyrlsbyrwlgagcvbklu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeXJsc2J5cndsZ2FnY3Zia2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg4NDcsImV4cCI6MjA5MTA3NDg0N30.ATybPp1-OaMRvMy8IgBx2_uZOJbdj8MBy0vSRqciCN0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: queue, error } = await supabase.from('battle_queue').select('*').limit(1);
  if (error) {
     console.error('Fetch error:', error.message);
  } else if (queue && queue.length > 0) {
     console.log('Sample created_at:', queue[0].created_at, 'Type:', typeof queue[0].created_at);
  } else {
     console.log('Queue empty, cannot determine type.');
  }
}

checkSchema();
