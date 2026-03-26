import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: triggers, error: tErr } = await supabase.rpc('get_table_triggers', { table_name: 'companies' });
    // If RPC doesn't exist, try direct query (though it might fail on public role)
    
    const { data: columns, error: cErr } = await supabase
        .from('companies')
        .select('*')
        .limit(1);

    return NextResponse.json({ 
        columns: data ? Object.keys(data[0]) : [],
        triggers: triggers || tErr?.message 
    });
}
