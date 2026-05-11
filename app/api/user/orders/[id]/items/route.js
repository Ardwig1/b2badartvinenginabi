import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function isAuthorized(orderId) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        // Fetch order to see which company it belongs to
        const { data: order } = await adminSupabase.from('orders').select('company_id').eq('id', orderId).maybeSingle();
        if (!order) {
            // Maybe orderId is a document_no, try fetching by document_no
            const { data: orderDoc } = await adminSupabase.from('orders').select('company_id').eq('document_no', orderId).maybeSingle();
            if (!orderDoc) return false;
            return await checkAccess(user, orderDoc.company_id, isImpersonating, impId);
        }
        
        return await checkAccess(user, order.company_id, isImpersonating, impId);
    } catch (e) {
        return false;
    }
}

async function checkAccess(user, companyId, isImpersonating, impId) {
    const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await adminSupabase.from('profiles').select('company_id, is_admin').eq('id', user.id).maybeSingle();
    
    // Check if representative (metadata OR representative_assignments table)
    const isRepMetadata = user.user_metadata?.role === 'representative';
    const { data: repAssignment } = await adminSupabase
        .from('representative_assignments')
        .select('representative_id')
        .eq('representative_id', user.id)
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();
    const isRep = isRepMetadata || !!repAssignment;

    if (profile?.is_admin || isRep) {
        if (isImpersonating && impId === companyId) return true;
        // If not impersonating this specific company, still check if they are the rep for it or admin
        if (profile?.is_admin) return true;
        // isRep check above already verified assignment for THIS company if it came from table
        if (isRepMetadata) {
             // If they only have metadata, we still need to check if they are assigned to THIS company
             const { data: specificAssignment } = await adminSupabase
                .from('representative_assignments')
                .select('representative_id')
                .eq('representative_id', user.id)
                .eq('company_id', companyId)
                .limit(1)
                .maybeSingle();
             if (specificAssignment) return true;
        } else if (repAssignment) {
            return true;
        }
    }
    
    if (profile?.company_id === companyId) return true;
    
    return false;
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 });

        // Verify authorization
        const authorized = await isAuthorized(id);
        if (!authorized) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        // Treat this API as highly privileged for User/Admin/Rep context
        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // Fetch items directly using service role
        const { data, error } = await adminSupabase
            .from('order_items')
            .select('*, product:products(name, code, oem_no)')
            .or(`order_id.eq.${id},order_id.in.(select id from orders where document_no.eq.${id})`);

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
