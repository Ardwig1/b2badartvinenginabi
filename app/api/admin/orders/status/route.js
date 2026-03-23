import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const { orderId, status, shippingCompany, trackingNumber, shippingOrigin } = await req.json();

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
        
        // Prevent changing status of an already cancelled order
        if (oldStatus === 'cancelled') {
            return NextResponse.json({ error: 'İptal edilmiş siparişin durumu bir daha değiştirilemez.' }, { status: 400 });
        }

        // 2. Shipping & Stock Logic (Merkez / Depo)
        const isShippingNow = (status === 'shipped' || status === 'delivered') && !order.is_stock_reduced;

        if (isShippingNow) {
            if (!shippingOrigin) {
                return NextResponse.json({ error: 'Lütfen çıkış yerini (İstanbul/Depo) seçin.' }, { status: 400 });
            }

            // Reduce product stocks from specific bin
            for (const item of order.order_items) {
                const stockColumn = shippingOrigin === 'İstanbul' ? 'stock_merkez' : 'stock_depo';
                
                // Fetch current stock for that bin
                const { data: prod } = await supabase.from('products').select(stockColumn).eq('id', item.product_id).single();
                if (prod) {
                    await supabase.from('products').update({
                        [stockColumn]: Math.max(0, (prod[stockColumn] || 0) - item.quantity)
                    }).eq('id', item.product_id);
                }
            }
        }

        // 3. Cancellation Logic: Refund Debt & Restore Stock
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

            // Restore Total Product Stocks
            for (const item of order.order_items) {
                const { data: prod } = await supabase.from('products').select('*').eq('id', item.product_id).single();
                if (prod) {
                    const updateData = { stock_quantity: (prod.stock_quantity || 0) + item.quantity };
                    
                    // If stock was already reduced from a specific bin, restore that too
                    if (order.is_stock_reduced && order.shipping_origin) {
                        const stockColumn = order.shipping_origin === 'İstanbul' ? 'stock_merkez' : 'stock_depo';
                        updateData[stockColumn] = (prod[stockColumn] || 0) + item.quantity;
                    }

                    await supabase.from('products').update(updateData).eq('id', item.product_id);
                }
            }
        }

        // 4. Update Order Status and Shipping Info
        const updatePayload = { 
            status, 
            updated_at: new Date().toISOString() 
        };

        if (shippingCompany) updatePayload.shipping_company = shippingCompany;
        if (trackingNumber) updatePayload.tracking_number = trackingNumber;
        if (shippingOrigin) updatePayload.shipping_origin = shippingOrigin;
        if (isShippingNow) updatePayload.is_stock_reduced = true;

        const { error: updateErr } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', orderId);

        if (updateErr) throw new Error(updateErr.message);

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('Order Status Update Error:', e);
        return NextResponse.json({ error: e.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
