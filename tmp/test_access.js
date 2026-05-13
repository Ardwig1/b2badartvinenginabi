const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function testAsUser() {
    try {
        console.log("Testing data access for admin user...");
        
        const userId = 'cfa37b73-2b13-4d83-953d-04be8dadb1fe'; // Engin Abi's User ID
        
        // 1. Direct fetch as Admin (Service Role)
        const { data: profileAdmin } = await adminSupabase.from('profiles').select('is_admin, company:companies(status)').eq('id', userId).maybeSingle();
        console.log("Profile (Fetched as Service Role):", profileAdmin);

        // 2. Fetch companies directly
        const { data: compAdmin } = await adminSupabase.from('companies').select('*').limit(1);
        console.log("Company (Fetched as Service Role):", compAdmin);

        console.log("\nIf the above are null or have missing company data, it means the join or the record is problematic.");
    } catch (e) {
        console.error(e.message);
    }
}

testAsUser();
