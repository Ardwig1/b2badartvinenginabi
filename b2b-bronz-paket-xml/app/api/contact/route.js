import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Yetkisiz işlem. Lütfen giriş yapın.' }, { status: 401 });
        }

        const { subject, message } = await request.json();

        if (!subject || !message) {
            return NextResponse.json({ error: 'Konu ve mesaj alanları zorunludur.' }, { status: 400 });
        }

        // Fetch profile to get company_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        // SAVE TO DATABASE
        const { error: dbError } = await supabase.from('suggestions').insert({
            company_id: profile?.company_id,
            user_id: user.id,
            subject,
            message
        });

        if (dbError) {
            console.error('Database save error:', dbError);
            return NextResponse.json({ error: 'Geri bildirim kaydedilemedi: ' + dbError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Mesajınız başarıyla iletildi.' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Bir hata oluştu: ' + error.message }, { status: 500 });
    }
}
