const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].replace(/['"]/g, '').trim();
    }
});

const { createClient } = require('@supabase/supabase-js');
const anonSupabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRLS() {
    console.log('\n--- TESTING ANON ACCESS (No Login) ---');

    // RLS in Supabase silently returns 0 rows on SELECT if blocked (it doesn't throw an error).
    // To truly test if it's blocked, we try to INSERT or UPDATE.

    const collections = ['companies', 'profiles', 'invoices', 'products'];

    for (const table of collections) {
        const { error } = await anonSupabase.from(table).insert([{ id: 'test-uuid-bypass' }]);

        if (error && error.code === '42501') {
            console.log(`[${table}] INSERT Access: BLOCKED (RLS Active) -> SAFE`);
        } else if (error) {
            console.log(`[${table}] INSERT Access: Error (${error.message})`);
        } else {
            console.log(`[${table}] INSERT Access: ALLOWED -> VULNERABLE!`);
        }
    }
}

checkRLS();
