const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function checkUser() {
    try {
        console.log("Checking database for ARTPAR007526...");
        
        const { data, error } = await adminSupabase
            .from('companies')
            .select('*')
            .eq('dealer_code', 'ARTPAR007526')
            .maybeSingle();

        if (error) {
            console.error("DB Error:", error.message);
            return;
        }

        if (!data) {
            console.log("❌ Company NOT FOUND with dealer_code 'ARTPAR007526'");
            
            // List all companies to see what we have
            const { data: all } = await adminSupabase.from('companies').select('dealer_code, user_code, name').limit(5);
            console.log("Existing companies in DB:", all);
        } else {
            console.log("✅ Company FOUND:", data);
        }
    } catch (e) {
        console.error("Unexpected error:", e.message);
    }
}

checkUser();
