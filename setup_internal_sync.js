const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function setup() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("🛠️  Setting up sync tracking table...");
    
    // Create the table via a simple check or RPC if available
    // If we can't create it programmatically, we'll use an existing one like 'site_settings'
    // Let's use 'site_settings' as it's safer and already exists.
    
    const { error } = await supabase.from('site_settings').upsert({
        setting_key: 'last_xml_sync',
        setting_value: { date: '1970-01-01', status: 'idle' }
    });

    if (error) console.error("Setup error:", error.message);
    else console.log("✅ Sync tracking initialized in site_settings.");
}
setup();
