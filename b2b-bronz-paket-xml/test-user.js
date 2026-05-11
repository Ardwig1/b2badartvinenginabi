const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

const adminSupabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdminCompany() {
    console.log('\n--- CREATING ADMIN COMPANY ---');

    // 1. Get the admin user from auth.users
    const { data: { users }, error: userErr } = await adminSupabase.auth.admin.listUsers();
    if (userErr) return console.error("Error fetching auth users:", userErr.message);

    const adminUser = users.find(u => u.email === 'muratkaan@omigroups.com');
    if (!adminUser) return console.log("Admin user not found in auth.users");

    console.log(`Found admin user: ${adminUser.id} (${adminUser.email})`);

    // 2. Check if company already exists to avoid duplicates
    const { data: existingProfile } = await adminSupabase.from('profiles').select('company_id').eq('id', adminUser.id).single();
    if (existingProfile?.company_id) {
        console.log("Admin profile already linked to a company:", existingProfile.company_id);
        const { data: c } = await adminSupabase.from('companies').select('*').eq('id', existingProfile.company_id).single();
        console.log(c);
        return;
    }

    // 3. Create the company explicitly for the admin with a default static Bayi Kodu
    const defaultDealerCode = 'B-0000';
    const defaultUserCode = 'ADMIN';

    const { data: newCompany, error: compErr } = await adminSupabase.from('companies').insert({
        name: 'OMİ YEDEK PARÇA (MERKEZ)',
        tax_number: '800081338',
        address: 'SOĞUKPINAR MAH. IHLAMUR CAD. NO:37 ÇEKMEKÖY / İSTANBUL',
        phone: '0532 597 0664',
        email: 'muratkaan@omigroups.com',
        contact_person: 'Murat Kaan',
        status: 'approved',
        tax_office: 'Sarıgazi VD.',
        city: 'İSTANBUL',
        district: 'ÇEKMEKÖY',
        branch: 'Merkez',
        dealer_code: defaultDealerCode,
        user_code: defaultUserCode
    }).select().single();

    if (compErr) {
        return console.error("Failed to create company:", compErr.message);
    }

    console.log("Created Company:", newCompany.id);

    // 4. Link company to admin's profile
    const { error: profErr } = await adminSupabase.from('profiles').update({
        company_id: newCompany.id
    }).eq('id', adminUser.id);

    if (profErr) {
        return console.error("Failed to link company to profile:", profErr.message);
    }

    console.log(`\nSUCCESS! Admin is now fully set up.`);
    console.log(`Login Credentials:`);
    console.log(`Bayi Kodu: ${defaultDealerCode}`);
    console.log(`Kullanıcı Kodu: ${defaultUserCode}`);
    console.log(`Şifre: (The original password used to create the muratkaan@omigroups.com account)`);
}

createAdminCompany();
