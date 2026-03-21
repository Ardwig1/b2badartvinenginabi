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

        // Fixed query: removed non-existent 'email' column from profiles
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('company_id, company:companies(name, current_balance)')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile/Company Error for user', user.id, ':', profileError);
            return NextResponse.json({ error: 'Profil bilgileri alınamadı.', details: profileError?.message }, { status: 404 });
        }

        return NextResponse.json({
            email: user.email, // Use email from auth session
            phone: '', // Phone might not be in profiles, keeping empty or you can add if it exists
            companyId: profile.company_id,
            companyName: profile.company?.name || '',
            currentBalance: Number(profile.company?.current_balance) || 0
        });

    } catch (err) {
        console.error('API-level Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
