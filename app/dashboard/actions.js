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
