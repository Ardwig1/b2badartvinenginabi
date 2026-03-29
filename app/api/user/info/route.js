import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        const allCookies = cookieStore.getAll();
        console.log('INFO API: All Cookies:', allCookies.map(c => c.name));
        
        const impId = cookieStore.get('impersonate_company_id')?.value;
        console.log('INFO API: Impersonate Cookie Value:', impId);
        
        const isRepMetadata = user.user_metadata?.role === 'representative';
        const { data: repRecord } = await adminSupabase
            .from('customer_representatives')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
        
        const isRep = isRepMetadata || !!repRecord;
        const canImpersonate = profile.is_admin || isRep;
        
        let targetCompanyId = profile.company_id;
        let isImpersonating = false;

        // CRITICAL: Force targetCompanyId if cookie exists and user has permission
        if (canImpersonate && impId && impId !== 'undefined' && impId !== '') {
            targetCompanyId = impId;
            isImpersonating = true;
        }

        // 3. Fetch Company Info DIRECTLY from DB
        let discount = 0;
        let companyData = null;

        if (targetCompanyId) {
            const { data: company } = await adminSupabase
                .from('companies')
                .select('*')
                .eq('id', targetCompanyId)
                .maybeSingle();
            
            if (company) {
                companyData = company;
                // Fetch Price Group Discount DIRECTLY
                if (company.price_group_id) {
                    const { data: pg } = await adminSupabase
                        .from('price_groups')
                        .select('discount_percent')
                        .eq('id', company.price_group_id)
                        .maybeSingle();
                    if (pg) {
                        discount = Number(pg.discount_percent) || 0;
                    }
                }
            }
        }

        // 4. Fallback only if not impersonating
        if (discount === 0 && !isImpersonating) {
            discount = Number(profile.discount_rate) || 0;
        }

        return NextResponse.json({
            userId: user.id,
            email: user.email,
            phone: companyData?.phone || '',
            companyId: targetCompanyId,
            companyName: companyData?.name || profile.full_name,
            fullName: profile.full_name,
            currentBalance: Number(companyData?.current_balance) || 0,
            discountPercent: discount,
            isImpersonating,
            isPrepaymentLocked: companyData?.is_prepayment_locked || false,
            riskLimit: Number(companyData?.risk_limit) || 0
        });

    } catch (err) {
        console.error('API-level Error in /api/user/info:', err);
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }
}
