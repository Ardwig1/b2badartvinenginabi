const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function finalReconstruction() {
    try {
        console.log("--- RECONSTRUCTING ADMIN ON FRESH DATABASE ---");

        const dealerCode = 'ARTPAR007526';
        const userCode = 'ARTPAR007526';
        const password = 'Admin123!@#';
        const email = 'engin@artpar.com';

        // 1. Check/Create User in Auth
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        let user = users.find(u => u.email === email);
        
        if (!user) {
            console.log("Creating Admin Auth User...");
            const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
                email, password, email_confirm: true
            });
            if (authError) throw authError;
            user = authData.user;
        } else {
            console.log("Admin Auth User exists, updating password just in case...");
            await adminSupabase.auth.admin.updateUserById(user.id, { password });
        }

        // 2. Create 'ARTPAR MERKEZ' Company
        const { data: company, error: compError } = await adminSupabase
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

        if (compError) {
            console.log("Company might already exist, attempting update...");
            const { data: updComp } = await adminSupabase.from('companies').update({ status: 'approved', name: 'ARTPAR MERKEZ' }).eq('dealer_code', dealerCode).select().single();
            companyId = updComp?.id;
        } else {
            companyId = company.id;
        }

        // 3. Create Profile and set Admin flag
        const { error: profError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: user.id,
                full_name: 'Admin',
                company_id: companyId,
                is_admin: true
            });

        if (profError) throw profError;
        console.log("✅ Admin profile successfully linked and activated.");

        console.log("\n--- EVERYTHING IS READY ---");
        console.log(`URL: https://enginb2b.vercel.app/login`);
        console.log(`Dealer: ${dealerCode} / User: ${userCode} / Pass: ${password}`);

    } catch (e) {
        console.error("Reconstruction Error:", e.message);
    }
}

finalReconstruction();
