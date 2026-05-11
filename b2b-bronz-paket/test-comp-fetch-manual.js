import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fjkasgelauwnsfoqecov.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb2Vjb3YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcyMjkyNzA3LCJleHAiOjIwODc4Njg3MDd9.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI'
);

async function testFetch() {
    // get a random company
    const { data: companies, error: cErr } = await supabase.from('companies').select('*').limit(1);
    console.log("Random company fetch err:", cErr);

    if (companies && companies.length > 0) {
        const id = companies[0].id;
        console.log("Testing with company:", id);
        {
            const { data, error } = await supabase.from('companies').select('*, profiles(email)').eq('id', id).single();
            console.log("Fetch with profiles:", data, error);
        }
        {
            const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
            console.log("Fetch without profiles:", data ? data.id : null, error);
        }
    }
}

testFetch();
