const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function findDefectiveCompany() {
    console.log('\n--- FINDING NEWEST COMPANY ---');

    // Use anon key for now if service role is busted to just read public company profiles
    const { data: companies, error: compErr } = await adminSupabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (compErr) {
        return console.error("Error fetching companies:", compErr);
    }

    if (companies.length === 0) {
        console.log("No companies found.");
        return;
    }

    console.log("Latest companies:");
    for (const c of companies) {
        console.log(`\nID: ${c.id}`);
        console.log(`Name: ${c.name}`);
        console.log(`Dealer Code: ${c.dealer_code}`);
        console.log(`User Code: ${c.user_code}`);
        console.log(`Email: ${c.email}`);

        // Let's also check if an auth user exists for this email
        const { data: profiles } = await adminSupabase.from('profiles').select('*').eq('company_id', c.id);
        console.log(`Linked Profiles: ${profiles?.length || 0}`);
    }
}

findDefectiveCompany();
