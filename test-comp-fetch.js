import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFetch() {
    // get a random company
    const { data: companies, error: cErr } = await supabase.from('companies').select('*').limit(1);
    console.log("Random company fetch info:", companies && companies.length, cErr);

    if (companies && companies.length > 0) {
        const id = companies[0].id;
        console.log("Testing with company:", id);
        const { data, error } = await supabase.from('companies').select('*, profiles(email)').eq('id', id).single();
        console.log("Fetch with profiles:", data, error);

        // Let's also test activities
        const { data: actData, error: actErr } = await supabase.from('user_activities').select('*').eq('company_id', id).limit(1);
        console.log("Activities fetch:", actData, actErr);
    }
}

testFetch();
