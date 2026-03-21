import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const body = await req.json();
        const { companyId, type, amount, description, documentNo } = body;

        const val = parseFloat(amount);
        if (!companyId || isNaN(val) || val <= 0 || !['debt', 'credit'].includes(type)) {
            return NextResponse.json({ error: 'Eksik veya geçersiz parametreler' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        let debt = 0;
        let credit = 0;
        
        // debt: Borçlandır (Müşteri bize borçlanır, Bakiye düşer)
        // credit: Alacaklandır/Tahsilat (Müşteri ödeme yapar, Bakiye artar)
        if (type === 'debt') {
            debt = val;
        } else {
            credit = val;
        }

        // 1. Get current balance
        const { data: comp, error: compErr } = await supabase.from('companies').select('current_balance').eq('id', companyId).single();
        if (compErr) throw new Error('Firma bulunamadı');

        let newBalance = parseFloat(comp.current_balance || 0);
        if (type === 'debt') {
            newBalance -= val; // Borçlandırma bakiyeyi eksiltir
        } else {
            newBalance += val; // Alacaklandırma / Tahsilat bakiyeyi artırır
        }

        // 2. Update company
        const { error: updErr } = await supabase.from('companies').update({ current_balance: newBalance }).eq('id', companyId);
        if (updErr) throw new Error('Bakiye güncellenemedi');

        // 3. Insert into account_transactions
        let txType = type === 'debt' ? 'KREDİLİ İŞLEM (BORÇ)' : 'TAHSİLAT (NKT/BNK)';
        if (description?.toLowerCase().includes('toptan satış') || description?.toLowerCase().includes('fatura')) txType = 'TOPTAN SATIŞ';
        if (description?.toLowerCase().includes('iade') || description?.toLowerCase().includes('iptal')) txType = 'İPTAL / İADE';
        if (description?.toLowerCase().includes('kredi kartı') || description?.toLowerCase().includes('pos')) txType = 'TAHSİLAT (K.KARTI)';

        const finalDocNo = documentNo || `MAN-${Date.now().toString().slice(-6)}`;

        const { error: txErr } = await supabase.from('account_transactions').insert({
            company_id: companyId,
            transaction_type: txType,
            document_no: finalDocNo,
            description: description || 'Yönetici işlemi',
            debt: debt,
            credit: credit,
            balance_after: newBalance
        });

        if (txErr) throw new Error('İşlem deftere yazılamadı');

        return NextResponse.json({ success: true, balance: newBalance });
    } catch (err) {
        console.error('Manual transaction error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
