const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xpziispstwarngpsmstd.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwemlpc3BzdHdhcm5ncHNtc3RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUyODc4NywiZXhwIjoyMDk0MTA0Nzg3fQ.HVNDvY8iwXuFvDfd0Oqii-8fWSavVEMNuapn7x9XArk';

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectStrings() {
    try {
        const { data, error } = await adminSupabase
            .from('companies')
            .select('dealer_code, user_code, name')
            .eq('dealer_code', 'ARTPAR007526');

        if (data && data.length > 0) {
            const comp = data[0];
            console.log("--- EXACT DB VALUES ---");
            console.log(`Dealer Code: '${comp.dealer_code}' (Length: ${comp.dealer_code.length})`);
            console.log(`User Code:   '${comp.user_code}'   (Length: ${comp.user_code.length})`);
            console.log(`Name:        '${comp.name}'`);
        } else {
            console.log("❌ No entry found for 'ARTPAR007526'. Searching for ALL companies...");
            const { data: all } = await adminSupabase.from('companies').select('dealer_code, user_code');
            console.log("All companies in DB:", all);
        }
    } catch (e) {
        console.error(e.message);
    }
}

inspectStrings();
