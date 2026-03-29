import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getEffectiveCompanyId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        if (isImpersonating) {
            // Check if representative: 
            // 1. In metadata
            // 2. In customer_representatives table (more reliable after re-adds)
            const isRepMetadata = user.user_metadata?.role === 'representative';
            const { data: repRecord } = await adminSupabase
                .from('customer_representatives')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            
            const isRep = isRepMetadata || !!repRecord;

            if (profile?.is_admin || isRep) return impId;
        }
        return profile?.company_id;
    } catch (e) {
        console.error("getEffectiveCompanyId Error:", e);
        return null;
    }
}

export async function POST(req) {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { shippingAddress, note, totalAmount, items } = body;

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await adminSupabase.rpc('place_b2b_order', {
            p_company_id: companyId,
            p_shipping_address: shippingAddress,
            p_note: note,
            p_total_amount: totalAmount,
            p_items: items
        });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (err) {
        console.error("CHECKOUT API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
