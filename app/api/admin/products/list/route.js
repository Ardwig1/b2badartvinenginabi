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

        // 🚀 BYPASSING THE 1000 ROW LIMIT FOR GOOD
        // We fetch ALL valid IDs and data in chunks on the server side, 
        // then slice it for the user. This is the only way to bypass Supabase's PostgREST limits.
        
        let allProducts = [];
        let lastId = null;
        let hasMore = true;

        while (hasMore && allProducts.length < 100000) { // Support up to 100k
            let query = supabaseAdmin
                .from('products')
                .select('*')
                .order('id', { ascending: true }) // Use ID for stable pagination in loop
                .limit(1000);
            
            if (lastId) query = query.gt('id', lastId);

            // Apply Filters in the scan
            if (search.trim()) {
                const words = search.trim().split(/\s+/).filter(w => w.length > 0);
                for (const word of words) {
                    query = query.or(`name.ilike.%${word}%,code.ilike.%${word}%,oem_no.ilike.%${word}%,brand.ilike.%${word}%`);
                }
            }
            if (isCampaignOnly) query = query.eq('is_campaign', true);

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                allProducts = [...allProducts, ...data];
                lastId = data[data.length - 1].id;
                if (data.length < 1000) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        // Apply global ordering after fetching all (Optional, since we used ID for loop)
        // But for user experience, let's sort by created_at descending
        allProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalCount = allProducts.length;
        const from = (page - 1) * limit;
        const to = from + limit;
        const paginatedProducts = allProducts.slice(from, to);

        return NextResponse.json({ 
            products: paginatedProducts, 
            totalCount: totalCount 
        });

    } catch (e) {
        console.error("ADMIN LIST API ERROR:", e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
