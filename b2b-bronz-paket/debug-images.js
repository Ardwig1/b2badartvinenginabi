import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrokenImages() {
    console.log("Supabase Veritabanından rastgele 15 ürün görseli URL'si çekiliyor...\n");

    const { data: products, error } = await supabase
        .from('products')
        .select('id, code, name, image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .limit(15);

    if (error) {
        console.error("Hata:", error);
        return;
    }

    products.forEach((p, index) => {
        console.log(`${index + 1}. [${p.code}] ${p.name.substring(0, 20)}...`);
        console.log(`   URL: ${p.image_url}`);

        if (p.image_url && p.image_url.includes('undefined')) {
            console.log("   ❌ UYARI: URL'de 'undefined' ibaresi var!");
        } else if (p.image_url && !p.image_url.startsWith('http')) {
            console.log("   ❌ UYARI: URL 'http' ile başlamıyor!");
        } else {
            console.log("   ✅ Görünüşe göre format normal.");
        }
        console.log("------------------------------------------");
    });
}

checkBrokenImages();
