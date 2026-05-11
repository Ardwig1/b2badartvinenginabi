const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, '013_fix_order_auth.sql'), 'utf8');
    console.log('Applying fix...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Error applying fix:', error.message);
        // Try another parameter name if sql_query is not it
        const { error: error2 } = await supabase.rpc('exec_sql', { query: sql });
        if (error2) console.error('Error applying fix (query):', error2.message);
        else console.log('Fix applied successfully (query)!');
    } else {
        console.log('Fix applied successfully!');
    }
}

run();
