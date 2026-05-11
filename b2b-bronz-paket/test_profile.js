require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, full_name, phone, company_id, companies(name)').limit(10);
  console.log("PROFILES:", JSON.stringify(profiles, null, 2));
  if (error) console.error("ERR:", error);
}

check();
