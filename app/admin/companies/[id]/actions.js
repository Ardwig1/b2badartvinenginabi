'use server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function fetchCompanyDetail(id) {
    try {
        const [compRes, actRes, cartActRes, ordRes, txRes] = await Promise.all([
            supabase.from('companies').select('*, profiles(*), price_group:price_groups(name, discount_percent)').eq('id', id).single(),
            supabase.from('user_activities').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(200),
            supabase.from('user_activities').select('*').eq('company_id', id).in('action_type', ['cart_add', 'cart_update', 'cart_remove', 'cart_clear', 'order_placed']).order('created_at', { ascending: false }).limit(500),
            supabase.from('orders').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(1),
            supabase.from('account_transactions').select('*').eq('company_id', id).order('created_at', { ascending: false })
        ]);

        if (compRes.error) throw compRes.error;

        // Reconstruct Current Cart from Logs
        const latestOrder = ordRes.data && ordRes.data.length > 0 ? ordRes.data[0] : null;
        let resetTime = latestOrder ? new Date(latestOrder.created_at).getTime() : 0;

        // Find the latest cart_clear or order_placed in the logs
        const logActivities = cartActRes.data || [];
        const latestResetLog = logActivities.find(a => ['cart_clear', 'order_placed'].includes(a.action_type));
        if (latestResetLog) {
            const logResetTime = new Date(latestResetLog.created_at).getTime();
            if (logResetTime > resetTime) resetTime = logResetTime;
        }

        // Sort by time ascending to play back the actions
        const cartActivities = logActivities
            .filter(a => ['cart_add', 'cart_update', 'cart_remove'].includes(a.action_type))
            .filter(a => new Date(a.created_at).getTime() > resetTime)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const reconstructedCart = {};
        cartActivities.forEach(act => {
            const { id: prodId, qty, newQty } = act.details || {};
            if (!prodId) return;

            if (act.action_type === 'cart_add') {
                if (!reconstructedCart[prodId]) {
                    reconstructedCart[prodId] = { product: act.details, qty: 0 };
                }
                reconstructedCart[prodId].qty += (qty || 1);
            } else if (act.action_type === 'cart_update') {
                reconstructedCart[prodId] = { product: act.details, qty: newQty };
            } else if (act.action_type === 'cart_remove') {
                delete reconstructedCart[prodId];
            }
        });

        // Convert cart map to array
        const cartItems = Object.values(reconstructedCart).filter(item => item.qty > 0);

        return {
            success: true,
            data: {
                company: compRes.data,
                activities: actRes.data || [],
                orders: ordRes.data || [],
                transactions: txRes.data || [],
                cart: cartItems
            }
        };
    } catch (e) {
        console.error('fetchCompanyDetail Error:', e);
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
