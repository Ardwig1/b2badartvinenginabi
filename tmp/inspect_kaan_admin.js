const { createClient } = require('@supabase/supabase-js');

// KAAN ABI PROJECT CREDENTIALS (from project memory/env)
const supabaseUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const kaanSupabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectKaanAdmin() {
    try {
        console.log("Checking Kaan Abi's Admin record...");
        
        // Find the admin user first
        const { data: { users } } = await kaanSupabase.auth.admin.listUsers();
        console.log("Total users in Kaan's Auth:", users.length);
        
        for (const u of users) {
            const { data: profile } = await kaanSupabase.from('profiles').select('*, company:companies(*)').eq('id', u.id).maybeSingle();
            if (profile?.is_admin) {
                console.log("FOUND KAAN ADMIN:", u.email);
                console.log("Profile:", profile);
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}

inspectKaanAdmin();
