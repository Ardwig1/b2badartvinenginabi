import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getEffectiveCompanyId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await adminSupabase.from('profiles').select('is_admin, company_id').eq('id', user.id).maybeSingle();
        return profile?.company_id;
    } catch (e) {
        return null;
    }
}

export async function POST(req) {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        let { filterText } = body;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // SUPABASE HARD LIMIT FIX: 
        // Tek seferde 1000'den fazla ürün çekmek için döngü kullanıyoruz.
        const fetchAllProducts = async (baseQuery) => {
            let allData = [];
            let lastId = null;
            let hasMore = true;
            
            while (hasMore && allData.length < 10000) { // Güvenli üst sınır 10 bin
                let query = baseQuery.order('id', { ascending: true }).limit(1000);
                if (lastId) query = query.gt('id', lastId);
                
                const { data, error } = await query;
                if (error) throw error;
                
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    lastId = data[data.length - 1].id;
                    if (data.length < 1000) hasMore = false;
                } else {
                    hasMore = false;
                }
            }
            return allData;
        };

        if (!filterText || !filterText.trim()) {
            const baseQuery = adminSupabase
                .from('products')
                .select('id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price, is_fixed_price, fixed_price_value, fixed_price_currency, cart_discount_rate, fixed_usd_rate, supplier_brand')
                .eq('is_active', true);
            
            const data = await fetchAllProducts(baseQuery);
            return NextResponse.json(data);
        }

        const searchTerm = filterText.trim();
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
        
        let query = adminSupabase
            .from('products')
            .select('id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price, is_fixed_price, fixed_price_value, fixed_price_currency, cart_discount_rate, fixed_usd_rate, supplier_brand')
            .eq('is_active', true);

        for (const word of searchWords) {
            query = query.or(`name.ilike.%${word}%,code.ilike.%${word}%,oem_no.ilike.%${word}%,brand.ilike.%${word}%`);
        }

        const filtered = await fetchAllProducts(query);
        return NextResponse.json(filtered);
    } catch (err) {
        console.error("SEARCH ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
