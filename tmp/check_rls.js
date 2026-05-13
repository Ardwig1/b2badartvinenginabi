const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function checkRLS() {
    try {
        console.log("Checking RLS Policies for Profiles and Companies...");
        
        const { data, error } = await adminSupabase.rpc('exec_sql', { 
            sql_query: "SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public';" 
        });

        if (error) {
            console.error("RPC Error:", error.message);
            // Try information_schema as fallback
            const { data: data2 } = await adminSupabase.from('profiles').select('*').limit(1);
            console.log("Profiles test fetch (should succeed with service role):", !!data2);
            return;
        }

        console.table(data);
    } catch (e) {
        console.error(e.message);
    }
}

checkRLS();
