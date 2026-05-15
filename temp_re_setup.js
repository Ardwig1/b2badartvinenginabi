const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
    const createFunc = `
    CREATE OR REPLACE FUNCTION public.query_sql(sql_query text)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE
      result jsonb;
    BEGIN
      EXECUTE 'SELECT jsonb_agg(to_jsonb(t)) FROM (' || sql_query || ') t' INTO result;
      RETURN result;
    END;
    $$;
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: createFunc });
    console.log('Setup RPC:', data, error);
    
    console.log('Reloading schema...');
    await supabase.rpc('exec_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
    await new Promise(r => setTimeout(r, 2000));
}
setup();
