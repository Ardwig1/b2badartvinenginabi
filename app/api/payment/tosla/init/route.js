import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const API_USER = process.env.TOSLA_API_USER;
const API_PASS = process.env.TOSLA_API_PASS;
const CLIENT_ID = process.env.TOSLA_CLIENT_ID;
const BASE_URL = process.env.TOSLA_API_BASE_URL || 'https://sanalpos.tosla.com/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const OK_URL = `${SITE_URL}/api/payment/tosla/callback`;
const FAIL_URL = `${SITE_URL}/api/payment/tosla/callback`;

export async function POST(req) {
    try {
        const body = await req.json();
        const { amount, cardHolderName, cardNumber, expireMonth, expireYear, cvv } = body;

        if (!amount || !cardHolderName || !cardNumber || !expireMonth || !expireYear || !cvv) {
            return NextResponse.json({ error: 'Eksik kart veya tutar bilgisi.' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Gelecekte order_id'yi gerçek sipariş numarasından alabiliriz. 
        // Şimdilik test için benzersiz bir ID oluşturuyoruz.
        const orderId = `B2B_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Tosla Hash oluşturma mantığı: Genelde (ClientId + OrderId + Amount + OkUrl + FailUrl + ApiPass) SHA512 Base64
        const hashString = `${CLIENT_ID}${orderId}${amount}${OK_URL}${FAIL_URL}${API_PASS}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('base64');

        // Tosla API'sine gönderilecek veri (3D Ödeme İsteği)
        const requestBody = {
            apiUser: API_USER,
            client_Id: CLIENT_ID,
            hash: hash,
            type: 'Auth',
            amount: amount,
            currency: 'TRY',
            orderId: orderId,
            okUrl: OK_URL,
            failUrl: FAIL_URL,
            creditCardHolderName: cardHolderName,
            creditCardNumber: cardNumber.replace(/\s/g, ''),
            expireMonth: expireMonth.padStart(2, '0'),
            expireYear: expireYear.length === 2 ? `20${expireYear}` : expireYear,
            cvv: cvv,
            clientIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
            installment: '1' // Tek çekim
        };

        // Tosla API'ye istek atılması (ThreeD Session)
        // Not: Endpoint adı dokümantasyona göre değişebilir (örn. /Payment/ThreeD, /Payment/GetThreeDSession)
        const response = await fetch(`${BASE_URL}/Payment/ThreeD`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.status === 'success' || data.isSuccess || data.threeDSessionId) { // Tosla'nın dönüş formatına göre değişebilir
            // Başarılı ise 3D HTML formunu, redirect url'sini ya da ThreeDSessionId'yi dönüyoruz
            return NextResponse.json({ 
                success: true, 
                data: data.threeDHtml || data.htmlContent || data.redirectUrl || data 
            });
        } else {
            console.error('Tosla API Error:', data);
            return NextResponse.json({ error: data.errorMessage || 'Ödeme başlatılamadı.' }, { status: 400 });
        }

    } catch (error) {
        console.error('Payment init error:', error);
        return NextResponse.json({ error: 'Sunucu hatası oluştu.' }, { status: 500 });
    }
}
