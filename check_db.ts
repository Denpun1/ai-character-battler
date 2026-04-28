
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiyrlsbyrwlgagcvbklu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeXJsc2J5cndsZ2FnY3Zia2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg4NDcsImV4cCI6MjA5MTA3NDg0N30.ATybPp1-OaMRvMy8IgBx2_uZOJbdj8MBy0vSRqciCN0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueueColumns() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'battle_queue' });
  // Since I don't have rpc, I'll try to insert a dummy row with participant_ids and see if it fails
  console.log('Testing insert into battle_queue with participant_ids...');
  const { error: insertError } = await supabase.from('battle_queue').insert({
    user_id: 'test_user',
    p1_id: '00000000-0000-0000-0000-000000000000',
    p2_id: '00000000-0000-0000-0000-000000000000',
    participant_ids: ['00000000-0000-0000-0000-000000000000'],
    status: 'pending',
    created_at: Date.now()
  });
  
  if (insertError) {
    console.error('Insert failed:', insertError.message);
  } else {
    console.log('Insert SUCCESS. participant_ids exists in battle_queue.');
    // Clean up
    await supabase.from('battle_queue').delete().eq('user_id', 'test_user');
  }
}

checkQueueColumns();
