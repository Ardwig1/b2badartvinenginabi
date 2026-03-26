import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ orders });
}
