import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Oturum açılmamış.' }, { status: 401 });
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Fetch Profile
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile) return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 });

        // 2. Impersonation (Showroom) Logic
        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        
        let targetCompanyId = profile.company_id;
        let isImpersonating = false;

        if (profile.is_admin && impId && impId !== 'undefined') {
            targetCompanyId = impId;
            isImpersonating = true;
        }

        // 3. Fetch Company Info (Garantici yöntem: join yerine düz çekim)
        let discount = 0;
        let companyData = null;

        if (targetCompanyId) {
            const { data: company } = await adminSupabase
                .from('companies')
                .select('*')
                .eq('id', targetCompanyId)
                .single();
            
            if (company) {
                companyData = company;
                // 4. Fetch Price Group Discount
                if (company.price_group_id) {
                    const { data: pg } = await adminSupabase
                        .from('price_groups')
                        .select('discount_percent')
                        .eq('id', company.price_group_id)
                        .single();
                    if (pg) discount = Number(pg.discount_percent) || 0;
                }
            }
        }

        // 5. Fallback to profile discount if no company discount
        if (discount === 0) {
            discount = Number(profile.discount_rate) || 0;
        }

        return NextResponse.json({
            email: user.email,
            phone: companyData?.phone || '',
            companyId: targetCompanyId,
            companyName: companyData?.name || profile.full_name,
            fullName: profile.full_name,
            currentBalance: Number(companyData?.current_balance) || 0,
            discountPercent: discount,
            isImpersonating
        });

    } catch (err) {
        console.error('API-level Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
