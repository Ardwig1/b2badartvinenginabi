import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

    const isRep = user.user_metadata?.role === 'representative';
    if (!isRep) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });

    const { orderId, status, itemShippingData } = await req.json();
    if (!orderId || !status) return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify rep owns this order's company
    const { data: order } = await adminSupabase.from('orders').select('company_id').eq('id', orderId).single();
    if (!order) return NextResponse.json({ error: 'Sipariş bulunamadı.' }, { status: 404 });

    const { data: assignment } = await adminSupabase
        .from('representative_assignments')
        .select('company_id')
        .eq('representative_id', user.id)
        .eq('company_id', order.company_id)
        .maybeSingle();

    if (!assignment) return NextResponse.json({ error: 'Bu siparişe erişim yetkiniz yok.' }, { status: 403 });

    // Update order status
    const updates = { status };
    if (status === 'cancelled') {
        updates.is_stock_reduced = false;
        const { data: orderFull } = await adminSupabase.from('orders').select('total_amount, company_id').eq('id', orderId).single();
        if (orderFull) {
            await adminSupabase.from('account_transactions').insert({
                company_id: orderFull.company_id,
                transaction_type: 'İADE',
                description: `Sipariş İptali - ${orderId.slice(0, 8).toUpperCase()}`,
                debt: 0,
                credit: orderFull.total_amount,
            });
        }
    }

    if ((status === 'shipped' || status === 'delivered') && itemShippingData) {
        updates.is_stock_reduced = true;
        for (const [itemId, data] of Object.entries(itemShippingData)) {
            await adminSupabase.from('order_items').update({
                shipping_company: data.company,
                tracking_number: data.tracking,
                shipping_origin: data.origin
            }).eq('id', itemId);
        }
    }

    const { error } = await adminSupabase.from('orders').update(updates).eq('id', orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
