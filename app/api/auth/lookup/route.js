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

        const { data, error } = await adminSupabase
            .from('companies')
            .select('email')
            .ilike('dealer_code', dealerCode.trim())
            .ilike('user_code', userCode.trim())
            .single();

        if (error || !data) {
            console.error("Supabase Error / No Data:", error);
            return NextResponse.json({ error: 'Kullanıcı bulunamadı. Girdiğiniz bilgileri kontrol edin.' }, { status: 404 });
        }

        return NextResponse.json({ email: data.email });

    } catch (err) {
        console.error("API Error in /api/auth/lookup:", err);
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
