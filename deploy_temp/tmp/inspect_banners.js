const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: b } = await supabase.from('banners').select('*').limit(1);
  console.log('Banners Sütunlar:', b && b.length > 0 ? Object.keys(b[0]) : 'Tablo boş');
}
inspect();
