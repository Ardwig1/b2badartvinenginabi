const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.rpc('query_sql', { 
        sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'products'" 
    });
    if (error) {
        // If query_sql doesn't exist, try a different approach
        const { data: cols, error: err2 } = await supabase.from('products').select().limit(0);
        console.log("Error fetching columns via RPC, trying select limit 0...");
        // This might not work if table is empty.
    }
    console.log("Data:", data);
}
check();