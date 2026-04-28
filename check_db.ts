
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiyrlsbyrwlgagcvbklu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeXJsc2J5cndsZ2FnY3Zia2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg4NDcsImV4cCI6MjA5MTA3NDg0N30.ATybPp1-OaMRvMy8IgBx2_uZOJbdj8MBy0vSRqciCN0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  const tables = ['user_settings', 'setting_presets', 'battle_history', 'battle_queue', 'characters', 'items'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Table ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`Table ${table}: OK. Sample keys: ${Object.keys(data[0] || {}).join(', ')}`);
    }
  }
}

checkAllTables();
