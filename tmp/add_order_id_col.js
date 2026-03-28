const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Adding order_id column to account_transactions...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);`
  });

  if (error) {
    console.error('Error adding column:', error.message);
  } else {
    console.log('Column added successfully or already exists.');
  }
}

run();
