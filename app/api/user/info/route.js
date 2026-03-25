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
            .select('company_id, full_name, is_admin, company:companies(id, name, current_balance, phone)')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error('Profile/Company Error for user', user.id, ':', profileError);
            return NextResponse.json({ error: 'Profil bilgileri alınamadı.', details: profileError?.message }, { status: 404 });
        }

        // --- Impersonation Logic ---
        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        let effectiveCompanyId = profile.company_id;
        let effectiveCompanyName = profile.company?.name || '';
        let effectiveBalance = Number(profile.company?.current_balance) || 0;
        let effectivePhone = profile.company?.phone || '';

        if (profile.is_admin && impId) {
            const { data: impCompany } = await adminSupabase
                .from('companies')
                .select('id, name, current_balance, phone')
                .eq('id', impId)
                .single();

            if (impCompany) {
                effectiveCompanyId = impCompany.id;
                effectiveCompanyName = impCompany.name;
                effectiveBalance = Number(impCompany.current_balance) || 0;
                effectivePhone = impCompany.phone || '';
            }
        }
        // --- End Impersonation Logic ---

        // Fallback to full_name if company name is still missing (for admins without specific company)
        if (!effectiveCompanyName && profile?.full_name) {
            effectiveCompanyName = profile.full_name;
        }

        return NextResponse.json({
            email: user.email,
            phone: effectivePhone || '',
            companyId: effectiveCompanyId,
            companyName: effectiveCompanyName,
            fullName: profile.full_name || '',
            currentBalance: effectiveBalance,
            isImpersonating: Boolean(profile.is_admin && impId)
        });

    } catch (err) {
        console.error('API-level Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası: ' + err.message }, { status: 500 });
    }
}
