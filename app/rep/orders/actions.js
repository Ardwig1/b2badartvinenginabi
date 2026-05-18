'use server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function fetchRepOrders(filter) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Yetkisiz.' };

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: assignments } = await adminSupabase
        .from('representative_assignments')
        .select('company_id')
        .eq('representative_id', user.id);

    const companyIds = (assignments || []).map(a => a.company_id);
    if (companyIds.length === 0) return { success: true, data: [] };

    let query = adminSupabase
        .from('orders')
        .select('*, company:companies(name), items:order_items(*, product:products(name, code, oem_no, supplier_brand))')
        .in('company_id', companyIds)
        .order('created_at', { ascending: false });

    if (filter && filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
}
