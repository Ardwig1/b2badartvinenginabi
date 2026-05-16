const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Toplam ürün sayısını kontrol et
    const { count, error: countErr } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
    
    console.log("📊 Toplam Ürün Sayısı (DB):", count);

    // 2. İlk 5 ürünü çekip kolon değerlerine bakalım (is_active vb.)
    const { data: samples, error: sampleErr } = await supabase
        .from('products')
        .select('*')
        .limit(5);
    
    console.log("🧪 Örnek Ürünler (İlk 5):", JSON.stringify(samples, null, 2));

    // 3. Arama motorunun baktığı alanları kontrol et
    if (samples && samples.length > 0) {
        const p = samples[0];
        console.log("🔍 Arama Alanları Kontrolü:");
        console.log("- code:", p.code);
        console.log("- name:", p.name);
        console.log("- is_active:", p.is_active);
    }
}
check();