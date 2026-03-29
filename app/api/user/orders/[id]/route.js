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
            const isRepMetadata = user.user_metadata?.role === 'representative';
            const { data: repAssignment } = await adminSupabase
                .from('representative_assignments')
                .select('representative_id')
                .eq('representative_id', user.id)
                .limit(1)
                .maybeSingle();
            const isRep = isRepMetadata || !!repAssignment;
            if (profile?.is_admin || isRep) return impId;
        }
        return profile?.company_id;
    } catch (e) {
        console.error("getEffectiveCompanyId Error:", e);
        return null;
    }
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Fetch order and ensure it belongs to the company
        const { data: order, error } = await adminSupabase
            .from('orders')
            .select('*, items:order_items(*, product:products(name, code, oem_no, image_url))')
            .eq('id', id)
            .eq('company_id', companyId)
            .single();

        if (error) throw error;
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        return NextResponse.json(order);
    } catch (err) {
        console.error("ORDER DETAIL API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
