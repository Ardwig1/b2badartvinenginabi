import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].replace(/['"\r]/g, '').trim();
    }
});

const adminSupabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
    console.log("Fetching PAYTR company...");
    const { data: comp } = await adminSupabase.from('companies').select('*').ilike('dealer_code', 'PAYTR').single();
    if (!comp) return console.log("PAYTR company not found.");

    console.log("Company found:", comp.id, "email:", comp.email);
    const { data: users, error: uErr } = await adminSupabase.auth.admin.listUsers();
    if (uErr) return console.log("Error listing users:", uErr.message);

    const user = users.users.find(u => u.email === comp.email);
    if (!user) return console.log("Auth user not found for", comp.email);

    console.log("User found:", user.id);

    const { error: upsertErr } = await adminSupabase.from('profiles').upsert({
        id: user.id,
        company_id: comp.id,
        full_name: comp.contact_person,
        is_admin: false
    });

    if (upsertErr) console.error("Error upserting profile:", upsertErr.message);
    else console.log("Successfully fixed profile for PAYTR");
}

fix();
