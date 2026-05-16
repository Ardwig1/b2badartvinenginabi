import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page')) || 1;
        const search = searchParams.get('search') || '';
        const isCampaignOnly = searchParams.get('isCampaignOnly') === 'true';
        const limit = parseInt(searchParams.get('limit')) || 10;

        // Calculate database range
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // 🚀 TRUE SERVER-SIDE PAGINATION
        // We use range(from, to) which works perfectly for high offsets in Supabase.
        // We avoid fetching all rows into memory.

        // 1. Fetch TOTAL Count with filters applied
        let countQuery = supabaseAdmin.from('products').select('*', { count: 'exact', head: true });
        
        if (search.trim()) {
            const words = search.trim().split(/\s+/).filter(w => w.length > 0);
            for (const word of words) {
                countQuery = countQuery.or(`name.ilike.%${word}%,code.ilike.%${word}%,oem_no.ilike.%${word}%,brand.ilike.%${word}%`);
            }
        }
        if (isCampaignOnly) countQuery = countQuery.eq('is_campaign', true);
        
        const { count, error: countErr } = await countQuery;
        if (countErr) throw countErr;

        // 2. Fetch the specific PAGE of data
        let dataQuery = supabaseAdmin
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (search.trim()) {
            const words = search.trim().split(/\s+/).filter(w => w.length > 0);
            for (const word of words) {
                dataQuery = dataQuery.or(`name.ilike.%${word}%,code.ilike.%${word}%,oem_no.ilike.%${word}%,brand.ilike.%${word}%`);
            }
        }
        if (isCampaignOnly) dataQuery = dataQuery.eq('is_campaign', true);

        const { data: products, error: dataErr } = await dataQuery;
        if (dataErr) throw dataErr;

        return NextResponse.json({ 
            products: products || [], 
            totalCount: count || 0 
        });

    } catch (e) {
        console.error("ADMIN LIST API ERROR:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
