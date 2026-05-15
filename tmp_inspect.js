import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fjkasgelauwnsfoqecov.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb2Vjb3YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcyMjkyNzA3LCJleHAiOjIwODc4Njg3MDd9.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI');

async function inspect() {
    try {
        const { data: comp, error: cErr } = await supabase.from('companies').select('*').limit(1);
        const { data: ord, error: oErr } = await supabase.from('orders').select('*').limit(1);
        if (cErr) console.error('CERR:', cErr);
        if (oErr) console.error('OERR:', oErr);
        console.log('COMPANY COLS:', Object.keys(comp?.[0] || {}));
        console.log('ORDER COLS:', Object.keys(ord?.[0] || {}));
    } catch (e) {
        console.error('EX:', e);
    }
}
inspect();
