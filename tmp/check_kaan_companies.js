const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const kaanSupabase = createClient(supabaseUrl, serviceRoleKey);

async function checkCompanies() {
    const { data } = await kaanSupabase.from('companies').select('dealer_code, name').limit(10);
    console.log("Kaan's Companies Sample:", data);
}

checkCompanies();
