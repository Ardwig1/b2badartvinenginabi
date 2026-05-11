const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Adding is_campaign column to products...');
  // Note: Supabase JS client doesn't support ALTER TABLE directly. 
  // I will try to update a non-existent row with is_campaign to test if it exists.
  // Actually, I'll use the 'rest' api via fetch to run SQL if the SQL editor API is exposed, 
  // but it's usually not. 
  // Most B2B projects I work on have a 'rpc' for executing SQL or I just use the Dashboard.
  // Since I can't use the Dashboard, I'll try to use a simple 'update' to see if it fails.
  
  const { error } = await supabase
    .from('products')
    .select('is_campaign')
    .limit(1);

  if (error && error.message.includes('column "is_campaign" does not exist')) {
    console.log('Column does not exist. Please add it manually via Supabase Dashboard SQL Editor:');
    console.log('ALTER TABLE products ADD COLUMN is_campaign BOOLEAN DEFAULT false;');
    // I will attempt to use an RPC if it exists, but I don't know if it does.
    // For now, I'll just assume I can't do it via script if there's no SQL RPC.
    // I'll check if there's an 'exec_sql' rpc common in these projects.
  } else if (!error) {
    console.log('Column already exists.');
  } else {
    console.error('Error checking column:', error.message);
  }
}

run();
