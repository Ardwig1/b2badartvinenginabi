'use server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function savePriceGroup(payload, id) {
    try {
        if (id) {
            const { error } = await supabase.from('price_groups').update(payload).eq('id', id);
            if (error) throw new Error(error.message);
        } else {
            const { error } = await supabase.from('price_groups').insert(payload);
            if (error) throw new Error(error.message);
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function deletePriceGroup(id) {
    try {
        const { error } = await supabase.from('price_groups').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function fetchPriceGroups() {
    try {
        const { data, error } = await supabase.from('price_groups').select('*').neq('name', 'GLOBAL_PROFIT_MARGIN').order('name');
        if (error) throw new Error(error.message);
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
