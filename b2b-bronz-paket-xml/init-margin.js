import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: existing } = await supabase.from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').single();
    if (!existing) {
        const { error } = await supabase.from('price_groups').insert({
            name: 'GLOBAL_PROFIT_MARGIN',
            discount_percent: 36 // this represents the margin percentage
        });
        console.log('Inserted GLOBAL_PROFIT_MARGIN: 36', error);
    } else {
        console.log('Already exists:', existing);
    }
}
run();
