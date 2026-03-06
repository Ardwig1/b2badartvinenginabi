import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("ANON:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + "...");
console.log("ROLE:", process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + "...");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.replace(/"/g, '').trim();

console.log("Clean URL:", url);
console.log("Clean KEY:", key.substring(0, 10) + "...");

const supabase = createClient(url, key);

async function test() {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    console.log("Result:", data);
    console.log("Error:", error);
}

test();
