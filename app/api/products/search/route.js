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

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;
        const isImpersonating = impId && impId !== 'undefined' && impId !== '';

        if (isImpersonating) {
            // Check if representative: 
            // 1. In metadata
            // 2. In customer_representatives table (more reliable after re-adds)
            const isRepMetadata = user.user_metadata?.role === 'representative';
            const { data: repRecord } = await adminSupabase
                .from('customer_representatives')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            
            const isRep = isRepMetadata || !!repRecord;

            if (profile?.is_admin || isRep) return impId;
        }

        return profile?.company_id;
    } catch (e) {
        console.error("getEffectiveCompanyId Error:", e);
        return null;
    }
}

export async function POST(req) {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { filterText, brand, carBrand, carModel, is_new, is_campaign, page = 1, perPage = 1000 } = body;

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const productColumns = 'id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price';
        let query = adminSupabase.from('products').select(productColumns).eq('is_active', true);

        if (filterText && filterText.trim()) {
            const words = filterText.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);
            words.forEach(word => {
                const wordEng = word.replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ç/g, 'C');
                const wordTr = word.replace(/I/g, 'İ').replace(/G/g, 'Ğ').replace(/U/g, 'Ü').replace(/Ö/g, 'O').replace(/S/g, 'Ş').replace(/C/g, 'Ç');
                const variants = [...new Set([word, wordEng, wordTr])];
                const columns = ['name', 'code', 'oem_no', 'brand'];
                const orParts = [];
                variants.forEach(v => {
                    const term = `%${v}%`;
                    columns.forEach(col => orParts.push(`${col}.ilike.${term}`));
                });
                query = query.or(orParts.join(','));
            });
        }

        if (brand) query = query.eq('brand', brand);
        if (carBrand) query = query.eq('car_brand', carBrand);
        if (carModel) query = query.eq('car_model', carModel);
        if (is_campaign) query = query.eq('is_campaign', true);

        // Date logic for is_new (within last 7 days)
        if (is_new) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query = query.gte('created_at', oneWeekAgo.toISOString());
        }

        const { data, error } = await query.order('brand').order('name');
        if (error) throw error;

        // Note: The frontend currently does the final client-side filtering and pagination.
        // I will return the data as requested. If I wanted to do pagination here:
        // const from = (page - 1) * perPage;
        // const to = from + perPage - 1;
        // query = query.range(from, to);

        return NextResponse.json(data || []);
    } catch (err) {
        console.error("PRODUCTS SEARCH API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
