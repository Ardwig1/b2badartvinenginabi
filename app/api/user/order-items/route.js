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

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;

        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('company_id, is_admin')
            .eq('id', user.id)
            .maybeSingle();

        if (profile?.is_admin && impId && impId !== 'undefined') {
            return impId;
        }
        return profile?.company_id;
    } catch (e) {
        return null;
    }
}

export async function GET() {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json([]);

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Fetch all items from all orders of this company
        // We join with orders to get date and status
        const { data, error } = await adminSupabase
            .from('order_items')
            .select('*, orders!inner(created_at, status, company_id), product:products(name, code, oem_no)')
            .eq('orders.company_id', companyId)
            .order('orders(created_at)', { ascending: false });

        if (error) throw error;

        // Sort: Alphabetical by product name first
        const sortedData = (data || []).sort((a, b) => {
            const nameA = (a.product?.name || '').toLocaleLowerCase('tr-TR');
            const nameB = (b.product?.name || '').toLocaleLowerCase('tr-TR');
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            
            // If names same, sort by date descending
            return new Date(b.orders.created_at) - new Date(a.orders.created_at);
        });

        return NextResponse.json(sortedData);
    } catch (err) {
        console.error("ORDER ITEMS API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
