const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    try {
        console.log("--- INSPECTING REPS SCHEMA ---");
        
        // 1. Basic fetch to see if it even works
        const { data: reps, error: err1 } = await adminSupabase.from('customer_representatives').select('*').limit(1);
        if (err1) console.error("Reps Basic Fetch Error:", err1.message);
        else console.log("Reps Columns:", Object.keys(reps[0] || {}));

        // 2. Check assignments table
        const { data: assign, error: err2 } = await adminSupabase.from('representative_assignments').select('*').limit(1);
        if (err2) console.error("Assignments Basic Fetch Error:", err2.message);
        else console.log("Assignments Columns:", Object.keys(assign[0] || {}));

        // 3. Try the EXACT query that fails with 400
        const { data: complex, error: err3 } = await adminSupabase
            .from('customer_representatives')
            .select('*, assignments:representative_assignments(company_id, companies(name))')
            .order('first_name');
        
        if (err3) {
            console.error("❌ COMPLEX QUERY FAILED (400):", err3.message);
            console.log("Hint:", err3.hint);
            console.log("Details:", err3.details);
        } else {
            console.log("✅ Complex query actually worked in node!");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

inspectSchema();
