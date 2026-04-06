import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
    try {
        // Environment variables ensure evaluated per request
        const API_USER = process.env.TOSLA_API_USER;
        const API_PASS = process.env.TOSLA_API_PASS;
        const CLIENT_ID = process.env.TOSLA_CLIENT_ID;
        const BASE_URL = process.env.TOSLA_API_BASE_URL;
        const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        // Parse payment details from frontend
        const body = await req.json();
        const { amount, cardHolderName, cardNumber, expireMonth, expireYear, cvv, buyerEmail, buyerPhone, companyId, companyName, context } = body;
        
        let OK_URL = `${SITE_URL}/api/payment/tosla/callback`;
        if (companyId) {
            OK_URL += `?cid=${encodeURIComponent(companyId)}`;
        }

        if (!amount || !cardHolderName || !cardNumber || !expireMonth || !expireYear || !cvv) {
            return NextResponse.json({ error: 'Eksik kart veya tutar bilgisi.' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
             return NextResponse.json({ error: 'Supabase ayarları eksik.' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        let finalCompanyName = companyName || '';
        if (companyId) {
            try {
                const { data } = await supabase.from('companies').select('name').eq('id', companyId).single();
                if (data?.name) finalCompanyName = data.name;
            } catch (err) {
                console.error('Company fetch error in payment init', err);
            }
        }
        if (!finalCompanyName) finalCompanyName = 'MUSTERI';
        
        const safeName = finalCompanyName
            .replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
            .replace(/[^a-zA-Z0-9\s]/g, '').trim().toUpperCase() || 'MUSTERI';

        // Tosla WAF drops connections with 204 No Content if orderId > 20 characters
        const orderId = `B2B${crypto.randomBytes(6).toString('hex').toUpperCase()}`; // Alphanumeric only

        // Tosla dokümantasyonu bazlı Hash ve İstek Parametreleri
        // Tutar kuruşsuz long olmalı (örn. 10.00 TL -> 1000)
        const amountLong = Math.round(parseFloat(amount) * 100);

        // Rastgele max 24 karakter bilgi (rnd)
        const rnd = crypto.randomBytes(12).toString('hex'); 

        // TimeSpan: yyyyMMddHHmmss formatında GMT+3
        const now = new Date();
        now.setUTCHours(now.getUTCHours() + 3); // Türkiye Saati (GMT+3)
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        const hours = String(now.getUTCHours()).padStart(2, '0');
        const minutes = String(now.getUTCMinutes()).padStart(2, '0');
        const seconds = String(now.getUTCSeconds()).padStart(2, '0');
        const timeSpan = `${year}${month}${day}${hours}${minutes}${seconds}`;

        // Save orderId mapping in user_activities (acting as payment_sessions)
        if (companyId) {
            await supabase.from('user_activities').insert({
                company_id: companyId,
                action_type: 'payment_init',
                details: { orderId, amount: amountLong, context }
            });
        }

        // Tosla Hash oluşturma mantığı: ApiPass + ClientId + ApiUser + Rnd + TimeSpan -> SHA512 Base64
        const hashString = `${API_PASS}${CLIENT_ID}${API_USER}${rnd}${timeSpan}`;
        const hash = crypto.createHash('sha512').update(hashString, 'utf8').digest('base64');

        // Tosla API'sine gönderilecek veri (3D Ödeme İsteği)
        const requestBody = {
            clientId: CLIENT_ID,
            apiUser: API_USER,
            rnd: rnd,
            timeSpan: timeSpan,
            hash: hash,
            orderId: orderId,
            amount: amountLong, 
            currency: '949', // TRY
            installmentCount: '0', // Single shot
            callbackUrl: OK_URL,
            description: "B2B Yedek Parca Odemesi",
            customerEmail: buyerEmail || '',
            customerPhone: buyerPhone || '',
            customerName: safeName
        };

        console.log(`Sending to Tosla. URL: ${BASE_URL}/Payment/threeDPayment, Payload:`, JSON.stringify(requestBody));

        // Entegrasyon dokümanında bulunan doğru endpoint
        const response = await fetch(`${BASE_URL}/Payment/threeDPayment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        console.log(`Tosla API Response Status: ${response.status} ${response.statusText}`);
        console.log(`Tosla API Response Text:`, responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch(e) {
            console.error('Tosla API did not return valid JSON. Raw text:', responseText);
            return NextResponse.json({ error: 'Banka servisinden geçersiz yanıt alındı.', raw: responseText.slice(0, 500), bodySent: requestBody, statusSent: response.status }, { status: 502 });
        }

        if (data.Code === 0 && data.ThreeDSessionId) {
            // Başarılı ise 3D HTML formunu, redirect url'sini ya da ThreeDSessionId'yi dönüyoruz
            return NextResponse.json({ 
                success: true, 
                threeDSessionId: data.ThreeDSessionId,
                data: data,
                companyName: safeName, // Sanitized
                processUrl: `${BASE_URL}/Payment/ProcessCardForm`
            });
        }
 else {
            console.error('Tosla API Error:', data);
            return NextResponse.json({ error: data.Message || data.errorMessage || 'Ödeme başlatılamadı.' }, { status: 400 });
        }

    } catch (error) {
        console.error('Payment init error:', error);
        return NextResponse.json({ error: 'Sunucu hatası oluştu.', details: String(error), stack: error.stack }, { status: 500 });
    }
}
