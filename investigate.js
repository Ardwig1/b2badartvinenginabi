const { createClient } = require('@supabase/supabase-js');

const kaanUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const kaanKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(kaanUrl, kaanKey);

async function run() {
    console.log("--- Checking companies ---");
    const { data: comp, error: compErr } = await supabase.from('companies').select('*').eq('dealer_code', 'B-1000').eq('user_code', 'ADMIN');
    if (compErr) console.error(compErr);
    console.log(JSON.stringify(comp, null, 2));

    console.log("--- Checking representatives ---");
    const { data: rep, error: repErr } = await supabase.from('customer_representatives').select('*').eq('dealer_code', 'B-1000').eq('user_code', 'ADMIN');
    if (repErr) console.error(repErr);
    console.log(JSON.stringify(rep, null, 2));

    if (comp && comp.length > 0) {
        console.log("--- Checking profiles ---");
        const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('company_id', comp[0].id);
        if (profErr) console.error(profErr);
        console.log(JSON.stringify(prof, null, 2));

        if (prof && prof.length > 0) {
            console.log("--- Checking auth.users ---");
            for (const p of prof) {
                const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(p.id);
                if (authErr) console.error(authErr);
                console.log(JSON.stringify(authUser?.user, null, 2));
            }
        }
    }
}
run();