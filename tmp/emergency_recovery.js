const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function emergencyRecovery() {
    try {
        console.log("--- EMERGENCY DATA CHECK ---");
        
        // 1. Check Auth Users
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        console.log(`Auth Users Count: ${users.length}`);
        const enginUser = users.find(u => u.email === 'engin@artpar.com');
        console.log(`Admin User (${enginUser?.email}): ${enginUser ? 'EXISTS' : 'NOT FOUND'}`);

        // 2. Check Profiles
        const { data: profiles } = await adminSupabase.from('profiles').select('*');
        console.log(`Profiles Count: ${profiles?.length || 0}`);
        console.log("Profiles list:", profiles);

        // 3. Check Companies
        const { data: companies } = await adminSupabase.from('companies').select('dealer_code, name, status');
        console.log(`Companies Count: ${companies?.length || 0}`);
        console.log("Companies list:", companies);

        if (enginUser && (!profiles || profiles.length === 0)) {
            console.log("CRITICAL: Profiles table is empty but Auth users exist. Restoring admin profile...");
            // Find a company to link to if necessary, or keep null
            await adminSupabase.from('profiles').upsert({
                id: enginUser.id,
                full_name: 'Admin',
                is_admin: true
            });
            console.log("✅ Admin profile restored.");
        }

    } catch (e) {
        console.error("Recovery Error:", e.message);
    }
}

emergencyRecovery();
