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
        let { filterText, brand, carBrand, carModel, is_new, is_campaign } = body;

        const adminSupabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const searchTerm = filterText ? filterText.trim() : '';
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
        
        // Veritabanı seviyesinde akıllı filtreleme
        let query = adminSupabase
            .from('products')
            .select('id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price, is_fixed_price, fixed_price_value, fixed_price_currency, cart_discount_rate, fixed_usd_rate, supplier_brand')
            .eq('is_active', true);

        // 🔍 1. Marka Filtresi (Eğer seçildiyse)
        if (brand) {
            query = query.eq('brand', brand);
        }

        // 🚗 2. Araç Markası Filtresi
        if (carBrand) {
            query = query.eq('car_brand', carBrand);
        }

        // 🚙 3. Araç Modeli Filtresi
        if (carModel) {
            query = query.eq('car_model', carModel);
        }

        // ✨ 4. Yeni/Kampanyalı Ürün Filtreleri
        if (is_new) query = query.eq('is_new', true);
        if (is_campaign) query = query.eq('is_campaign', true);

        // ⌨️ 5. Metin Arama — tüm ilgili alanlarda ara
        if (searchWords.length > 0) {
            for (const word of searchWords) {
                query = query.or(`name.ilike.%${word}%,code.ilike.%${word}%,oem_no.ilike.%${word}%,brand.ilike.%${word}%,car_brand.ilike.%${word}%,car_model.ilike.%${word}%,category.ilike.%${word}%`);
            }
        }

        // Sonuçları çek (Sıralama ve Limit)
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(1000);
            
        if (error) throw error;

        return NextResponse.json(data || []);
    } catch (err) {
        console.error("SEARCH ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
