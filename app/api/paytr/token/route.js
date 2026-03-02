import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
    try {
        const body = await request.json();
        const { amount, userEmail, userName, userAddress, userPhone, merchantOid } = body;

        // Buralar .env.local dosyasından gelecek
        const merchant_id = process.env.PAYTR_MERCHANT_ID;
        const merchant_key = process.env.PAYTR_MERCHANT_KEY;
        const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

        if (!merchant_id || !merchant_key || !merchant_salt) {
            return NextResponse.json({ error: 'PayTR API anahtarları eksik. Lütfen .env.local dosyanızı kontrol edin.' }, { status: 500 });
        }

        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        const user_ip = ip.split(',')[0].trim();
        const merchant_oid = merchantOid || `ORDER-${Date.now()}`;

        const email = userEmail || 'musteri@sirket.com';
        const payment_amount = Math.round(Number(amount) * 100); // Kuruş cinsinden

        const user_basket = Buffer.from(JSON.stringify([
            ['Bakiye Yükleme / Fatura Ödeme', amount.toString(), 1]
        ])).toString('base64');

        const no_installment = 0; // Taksit istenmiyorsa 1, isteniyorsa 0
        const max_installment = 0;
        const currency = 'TL';
        const test_mode = 1; // Canlıya alırken 0 yapılacak

        // Hash oluşturma sırası çok önemli (PayTR dokümantasyonuna göre)
        const hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode;
        const paytr_token = crypto.createHmac('sha256', merchant_key).update(hash_str + merchant_salt).digest('base64');

        const formData = new URLSearchParams();
        formData.append('merchant_id', merchant_id);
        formData.append('user_ip', user_ip);
        formData.append('merchant_oid', merchant_oid);
        formData.append('email', email);
        formData.append('payment_amount', payment_amount.toString());
        formData.append('paytr_token', paytr_token);
        formData.append('user_basket', user_basket);
        formData.append('debug_on', '1');
        formData.append('no_installment', no_installment.toString());
        formData.append('max_installment', max_installment.toString());
        formData.append('user_name', userName || 'Müşteri Adı Soyadı');
        formData.append('user_address', userAddress || 'Firma Adresi');
        formData.append('user_phone', userPhone || '05555555555');
        formData.append('merchant_ok_url', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/payment/success`);
        formData.append('merchant_fail_url', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/payment/fail`);
        formData.append('timeout_limit', '30');
        formData.append('currency', currency);
        formData.append('test_mode', test_mode.toString());

        const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.status === 'success') {
            return NextResponse.json({ token: data.token });
        } else {
            console.error('PayTR Token Hatası:', data.reason);
            return NextResponse.json({ error: data.reason }, { status: 400 });
        }

    } catch (error) {
        console.error('PayTR API Hatası:', error);
        return NextResponse.json({ error: 'Ödeme altyapısına bağlanırken bir hata oluştu.' }, { status: 500 });
    }
}
