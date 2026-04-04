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

        // --- NÜKLEER YETKİ: Temsilci ve Adminler için RLS bypass ---
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Profil ve Temsilci Durumu Kontrolü
        const { data: profile } = await adminSupabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        const { data: repRecord } = await adminSupabase.from('customer_representatives').select('id').eq('id', user.id).maybeSingle();
        
        const isRep = user.user_metadata?.role === 'representative' || !!repRecord;
        const isAdmin = profile?.is_admin === true;
        const hasSuperPower = isRep || isAdmin; // TEMSİLCİ = ADMIN MANTIĞI

        // 2. Showroom Çerezi Okuma
        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        
        let targetCompanyId = profile?.company_id;
        let isImpersonating = false;

        // Yetkili biri showroom modundaysa bayiyi hedefle
        if (hasSuperPower && impId && impId !== 'undefined' && impId !== '') {
            targetCompanyId = impId;
            isImpersonating = true;
        }

        // 3. Veri Çekme (Dashboard ile Birebir Aynı Sorgu)
        let discount = 0;
        let companyData = null;

        if (targetCompanyId) {
            // RLS bypass ile en yetkili şekilde çekiyoruz
            const { data: company } = await adminSupabase
                .from('companies')
                .select('*, price_group:price_groups(name, discount_percent)')
                .eq('id', targetCompanyId)
                .maybeSingle();
            
            if (company) {
                companyData = company;
                // Fiyat grubu iskontosunu garantiye al
                discount = Number(company.price_group?.discount_percent) || 0;
            }
        }

        // 4. Fallback (Showroom değilsek kendi iskontosu)
        if (discount === 0 && !isImpersonating && profile) {
            discount = Number(profile.discount_rate) || 0;
        }

        // 4. Fetch Extra Discounts (Only unused ones)
        let extraDiscounts = [];
        if (targetCompanyId) {
            const { data } = await adminSupabase
                .from('company_extra_discounts')
                .select('product_id, discount_rate')
                .eq('company_id', targetCompanyId)
                .eq('is_used', false); // Only unused
            extraDiscounts = data || [];
        }

        return NextResponse.json({
            userId: user.id,
            email: user.email,
            phone: companyData?.phone || '',
            companyId: targetCompanyId,
            companyName: companyData?.name || profile?.full_name || 'B2B Kullanıcısı',
            fullName: profile?.full_name || 'B2B Kullanıcısı',
            currentBalance: Number(companyData?.current_balance) || 0,
            discountPercent: discount,
            extraDiscounts: extraDiscounts, // Added this field
            isImpersonating,
            isPrepaymentLocked: companyData?.is_prepayment_locked || false,
            riskLimit: Number(companyData?.risk_limit) || 0,
            role: isRep ? 'representative' : (isAdmin ? 'admin' : 'dealer')
        });

    } catch (err) {
        console.error('CRITICAL API ERROR:', err);
        return NextResponse.json({ error: 'Sunucu hatası', details: err.message }, { status: 500 });
    }
}
