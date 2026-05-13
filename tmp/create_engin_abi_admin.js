const { createClient } = require('@supabase/supabase-js');

// ENGIN ABI PROJECT CREDENTIALS
const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const dealerCode = 'ARTPAR007526';
const userCode = 'ARTPAR007526';
const password = 'Admin123!@#';
const email = 'engin@artpar.com'; // Unique email to avoid registration error

async function createAdmin() {
    try {
        console.log(`Creating Admin Account for Engin Abi...`);

        // 1. Create User in Auth
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { role: 'admin' }
        });

        if (authError) {
            console.log('Trying to find existing user...');
            const { data: { users } } = await adminSupabase.auth.admin.listUsers();
            userId = users.find(u => u.email === email)?.id;
            if (!userId) throw authError;
        } else {
            userId = authData.user.id;
        }

        // 2. Create Company entry
        const { data: companyData, error: companyError } = await adminSupabase
            .from('companies')
            .insert({
                name: 'ARTPAR OTOMOTİV (ADMİN)',
                dealer_code: dealerCode,
                user_code: userCode,
                email: email,
                tax_number: '0000000000',
                status: 'approved',
                address: 'Artvin, Merkez'
            })
            .select()
            .single();

        if (companyError) {
            if (companyError.message.includes('unique constraint')) {
                console.log('Company already exists, fetching data...');
                const { data: existingComp } = await adminSupabase.from('companies').select('*').eq('dealer_code', dealerCode).single();
                companyId = existingComp.id;
            } else {
                throw companyError;
            }
        } else {
            companyId = companyData.id;
        }

        // 3. Create Profile
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: userId,
                full_name: 'Engin Abi (Yönetici)',
                company_id: companyId,
                is_admin: true
            });

        if (profileError) throw profileError;

        console.log('\n✅ SUCCESS: Admin account created!');
        console.log(`Bayi Kodu: ${dealerCode}`);
        console.log(`Kullanıcı Kodu: ${userCode}`);
        console.log(`Şifre: ${password}`);
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
}

createAdmin();
