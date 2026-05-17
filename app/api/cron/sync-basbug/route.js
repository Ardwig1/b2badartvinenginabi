import { syncBasbugApi } from '@/lib/xml_sync_basbug';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 dakikaya kadar izin ver

export async function GET(req) {
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const urlSecret = new URL(req.url).searchParams.get('secret');
    const validSecret = process.env.CRON_SECRET || 'b2badartvinenginabi_123';

    // Güvenlik kontrolü
    if (process.env.NODE_ENV === 'production' && !isVercelCron && authHeader !== `Bearer ${validSecret}` && urlSecret !== validSecret) {
        console.error('❌ Unauthorized Cron Attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isTest = new URL(req.url).searchParams.get('test') === '1';

    try {
        if (isTest) {
            // Sadece token al ve 1 ürün çek — IP testi için
            const axios = (await import('axios')).default;
            const loginRes = await axios.post('https://api.basbug.com.tr/auth/Login', {
                KullaniciAdi: process.env.BASBUG_USER || 'MS8012',
                Parola: process.env.BASBUG_PASS || '6SCHUCEY1E6HB9MN',
                ClientSecret: process.env.BASBUG_SECRET || 'W2wOU8V6w3eSWfo6sxi2CThf1g9EYmZ3',
                ClientID: process.env.BASBUG_CLIENT_ID || 'materialApi',
            }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });

            const token = loginRes.data?.token;
            if (!token) return NextResponse.json({ error: 'Token alınamadı' }, { status: 502 });

            const detailRes = await axios.get(
                'https://api.basbug.com.tr/material/MalzemeAra?MalzemeNo=BCH%200445110083&FirmaAdi=BASBUG',
                { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
            );

            return NextResponse.json({
                message: 'IP testi başarılı — Basbug API erişilebilir',
                ornek_urun: detailRes.data,
            });
        }

        const result = await syncBasbugApi();

        if (result.success) {
            return NextResponse.json({
                message: 'Basbug Sync completed successfully',
                count: result.count
            });
        } else {
            return NextResponse.json({
                error: 'Basbug Sync failed',
                details: result.error
            }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({
            error: 'Basbug API erişim hatası — muhtemelen IP engeli',
            details: error.message
        }, { status: 500 });
    }
}
