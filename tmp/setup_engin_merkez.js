const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function setupEnginAdminAsCompany() {
    try {
        console.log("--- SETTING UP ENGIN ABI AS 'ARTPAR MERKEZ' (ADMIN) ---");

        const dealerCode = 'ARTPAR007526';
        const userCode = 'ARTPAR007526';
        const password = 'Admin123!@#';
        const email = 'engin@artpar.com';

        // 1. Ensure user exists in Auth
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        let user = users.find(u => u.email === email);
        
        if (!user) {
            console.log("Creating user in Auth...");
            const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
                email, password, email_confirm: true
            });
            if (authError) throw authError;
            user = authData.user;
        }

        // 2. Create/Update Company entry (lookup API needs this)
        const { data: existingComp } = await adminSupabase.from('companies').select('id').eq('dealer_code', dealerCode).maybeSingle();
        
        let companyId;
        if (existingComp) {
            const { error: updateError } = await adminSupabase
                .from('companies')
                .update({
                    name: 'ARTPAR MERKEZ',
                    user_code: userCode,
                    email: email,
                    status: 'approved'
                })
                .eq('id', existingComp.id);
            if (updateError) throw updateError;
            companyId = existingComp.id;
        } else {
            const { data: newComp, error: insertError } = await adminSupabase
                .from('companies')
                .insert({
                    name: 'ARTPAR MERKEZ',
                    dealer_code: dealerCode,
                    user_code: userCode,
                    email: email,
                    tax_number: '0000000000',
                    status: 'approved',
                    address: 'Artvin, Merkez'
                })
                .select()
                .single();
            if (insertError) throw insertError;
            companyId = newComp.id;
        }
        console.log("✅ Company 'ARTPAR MERKEZ' setup.");

        // 3. Update Profile: Link to company and set as Admin
        const { error: profError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: user.id,
                full_name: 'Admin',
                company_id: companyId,
                is_admin: true
            });

        if (profError) throw profError;
        console.log("✅ Profile linked and set to ADMIN.");

        console.log("\n--- SETUP COMPLETE ---");
        console.log("You can now login at enginb2b.vercel.app/login");

    } catch (e) {
        console.error("Setup Error:", e.message);
    }
}

setupEnginAdminAsCompany();
