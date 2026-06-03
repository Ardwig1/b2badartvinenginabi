import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        // Tüm gelen parametreleri logla
        const allParams = Object.fromEntries(searchParams.entries());
        console.log('QNBpay callback - TÜM PARAMS:', JSON.stringify(allParams));

        // QNBpay'in gönderdiği alan adları
        const payment_status = searchParams.get('payment_status') || searchParams.get('qnbpay_status') || searchParams.get('status');
        const status_code    = searchParams.get('status_code');
        const order_no       = searchParams.get('order_no') || searchParams.get('order_id');
        const invoice_id     = searchParams.get('invoice_id') || searchParams.get('invoice');
        const hash_key       = searchParams.get('hash_key');

        const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.adartvin.com';
        const APP_SECRET = process.env.QNBPAY_APP_SECRET;

        console.log('QNBpay callback parsed:', { payment_status, status_code, order_no, invoice_id });

        // Ödeme başarısız ya da iptal (payment_status=1 VE status_code=100 ikisi de başarı işareti)
        const isSuccess = payment_status === '1' || status_code === '100';
        if (!isSuccess) {
            return NextResponse.redirect(
                new URL(`/dashboard/payment/result?status=error&provider=qnbpay&message=${encodeURIComponent('Ödeme tamamlanamadı veya iptal edildi')}`, SITE_URL),
                303
            );
        }

        // Veritabanı işlemleri — cid ve tutarı payment_sessions'tan al
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: session } = await supabase
            .from('payment_sessions')
            .select('company_id, amount')
            .eq('id', invoice_id)
            .maybeSingle();

        if (session?.company_id && session?.amount > 0) {
            const cid    = session.company_id;
            const amount = parseFloat(session.amount);

            const { data: company } = await supabase
                .from('companies')
                .select('current_balance, name')
                .eq('id', cid)
                .single();

            if (company) {
                const newBalance = (Number(company.current_balance) || 0) + amount;

                await supabase
                    .from('companies')
                    .update({ current_balance: newBalance })
                    .eq('id', cid);

                await supabase.from('account_transactions').insert({
                    company_id: cid,
                    transaction_type: 'KREDİ KARTI',
                    document_no: order_no || invoice_id,
                    description: `QNBpay Ödemesi (${order_no || invoice_id})`,
                    debt: 0,
                    credit: amount,
                    balance_after: newBalance
                });

                await supabase.from('user_activities').insert({
                    company_id: cid,
                    action_type: 'payment_success',
                    details: { provider: 'qnbpay', orderId: order_no, invoiceId: invoice_id, amount }
                });

                // Oturumu temizle
                await supabase.from('payment_sessions').delete().eq('id', invoice_id);

                console.log(`QNBpay ödeme başarılı: ${company.name}, Tutar: ${amount}, Yeni bakiye: ${newBalance}`);
            }
        } else {
            console.error('QNBpay callback: payment_sessions kaydı bulunamadı, invoice_id:', invoice_id);
        }

        return NextResponse.redirect(
            new URL(`/dashboard/payment/result?status=success&provider=qnbpay&orderId=${order_no || ''}`, SITE_URL),
            303
        );

    } catch (error) {
        console.error('QNBpay callback error:', error);
        const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.adartvin.com';
        return NextResponse.redirect(
            new URL(`/dashboard/payment/result?status=error&provider=qnbpay&message=${encodeURIComponent('Sistem hatası')}`, SITE_URL),
            303
        );
    }
}
