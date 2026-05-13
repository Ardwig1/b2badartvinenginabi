import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { dealerCode, userCode } = await request.json();

        if (!dealerCode || !userCode) {
            return NextResponse.json({ error: 'Eksik bilgi: Bayi Kodu veya Kullanıcı Kodu girilmedi.' }, { status: 400 });
        }

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        console.log(`[LOOKUP DEBUG] Using Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
        console.log(`[LOOKUP DEBUG] Searching for Dealer: ${dealerCode}, User: ${userCode}`);

        // 1. Try finding in companies (Dealers)
        const { data: dealerData, error: dealerError } = await adminSupabase
            .from('companies')
            .select('email, status')
            .ilike('dealer_code', dealerCode.trim())
            .ilike('user_code', userCode.trim())
            .maybeSingle();

        if (dealerData) {
            if (dealerData.status === 'rejected') {
                return NextResponse.json({ error: 'Hesabınız uzaklaştırılmıştır. Lütfen yetkililere ulaşın.' }, { status: 403 });
            }
            return NextResponse.json({ email: dealerData.email, type: 'dealer' });
        }

        // 2. Try finding in customer_representatives
        const { data: repData, error: repError } = await adminSupabase
            .from('customer_representatives')
            .select('email, is_active')
            .ilike('dealer_code', dealerCode.trim())
            .ilike('user_code', userCode.trim())
            .maybeSingle();

        if (repData) {
            if (!repData.is_active) {
                return NextResponse.json({ error: 'Hesabınız pasife alınmıştır.' }, { status: 403 });
            }
            return NextResponse.json({ email: repData.email, type: 'representative' });
        }

        return NextResponse.json({ error: 'Kullanıcı bulunamadı. Bilgilerinizi kontrol edin.' }, { status: 404 });

    } catch (err) {
        console.error("API Error in /api/auth/lookup:", err);
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
