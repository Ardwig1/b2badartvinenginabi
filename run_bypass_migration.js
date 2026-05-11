const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const fileName = '016_showroom_bypass.sql';
    const sql = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
    console.log(`Applying ${fileName}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Error:', error.message);
        // Try another parameter name
        const { error: error2 } = await supabase.rpc('exec_sql', { query: sql });
        if (error2) console.error('Error (retry):', error2.message);
        else console.log('Success (via query parameter)!');
    } else {
        console.log('Success!');
    }
}

run();
