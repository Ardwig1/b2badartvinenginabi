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

        // Fetch all active products first (Node.js filtering is more reliable for TR characters)
        let query = adminSupabase
            .from('products')
            .select('id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price')
            .eq('is_active', true);

        const { data: allProducts, error } = await query;
        if (error) throw error;

        if (!filterText || !filterText.trim()) {
            return NextResponse.json(allProducts || []);
        }

        const searchTerm = filterText.trim().toUpperCase();
        
        // Cümleyi kelimelere bölelim (örn: "DUSTER FAR" -> ["DUSTER", "FAR"])
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 0);
        
        // Her kelime için Türkçe karakter duyarlı Regex oluşturalım
        const createTrRegex = (text) => {
            const pattern = text
                .replace(/[Iİ]/g, '[Iİ]')
                .replace(/[OÖ]/g, '[OÖ]')
                .replace(/[UÜ]/g, '[UÜ]')
                .replace(/[CÇ]/g, '[CÇ]')
                .replace(/[GĞ]/g, '[GĞ]')
                .replace(/[SŞ]/g, '[SŞ]');
            return new RegExp(pattern, 'i');
        };

        const wordRegexes = searchWords.map(word => createTrRegex(word));

        // Filtreleme mantığı: Üründe TÜM kelimeler geçmeli (Sıra önemsiz)
        const filtered = allProducts.filter(p => {
            // Her bir kelime (regex) için ürünün alanlarından en az birinde eşleşme var mı?
            return wordRegexes.every(regex => {
                return (
                    (p.name && regex.test(p.name)) ||
                    (p.code && regex.test(p.code)) ||
                    (p.oem_no && regex.test(p.oem_no)) ||
                    (p.brand && regex.test(p.brand))
                );
            });
        });

        return NextResponse.json(filtered);
    } catch (err) {
        console.error("SEARCH ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
