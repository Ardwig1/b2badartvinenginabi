import { createClient } from '@supabase/supabase-js';

// Bu bir API Route taslağıdır (app/api/sync/basbug/route.js)
export async function GET(req) {
    // 1. GÜVENLİK: Sadece Vercel Cron veya Admin tetikleyebilsin
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // Kritik: RLS'i aşmak için Service Role şart
    );

    try {
        console.log("🔄 Gece yarısı senkronizasyonu başladı...");

        // 2. BAŞBUĞ VERİSİNİ ÇEK (Az önceki script mantığıyla)
        // Burada Başbuğ API'sine login olup döngüyle tüm grupları çekeceğiz.
        const allProducts = await fetchBasbugData(); 

        // 3. SUPABASE'E YAZ (1000'erli paketler halinde)
        const batchSize = 1000;
        for (let i = 0; i < allProducts.length; i += batchSize) {
            const batch = allProducts.slice(i, i + batchSize).map(item => ({
                code: item.no,           // Başbuğ No -> Bizim Ürün Kodu
                name: item.tanim || '',  // Başbuğ Tanım -> Ürün Adı
                stock_quantity: item.stok,
                brand: item.marka,
                list_price: item.fiyat,
                currency: 'TRY',
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('products')
                .upsert(batch, { onConflict: 'code' }); // 'code' (Ürün Kodu) çakışırsa güncelle

            if (error) throw error;
            console.log(`✅ ${i + batch.length} ürün işlendi...`);
        }

        return new Response('Sync Completed Successfully', { status: 200 });

    } catch (err) {
        console.error("❌ Sync Error:", err.message);
        return new Response('Sync Failed', { status: 500 });
    }
}
