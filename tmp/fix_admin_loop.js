const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function fixAdminRights() {
    try {
        console.log("--- REFRESHING ADMIN RIGHTS ---");
        
        // 1. Find the company
        const { data: company } = await adminSupabase
            .from('companies')
            .select('id')
            .eq('dealer_code', 'ARTPAR007526')
            .single();

        if (!company) {
            console.error("Company not found!");
            return;
        }
        console.log(`Found Company ID: ${company.id}`);

        // 2. Find the user by email
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        const user = users.find(u => u.email === 'engin@artpar.com');

        if (!user) {
            console.error("User not found in Auth!");
            return;
        }
        console.log(`Found User ID: ${user.id}`);

        // 3. FORCE Update Profile with Admin Rights
        const { error: profError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: user.id,
                company_id: company.id,
                full_name: 'Engin Abi (Yönetici)',
                is_admin: true
            });

        if (profError) {
            console.error("Profile update error:", profError.message);
        } else {
            console.log("✅ Profile updated with IS_ADMIN: TRUE");
        }

        // 4. Force Update Company Status (Just in case)
        await adminSupabase
            .from('companies')
            .update({ status: 'approved' })
            .eq('id', company.id);
        
        console.log("✅ Company status forced to APPROVED");
        console.log("\nDONE! Please try logging in again.");

    } catch (e) {
        console.error("Unexpected error:", e.message);
    }
}

fixAdminRights();
