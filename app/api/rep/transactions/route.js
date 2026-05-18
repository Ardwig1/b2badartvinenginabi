import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyRepAndCompany(repId, companyId) {
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data } = await adminSupabase
        .from('representative_assignments')
        .select('company_id')
        .eq('representative_id', repId)
        .eq('company_id', companyId)
        .maybeSingle();
    return !!data;
}

export async function POST(req) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const isRep = user.user_metadata?.role === 'representative';
    if (!isRep) return NextResponse.json({ error: 'Sadece temsilciler bu endpoint\'i kullanabilir.' }, { status: 403 });

    const body = await req.json();
    const { companyId, type, amount, description, documentNo } = body;

    const val = parseFloat(amount);
    if (!companyId || isNaN(val) || val <= 0 || !['debt', 'credit'].includes(type)) {
        return NextResponse.json({ error: 'Eksik veya geçersiz parametreler' }, { status: 400 });
    }

    const hasAccess = await verifyRepAndCompany(user.id, companyId);
    if (!hasAccess) return NextResponse.json({ error: 'Bu firmaya erişim yetkiniz yok.' }, { status: 403 });

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const debt = type === 'debt' ? val : 0;
    const credit = type === 'credit' ? val : 0;

    const { data: comp, error: compErr } = await adminSupabase.from('companies').select('current_balance').eq('id', companyId).single();
    if (compErr) return NextResponse.json({ error: 'Firma bulunamadı' }, { status: 400 });

    let newBalance = parseFloat(comp.current_balance || 0);
    if (type === 'debt') newBalance -= val;
    else newBalance += val;

    const { data: lastTx } = await adminSupabase
        .from('account_transactions')
        .select('balance_after')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const prevBalance = lastTx ? parseFloat(lastTx.balance_after || 0) : 0;
    const balanceAfter = type === 'debt' ? prevBalance - val : prevBalance + val;

    const { error: txErr } = await adminSupabase.from('account_transactions').insert({
        company_id: companyId,
        transaction_type: type === 'debt' ? 'BORÇ' : 'TAHSİLAT',
        description: description || (type === 'debt' ? 'Borçlandırma' : 'Tahsilat'),
        document_no: documentNo || null,
        debt,
        credit,
        balance_after: balanceAfter,
    });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 400 });

    await adminSupabase.from('companies').update({ current_balance: newBalance }).eq('id', companyId);

    return NextResponse.json({ success: true });
}
