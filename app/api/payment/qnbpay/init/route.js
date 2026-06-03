import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getQnbpayToken, createPaymentLink } from '@/lib/qnbpay';

export async function POST(req) {
    try {
        const { amount, companyId } = await req.json();

        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return NextResponse.json({ success: false, error: 'Geçersiz tutar' }, { status: 400 });
        }

        // Kullanıcı doğrulama
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Yetkisiz' }, { status: 401 });

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .maybeSingle();

        const cid = companyId || profile?.company_id;
        if (!cid) return NextResponse.json({ success: false, error: 'Firma bulunamadı' }, { status: 400 });

        // Firma bilgisi
        const { data: company } = await adminSupabase
            .from('companies')
            .select('name, contact_name')
            .eq('id', cid)
            .maybeSingle();

        const APP_ID     = process.env.QNBPAY_APP_ID;
        const APP_SECRET = process.env.QNBPAY_APP_SECRET;
        const MERCHANT_KEY = process.env.QNBPAY_MERCHANT_KEY;
        const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL || 'https://b2b.adartvin.com';

        if (!APP_ID || !APP_SECRET || !MERCHANT_KEY) {
            return NextResponse.json({ success: false, error: 'QNBpay ayarları eksik' }, { status: 500 });
        }

        // Benzersiz fatura ID
        const invoiceId = `ARTPAR-${Date.now()}`;

        const nameParts = (company?.contact_name || company?.name || 'B2B Musteri').split(' ');
        const name = nameParts[0] || 'B2B';
        const surname = nameParts.slice(1).join(' ') || 'Musteri';

        const formattedAmount = parseFloat(amount).toFixed(2);
        const returnUrl = `${SITE_URL}/api/payment/qnbpay/callback?cid=${cid}&invoice=${invoiceId}`;
        const cancelUrl = `${SITE_URL}/dashboard/payment/result?status=cancel&provider=qnbpay`;

        // Token al
        const token = await getQnbpayToken(APP_ID, APP_SECRET);

        // Ödeme linki oluştur
        const result = await createPaymentLink({
            token,
            merchantKey: MERCHANT_KEY,
            appSecret: APP_SECRET,
            invoiceId,
            amount: formattedAmount,
            returnUrl,
            cancelUrl,
            name,
            surname,
            items: [{
                name: 'Bakiye Yükleme',
                price: formattedAmount,
                quantity: 1,
                description: `${company?.name || 'Firma'} cari hesap ödemesi`
            }]
        });

        if (!result?.link) {
            console.error('QNBpay link error:', JSON.stringify(result));
            const errMsg = result?.status_description || result?.message || result?.error || JSON.stringify(result) || 'Ödeme linki alınamadı';
            return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
        }

        // cid ve tutarı callback için kaydet (QNBpay custom params'ı geri göndermez)
        await adminSupabase.from('payment_sessions').insert({
            id: invoiceId,
            company_id: cid,
            amount: parseFloat(formattedAmount)
        });

        return NextResponse.json({ success: true, link: result.link, orderId: result.order_id });

    } catch (error) {
        console.error('QNBpay init error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
