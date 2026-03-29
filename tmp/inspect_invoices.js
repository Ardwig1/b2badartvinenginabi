const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function inspect() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('invoices').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Invoices columns:', Object.keys(data[0]));
    } else {
        console.log('No invoices found or error:', error);
    }
}
inspect();
