import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const { orderId, status } = await req.json();

        if (!orderId || !status) {
            return NextResponse.json({ error: 'Sipariş ID veya Statü eksik' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Fetch current order state
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', orderId)
            .single();

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });
        }

        const oldStatus = order.status;

        // If no status change, return
        if (oldStatus === status) {
            return NextResponse.json({ success: true, message: 'Statü aynı' });
        }

        // 2. Cancellation Logic: Refund Debt & Restore Stock
        if (status === 'cancelled' && oldStatus !== 'cancelled') {
            const companyId = order.company_id;
            const totalAmount = order.total_amount;

            // Fetch company balance
            const { data: company } = await supabase.from('companies').select('current_balance').eq('id', companyId).single();
            const currentBalance = company?.current_balance || 0;
            
            // Refund debt -> Balance increases (debt decreases)
            const newBalance = currentBalance + totalAmount;
            
            await supabase.from('companies').update({ current_balance: newBalance }).eq('id', companyId);

            // Create Refund Transaction
            await supabase.from('account_transactions').insert({
                company_id: companyId,
                transaction_type: 'İPTAL / İADE',
                document_no: orderId,
                description: 'Sipariş İptali (İade)',
                debt: 0,
                credit: totalAmount,
                balance_after: newBalance
            });

            // Restore Product Stocks
            for (const item of order.order_items) {
                // Fetch current stock
                const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
                if (prod) {
                    await supabase.from('products').update({
                        stock_quantity: prod.stock_quantity + item.quantity
                    }).eq('id', item.product_id);
                }
            }
        }

        // 3. Update Order Status
        const { error: updateErr } = await supabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateErr) throw new Error(updateErr.message);

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('Order Status Update Error:', e);
        return NextResponse.json({ error: e.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
