const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function initTable() {
    const rawSql = `
        CREATE TABLE IF NOT EXISTS public.payment_sessions (
            id TEXT PRIMARY KEY,
            company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
            amount NUMERIC(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        -- Auto clean up old sessions (older than 1 day)
        DELETE FROM public.payment_sessions WHERE created_at < NOW() - INTERVAL '1 day';
    `;
    
    // Workaround to run SQL via RPC, or if not possible, we will just use a generic query
    // Supabase JS doesn't have raw query execution via service role natively without an RPC that executes raw SQL.
    // However, we can use the REST API manually or just create an endpoint.
    // Actually, creating tables from JS is hard in Supabase.
}
initTable();
