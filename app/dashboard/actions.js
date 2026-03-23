'use server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getUserDiscount(userId) {
    if (!userId) return 0;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('company:companies(price_group:price_groups(discount_percent))')
            .eq('id', userId)
            .single();

        return profile?.company?.price_group?.discount_percent || 0;
    } catch (e) {
        console.error("getUserDiscount error:", e);
        return 0;
    }
}

export async function getUserCompanyInfo(userId) {
    if (!userId) return null;
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, company:companies(name)')
            .eq('id', userId)
            .single();

        let companyName = '';
        if (profile?.company) {
            if (Array.isArray(profile.company)) {
                companyName = profile.company[0]?.name || '';
            } else {
                companyName = profile.company.name || '';
            }
        }

        return {
            companyId: profile?.company_id || '',
            companyName: companyName
        };
    } catch (e) {
        console.error("getUserCompanyInfo error:", e);
        return null;
    }
}
