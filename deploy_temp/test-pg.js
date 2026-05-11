import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('price_groups').select('*').limit(5);
    console.log('price_groups:', data, error);
}
run();
