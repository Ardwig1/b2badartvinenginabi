import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
// Fallback service role key the user provided
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';
const supabase = createClient(supabaseUrl, supabaseKey);

const VERCEL_URL = 'https://b2b.omigroups.com/api/admin/migrate-url';

async function migrateImages() {
    console.log('--- Resim Göçü Başlıyor (Vercel Serverless Proxy) ---');

    const { data: products, error } = await supabase.from('products').select('*').not('image_url', 'is', null).neq('image_url', '');
    if (error) { console.error('Hata:', error); return; }

    console.log(`Toplam ${products.length} adet resimli ürün bulundu.`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
        try {
            const oldUrl = product.image_url;
            // Prevent re-migrating already migrated images
            if (oldUrl.includes('r2.dev') || oldUrl.includes('cloudflarestorage')) continue;

            console.log(`\nİşleniyor: ${product.code} (${oldUrl})`);

            const r2AccountId = process.env.R2_ACCOUNT_ID?.replace(/"/g, '') || '50774ec5be54c155fa03b5a5c94b40c4';
            const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.replace(/"/g, '') || '21de8c75d53421e25b014e5a275d1f1d';
            const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.replace(/"/g, '') || '61c5aae3080bd6f10f7399f4737bb45673c75b62762bd79985be773faaf4570c';
            const r2BucketName = process.env.R2_BUCKET_NAME?.replace(/"/g, '') || 'b2b';
            const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/"/g, '') || 'https://cdn.omigroups.com';

            // Request Vercel to do the heavily lifting (download, resize, upload to R2, DB update)
            const response = await fetch(VERCEL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: product.id,
                    imageUrl: oldUrl,
                    migrationKey: 'SUPER_SECRET_MIGRATION_KEY',
                    serviceRoleKey: supabaseKey,
                    r2AccountId,
                    r2AccessKeyId,
                    r2SecretAccessKey,
                    r2BucketName,
                    r2PublicUrl
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status} - ${text}`);
            }

            const result = await response.json();
            if (result.success) {
                console.log(`  --> [BAŞARILI] R2'ye Yüklendi: ${result.newUrl}`);
                successCount++;
            } else {
                throw new Error(result.error || 'Bilinmeyen API hatası');
            }

        } catch (err) {
            console.error(`  --> [HATA] ${product.code}:`, err.message);
            failCount++;
        }
    }

    console.log('\n--- Göç Tamamlandı ---');
    console.log(`Başarılı: ${successCount} | Başarısız: ${failCount}`);
}

migrateImages();
