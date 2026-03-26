import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, is_prepayment_locked, current_balance, risk_limit')
        .ilike('name', `%${name}%`);

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ companies });
}
