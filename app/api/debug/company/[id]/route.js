import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { id } = await params;
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: company, error } = await supabase
        .from('companies')
        .select('id, name, is_prepayment_locked, current_balance, risk_limit')
        .eq('id', id)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ company });
}
