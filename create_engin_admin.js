const { createClient } = require('@supabase/supabase-js');

const enginUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const enginKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const supabase = createClient(enginUrl, enginKey);

async function createAdmin() {
    const dealerCode = 'ARTPAR007526';
    const userCode = 'ARTPAR007526';
    const email = 'artpar007526@artpar007526.com';
    const password = 'Admin123!@#';

    console.log("1. Creating auth.users record...");
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
    });

    if (userErr) {
        console.error("Error creating user:", userErr);
        if (userErr.status !== 422) return; // ignore if user already exists, but we need the ID then.
    }

    let userId;
    if (userData && userData.user) {
        userId = userData.user.id;
        console.log("User created with ID:", userId);
    } else {
        console.log("User already exists. Fetching ID...");
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const u = existingUser.users.find(u => u.email === email);
        if (!u) {
            console.error("Could not find user.");
            return;
        }
        userId = u.id;
        console.log("Found user ID:", userId);
    }

    console.log("2. Upserting into companies...");
    let companyId;
    const { data: existingComp } = await supabase.from('companies').select('*').eq('dealer_code', dealerCode);
    
    if (existingComp && existingComp.length > 0) {
        console.log("Company already exists. Updating...");
        const { data: updatedComp, error: updateErr } = await supabase.from('companies').update({
            name: 'ARTPAR MERKEZ',
            user_code: userCode,
            email: email,
            status: 'approved',
            contact_person: 'Admin',
            is_prepayment_locked: false
        }).eq('id', existingComp[0].id).select();
        
        if (updateErr) {
            console.error("Error updating company:", updateErr);
            return;
        }
        companyId = updatedComp[0].id;
    } else {
        console.log("Creating new company...");
        const { data: newComp, error: insertErr } = await supabase.from('companies').insert({
            name: 'ARTPAR MERKEZ',
            dealer_code: dealerCode,
            user_code: userCode,
            email: email,
            status: 'approved',
            tax_number: '-',
            phone: '-',
            contact_person: 'Admin',
            address: 'Merkez',
            is_prepayment_locked: false
        }).select();
        
        if (insertErr) {
            console.error("Error inserting company:", insertErr);
            return;
        }
        companyId = newComp[0].id;
    }

    console.log("Company created/found with ID:", companyId);

    console.log("3. Upserting into profiles...");
    const { data: profData, error: profErr } = await supabase.from('profiles').upsert({
        id: userId,
        company_id: companyId,
        full_name: 'Admin User',
        is_admin: true
    }).select();

    if (profErr) {
        console.error("Error updating profile:", profErr);
    } else {
        console.log("Profile updated successfully:", profData[0]);
        console.log("--- SUCCESS: Admin user created ---");
    }
}

createAdmin();