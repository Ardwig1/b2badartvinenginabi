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

export async function PUT(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const body = await req.json();
        const { id, companyId, transaction_type, debt, credit, description, documentNo, created_at, order_items } = body;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error: txUpdErr } = await supabase.from('account_transactions').update({
            company_id: companyId,
            transaction_type,
            debt: parseFloat(debt || 0),
            credit: parseFloat(credit || 0),
            description,
            document_no: documentNo,
            created_at: created_at 
        }).eq('id', id);

        if (txUpdErr) throw new Error('İşlem güncellenemedi: ' + txUpdErr.message);

        if (transaction_type === 'TOPTAN SATIŞ' && order_items && order_items.length > 0) {
            for (const item of order_items) {
                await supabase.from('order_items').update({
                    quantity: parseInt(item.quantity),
                    unit_price: parseFloat(item.unit_price),
                    total_price: parseInt(item.quantity) * parseFloat(item.unit_price)
                }).eq('id', item.id);
            }
        }

        const { data: allTx, error: allTxErr } = await supabase
            .from('account_transactions')
            .select('id, debt, credit')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        if (!allTxErr && allTx) {
            let runningBalance = 0;
            for (const tx of allTx) {
                runningBalance = Number((runningBalance + parseFloat(tx.credit || 0) - parseFloat(tx.debt || 0)).toFixed(2));
                await supabase.from('account_transactions').update({ balance_after: runningBalance }).eq('id', tx.id);
            }
            await supabase.from('companies').update({ current_balance: runningBalance }).eq('id', companyId);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Update transaction error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const companyId = searchParams.get('companyId');

        if (!id || !companyId) throw new Error('Eksik parametreler');

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Delete the transaction
        const { error: delErr } = await supabase.from('account_transactions').delete().eq('id', id);
        if (delErr) throw delErr;

        // 2. RE-CALCULATION LOGIC
        const { data: allTx, error: allTxErr } = await supabase
            .from('account_transactions')
            .select('id, debt, credit')
            .eq('company_id', companyId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        if (!allTxErr && allTx) {
            let runningBalance = 0;
            for (const tx of allTx) {
                runningBalance = Number((runningBalance + parseFloat(tx.credit || 0) - parseFloat(tx.debt || 0)).toFixed(2));
                await supabase.from('account_transactions').update({ balance_after: runningBalance }).eq('id', tx.id);
            }
            await supabase.from('companies').update({ current_balance: runningBalance }).eq('id', companyId);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Delete transaction error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
