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
            // Check if representative (metadata OR representative_assignments table)
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

// GET: Fetch the company's cart
export async function GET() {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({}); // Return empty cart instead of 401 to prevent UI crashes

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: items, error } = await adminSupabase
            .from('cart_items')
            .select('*')
            .eq('company_id', companyId);

        if (error) throw error;
        if (!items || items.length === 0) return NextResponse.json({});

        const productIds = items.map(i => i.product_id);
        const { data: products } = await adminSupabase.from('products').select('*').in('id', productIds);
        
        const cartData = {};
        items.forEach(item => {
            const product = products?.find(p => p.id === item.product_id);
            if (product) {
                cartData[item.product_id] = {
                    product: product,
                    qty: item.quantity,
                    unselected: item.unselected || false
                };
            }
        });

        return NextResponse.json(cartData);
    } catch (err) {
        console.error("CART GET ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST: Update/Add item to company's cart
export async function POST(req) {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { product_id, quantity, unselected } = await req.json();

        if (quantity <= 0) {
            await adminSupabase.from('cart_items').delete().eq('company_id', companyId).eq('product_id', product_id);
        } else {
            const { data: existing } = await adminSupabase
                .from('cart_items')
                .select('id')
                .eq('company_id', companyId)
                .eq('product_id', product_id)
                .maybeSingle();

            if (existing) {
                await adminSupabase.from('cart_items').update({
                    quantity,
                    unselected: unselected !== undefined ? unselected : false,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            } else {
                await adminSupabase.from('cart_items').insert({
                    company_id: companyId,
                    product_id,
                    quantity,
                    unselected: unselected || false
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Clear company's cart
export async function DELETE() {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ success: true });

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        await adminSupabase.from('cart_items').delete().eq('company_id', companyId);
        
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
