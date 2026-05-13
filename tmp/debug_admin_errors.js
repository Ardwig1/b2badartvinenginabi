const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function debugSettings() {
    try {
        console.log("Checking site_settings table...");
        const { data, error } = await adminSupabase.from('site_settings').select('*');
        if (error) {
            console.error("Table Error:", error.message);
        } else {
            console.log("Table Data:", data);
        }

        console.log("\nChecking customer_representatives table...");
        const { data: reps, error: repsError } = await adminSupabase.from('customer_representatives').select('*').order('first_name');
        if (repsError) {
            console.error("Reps Error:", repsError.message);
        } else {
            console.log("Reps Count:", reps?.length);
        }
    } catch (e) {
        console.error("Debug Error:", e.message);
    }
}

debugSettings();
