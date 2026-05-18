'use server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function fetchRepTransactions({ year, month }) {
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

    let startDate, endDate;
    if (month) {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}T23:59:59`;
    } else {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31T23:59:59`;
    }

    const { data, error } = await adminSupabase
        .from('account_transactions')
        .select('*, company:companies(name)')
        .in('company_id', companyIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], companyIds };
}

export async function fetchRepCompanies() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: assignments } = await adminSupabase
        .from('representative_assignments')
        .select('company_id, companies(id, name)')
        .eq('representative_id', user.id);

    return (assignments || []).map(a => a.companies).filter(Boolean);
}
