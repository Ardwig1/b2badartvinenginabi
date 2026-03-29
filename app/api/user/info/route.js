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
        
        // Identify Rep: Check Metadata OR customer_representatives table
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

        // CRITICAL: If they CAN impersonate and have a cookie, override targetCompanyId
        if (canImpersonate && impId && impId !== 'undefined' && impId !== '') {
            targetCompanyId = impId;
            isImpersonating = true;
        }

        // 3. Fetch Company Info
        let discount = 0;
        let companyData = null;

        if (targetCompanyId) {
            console.log('INFO API: Fetching data for company:', targetCompanyId);
            const { data: company, error: compErr } = await adminSupabase
                .from('companies')
                .select('*, price_group:price_groups(discount_percent)')
                .eq('id', targetCompanyId)
                .maybeSingle();
            
            if (compErr) console.error('INFO API: Company fetch error:', compErr);

            if (company) {
                companyData = company;
                // Get discount from company's price group
                discount = Number(company.price_group?.discount_percent) || 0;
                console.log('INFO API: Found company discount:', discount, 'from group:', company.price_group);
            } else {
                console.log('INFO API: No company found for ID:', targetCompanyId);
            }
        }

        // 4. Fallback to profile discount ONLY if not impersonating AND no company discount found
        if (discount === 0 && !isImpersonating) {
            discount = Number(profile.discount_rate) || 0;
        }

        // 5. Final Response
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
