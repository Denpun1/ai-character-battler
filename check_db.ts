
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiyrlsbyrwlgagcvbklu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeXJsc2J5cndsZ2FnY3Zia2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg4NDcsImV4cCI6MjA5MTA3NDg0N30.ATybPp1-OaMRvMy8IgBx2_uZOJbdj8MBy0vSRqciCN0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueue() {
  const { data: queue, error } = await supabase.from('battle_queue').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${queue.length} items in queue.`);
    queue.forEach(q => {
      console.log(`ID: ${q.id}, Status: ${q.status}, CreatedAt: ${q.created_at}`);
    });
  }
}

checkQueue();
