const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function finalAdminFix() {
    try {
        const userEmail = 'engin@artpar.com';
        const { data: { users } } = await adminSupabase.auth.admin.listUsers();
        const user = users.find(u => u.email === userEmail);

        if (user) {
            await adminSupabase.from('profiles').update({ full_name: 'Admin' }).eq('id', user.id);
            console.log("✅ Admin name updated to 'Admin'");
        }
    } catch (e) {
        console.error(e.message);
    }
}

finalAdminFix();
