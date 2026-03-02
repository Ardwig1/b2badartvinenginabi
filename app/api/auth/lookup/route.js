import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
            .eq('dealer_code', dealerCode.trim())
            .eq('user_code', userCode.trim())
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı. Girdiğiniz bilgileri kontrol edin.' }, { status: 404 });
        }

        return NextResponse.json({ email: data.email });

    } catch (err) {
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
