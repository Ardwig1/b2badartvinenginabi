import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Oturum açılmamış.' }, { status: 401 });
        }

        // Fetch profile and company balance
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, phone, company_id, company:companies(name, current_balance)')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile Error:', profileError);
            return NextResponse.json({ error: 'Profil bilgileri alınamadı.' }, { status: 404 });
        }

        return NextResponse.json({
            email: profile.email || user.email,
            phone: profile.phone || '',
            companyId: profile.company_id,
            companyName: profile.company?.name || '',
            currentBalance: Number(profile.company?.current_balance) || 0
        });

    } catch (err) {
        console.error('API Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası.' }, { status: 500 });
    }
}
