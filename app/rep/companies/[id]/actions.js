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
        revalidatePath(`/rep/companies/${companyId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function deleteExtraDiscount(id, companyId) {
    try {
        const { error } = await supabase.from('company_extra_discounts').delete().eq('id', id);
        if (error) throw error;
        revalidatePath(`/rep/companies/${companyId}`);
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
        return { success: false, error: e.message };
    }
}
