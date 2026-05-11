const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('cart_items').select('*').limit(1);
  if (error) {
    console.error('Hata:', error.message);
  } else {
    console.log('Sütunlar:', data.length > 0 ? Object.keys(data[0]) : 'Tablo boş, ama bağlandım.');
    // Eğer tablo boşsa, bir satır çekmeyi denemek yerine şemayı anlamak için farklı bir yol:
    const { data: cols, error: colError } = await supabase.rpc('list_columns', { table_name: 'cart_items' });
    if (!colError) console.log('RPC ile sütunlar:', cols);
  }
}
inspect();
