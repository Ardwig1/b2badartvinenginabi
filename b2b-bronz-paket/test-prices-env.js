import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('products').select('id, name, list_price, currency').limit(15);
    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));
}
check();
