const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: prod } = await supabase.from('products').select('*').limit(1);
  if (prod && prod.length > 0) {
    console.log('Product Sütunları:', Object.keys(prod[0]));
  } else {
    console.log('Tablo boş.');
  }
}
inspect();
