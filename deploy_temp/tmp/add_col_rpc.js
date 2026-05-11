const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Attempting to add is_campaign column via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS is_campaign BOOLEAN DEFAULT false;'
  });

  if (error) {
    console.error('RPC failed:', error.message);
    console.log('Fallback: Please run this manually in Supabase SQL Editor:');
    console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_campaign BOOLEAN DEFAULT false;');
  } else {
    console.log('Successfully added is_campaign column!');
  }
}

run();
