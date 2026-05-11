'use server';
import { createClient } from '@supabase/supabase-js';
import { getExchangeRates } from '@/lib/tcmb';
import { revalidatePath } from 'next/cache';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function fetchCompanyDetail(id) {
    try {
        const [compRes, actRes, ordRes, txRes, marginRes, usdRes, rates, cartRes, extraDiscRes] = await Promise.all([
            supabase.from('companies').select('*, profiles(*), price_group:price_groups(name, discount_percent)').eq('id', id).single(),
            supabase.from('user_activities').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(200),
            supabase.from('orders').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(10),
            supabase.from('account_transactions').select('*').eq('company_id', id).order('created_at', { ascending: false }),
            supabase.from('price_groups').select('discount_percent').eq('name', 'GLOBAL_PROFIT_MARGIN').maybeSingle(),
            supabase.from('usd_rates').select('*').eq('id', 1).single(),
            getExchangeRates(),
            supabase.from('cart_items').select('*, fullProduct:products(*)').eq('company_id', id),
            supabase.from('company_extra_discounts').select('*, product:products(name, code, oem_no, brand)').eq('company_id', id)
        ]);

        if (compRes.error) throw compRes.error;

        // Use direct cart items from the database
        const cartItems = (cartRes.data || []).map(item => ({
            ...item,
            qty: item.quantity,
            product: item.fullProduct
        }));

        return {
            success: true,
            data: {
                company: compRes.data,
                activities: actRes.data || [],
                orders: ordRes.data || [],
                transactions: txRes.data || [],
                cart: cartItems,
                extraDiscounts: extraDiscRes.data || [],
                settings: { margin: marginRes.data?.discount_percent || 36 },
                usdSettings: usdRes.data,
                marketRates: rates
            }
        };
    } catch (e) {
        console.error('fetchCompanyDetail Error:', e);
        return { success: false, error: e.message };
    }
}

export async function addExtraDiscount(companyId, productId, rate) {
    try {
        const { error } = await supabase
            .from('company_extra_discounts')
            .upsert({ company_id: companyId, product_id: productId, discount_rate: parseFloat(rate) }, { onConflict: 'company_id,product_id' });
        if (error) throw error;
        revalidatePath(`/admin/companies/${companyId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function deleteExtraDiscount(id, companyId) {
    try {
        const { error } = await supabase.from('company_extra_discounts').delete().eq('id', id);
        if (error) throw error;
        revalidatePath(`/admin/companies/${companyId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function searchAdminProducts(term) {
    try {
        if (!term || term.trim().length < 2) return { success: true, data: [] };
        
        const safeTerm = `%${term.trim()}%`;
        const { data, error } = await supabase
            .from('products')
            .select('id, code, oem_no, name, brand, list_price, currency')
            .eq('is_active', true)
            .or(`name.ilike.${safeTerm},code.ilike.${safeTerm},oem_no.ilike.${safeTerm},brand.ilike.${safeTerm}`)
            .limit(20);

        if (error) throw error;
        return { success: true, data: data || [] };
    } catch (e) {
        console.error('searchAdminProducts Error:', e);
        return { success: false, error: e.message };
    }
}

export async function addAdminCartItem(companyId, product, qty) {
    try {
        if (!companyId || !product?.id || !qty) throw new Error('Eksik bilgi');

        const { error } = await supabase.from('user_activities').insert({
            company_id: companyId,
            action_type: 'cart_add',
            details: {
                id: product.id,
                name: product.name,
                oem_no: product.oem_no,
                qty: parseInt(qty),
                admin_added: true // Flag to distinguish admin action
            }
        });

        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('addAdminCartItem Error:', e);
        return { success: false, error: e.message };
    }
}

export async function placeAdminOrder(companyId, cartItems, pricing) {
    try {
        if (!companyId || !cartItems?.length) throw new Error('Sepet boş');

        // 1. Get Company and Risk Info
        const { data: company, error: cErr } = await supabase
            .from('companies')
            .select('name, risk_limit, is_prepayment_locked, profiles(id)')
            .eq('id', companyId)
            .single();
        if (cErr) throw cErr;
        
        const userId = company.profiles?.id || (Array.isArray(company.profiles) ? company.profiles[0]?.id : null);
        if (!userId) throw new Error('Firma yetkilisi bulunamadı.');

        // 2. Get Current Balance
        const { data: txs, error: tErr } = await supabase
            .from('account_transactions')
            .select('debt, credit')
            .eq('company_id', companyId);
        if (tErr) throw tErr;

        const balance = (txs || []).reduce((acc, tx) => acc + (Number(tx.debt) || 0) - (Number(tx.credit) || 0), 0);
        const orderTotal = pricing.total;

        // 3. Risk Checks (only if admin wants to enforce them, which the user requested)
        if (company.is_prepayment_locked) {
            if (balance + orderTotal > 0) {
                return { success: false, error: 'Bu firma "Peşin Çalışma" grubundadır. Borçlanarak sipariş verilemez.' };
            }
        }

        if (company.risk_limit > 0 && (balance + orderTotal > company.risk_limit)) {
            return { success: false, error: `Sipariş tutarı risk limitini aşıyor. Limit: ${company.risk_limit.toLocaleString('tr-TR')} ₺, Güncel Bakiye: ${balance.toLocaleString('tr-TR')} ₺` };
        }

        // 4. Insert Order Header
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                company_id: companyId,
                user_id: userId,
                status: 'pending',
                total_amount: pricing.total,
                payment_type: 'bank_transfer',
                note: 'Admin tarafından sepete müdahale edilerek oluşturuldu.',
                document_no: `ADM-${Date.now().toString().slice(-6)}`
            })
            .select()
            .single();

        if (orderErr) throw orderErr;

        // 5. Insert Order Items
        const orderItems = cartItems.map(item => ({
            order_id: order.id,
            product_id: item.fullProduct.id,
            quantity: item.qty,
            unit_price: item.price,
            total_price: item.total
        }));

        const { error: itemsErr } = await supabase
            .from('order_items')
            .insert(orderItems);
        if (itemsErr) throw itemsErr;

        // 6. Create Account Transaction (Debt)
        const { error: txErr } = await supabase
            .from('account_transactions')
            .insert({
                company_id: companyId,
                transaction_type: 'TOPTAN SATIŞ',
                description: `Sipariş No: ${order.document_no} (Admin Onaylı)`,
                debt: pricing.total,
                credit: 0,
                created_at: new Date().toISOString()
            });
        if (txErr) throw txErr;

        // 7. Log Activity
        await supabase.from('user_activities').insert({
            company_id: companyId,
            action_type: 'order_placed',
            details: { 
                order_id: order.id, 
                total: pricing.total,
                note: 'Yönetici siparişi sisteme işledi.'
            }
        });

        revalidatePath(`/admin/companies/${companyId}`);
        return { success: true, data: order };

    } catch (e) {
        console.error('placeAdminOrder error:', e);
        return { success: false, error: e.message };
    }
}
