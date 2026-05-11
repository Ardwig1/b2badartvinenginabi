import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/"/g, '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProducts() {
    console.log("Using ANON key...");
    const { data: allData, error: allError } = await supabase.from('products').select('*').limit(5);
    console.log("All products (ANON limit 5):", allData?.length, "Error:", allError);
}

debugProducts();
