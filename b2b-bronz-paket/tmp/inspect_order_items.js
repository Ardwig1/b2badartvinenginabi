const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: items } = await supabase.from('order_items').select('*').limit(1);
  console.log('Order Items Sütunlar:', items && items.length > 0 ? Object.keys(items[0]) : 'Boş');
}
inspect();
