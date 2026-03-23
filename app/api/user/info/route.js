import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Auth Error:', authError);
            return NextResponse.json({ error: 'Oturum açılmamış.' }, { status: 401 });
        }

        // Use service role to bypass potential RLS issues in API context
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Fetch profile and company info
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('company_id, full_name, company:companies(name, current_balance, phone)')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error('Profile/Company Error for user', user.id, ':', profileError);
            return NextResponse.json({ error: 'Profil bilgileri alınamadı.', details: profileError?.message }, { status: 404 });
        }

        let companyName = '';
        let companyBalance = 0;
        let companyPhone = '';

        if (profile?.company) {
            const comp = profile.company;
            companyName = comp?.name || '';
            companyBalance = Number(comp?.current_balance) || 0;
            companyPhone = comp?.phone || '';
        }

        // Fallback to full_name if company name is missing
        if (!companyName && profile?.full_name) {
            companyName = profile.full_name;
        }

        return NextResponse.json({
            email: user.email,
            phone: companyPhone || '',
            companyId: profile.company_id,
            companyName: companyName,
            fullName: profile.full_name || '',
            currentBalance: companyBalance
        });

    } catch (err) {
        console.error('API-level Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
