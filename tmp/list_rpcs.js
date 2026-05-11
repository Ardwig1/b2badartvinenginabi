const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('inspect_rpcs'); // Guessing if there's one
  if (error) {
    console.error('Error listing RPCs:', error.message);
    // Try querying pg_proc via rest if possible
    const { data: procs, error: procError } = await supabase.from('pg_proc').select('proname').limit(10);
    if (procError) console.error('Error querying pg_proc:', procError.message);
    else console.log('RPCs (guess):', procs);
  } else {
    console.log('Available RPCs:', data);
  }
}

run();
