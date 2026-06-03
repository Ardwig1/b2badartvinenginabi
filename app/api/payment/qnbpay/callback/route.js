import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateHashKey } from '@/lib/qnbpay';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);

        // Tüm gelen parametreleri logla
        const allParams = Object.fromEntries(searchParams.entries());
        console.log('QNBpay callback - TÜM PARAMS:', JSON.stringify(allParams));

        // QNBpay farklı parametre adları kullanabilir
        const qnbpay_status = searchParams.get('qnbpay_status') || searchParams.get('status');
        const order_no      = searchParams.get('order_no') || searchParams.get('order_id');
        const invoice_id    = searchParams.get('invoice_id') || searchParams.get('invoice');
        const hash_key      = searchParams.get('hash_key');
        const cid           = searchParams.get('cid');

        const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.adartvin.com';
        const APP_SECRET = process.env.QNBPAY_APP_SECRET;

        console.log('QNBpay callback parsed:', { qnbpay_status, order_no, invoice_id, cid });

        // Ödeme başarısız ya da iptal
        if (qnbpay_status !== '1') {
            return NextResponse.redirect(
                new URL(`/dashboard/payment/result?status=error&provider=qnbpay&message=${encodeURIComponent('Ödeme tamamlanamadı veya iptal edildi')}`, SITE_URL),
                303
            );
        }

        // Hash doğrulama
        if (hash_key && APP_SECRET) {
            const verified = validateHashKey(hash_key, APP_SECRET);
            if (!verified || verified.status !== '1') {
                console.error('QNBpay hash doğrulama başarısız:', verified);
                return NextResponse.redirect(
                    new URL(`/dashboard/payment/result?status=error&provider=qnbpay&message=${encodeURIComponent('Güvenlik doğrulaması başarısız')}`, SITE_URL),
                    303
                );
            }
        }

        // Veritabanı işlemleri
        if (cid) {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data: company } = await supabase
                .from('companies')
                .select('current_balance, name')
                .eq('id', cid)
                .single();

            if (company) {
                // hash_key'den tutarı çöz
                let amount = 0;
                if (hash_key && APP_SECRET) {
                    const decoded = validateHashKey(hash_key, APP_SECRET);
                    amount = parseFloat(decoded?.total || 0);
                }

                if (amount > 0) {
                    const newBalance = (Number(company.current_balance) || 0) + amount;

                    // Bakiye güncelle
                    await supabase
                        .from('companies')
                        .update({ current_balance: newBalance })
                        .eq('id', cid);

                    // Hesap hareketi
                    await supabase.from('account_transactions').insert({
                        company_id: cid,
                        transaction_type: 'KREDİ KARTI',
                        document_no: order_no || invoice_id,
                        description: `QNBpay Ödemesi (${order_no || invoice_id})`,
                        debt: 0,
                        credit: amount,
                        balance_after: newBalance
                    });

                    // Aktivite kaydı
                    await supabase.from('user_activities').insert({
                        company_id: cid,
                        action_type: 'payment_success',
                        details: { provider: 'qnbpay', orderId: order_no, invoiceId: invoice_id, amount }
                    });

                    console.log(`QNBpay ödeme başarılı: ${company.name}, Tutar: ${amount}, Yeni bakiye: ${newBalance}`);
                }
            }
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
