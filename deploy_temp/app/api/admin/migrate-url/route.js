import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { uploadToR2 } from '@/lib/r2/storage';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    try {
        const {
            productId, imageUrl, migrationKey, serviceRoleKey,
            r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2PublicUrl
        } = await request.json();

        if (migrationKey !== 'SUPER_SECRET_MIGRATION_KEY') {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        if (!productId || !imageUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey
        );

        console.log(`[Vercel Migration] İndiriliyor: ${imageUrl}`);

        // 1. Download from Supabase (Server-side)
        const supRes = await fetch(imageUrl);
        if (!supRes.ok) {
            throw new Error(`Supabase indirme hatası: HTTP ${supRes.status}`);
        }

        const arrayBuffer = await supRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Optimize
        const optimizedBuffer = await sharp(buffer)
            .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Upload to R2 manually
        const cleanName = productId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        const fileName = `products/migrated-${Date.now()}-${cleanName}.webp`;

        const r2Config = {
            accountId: r2AccountId,
            accessKeyId: r2AccessKeyId,
            secretAccessKey: r2SecretAccessKey,
            bucketName: r2BucketName,
            publicUrl: r2PublicUrl
        };

        const newUrl = await uploadToR2(optimizedBuffer, fileName, 'image/webp', r2Config);

        console.log(`[Vercel Migration] R2'ye Yüklendi: ${newUrl}`);

        // 4. Update DB
        const { error } = await supabase
            .from('products')
            .update({ image_url: newUrl })
            .eq('id', productId);

        if (error) throw error;

        return NextResponse.json({ success: true, newUrl });

    } catch (error) {
        console.error('[Vercel Migration] Hata:', error);
        return NextResponse.json({
            error: error.message,
            stack: error.stack,
            cause: error.cause ? String(error.cause) : null
        }, { status: 500 });
    }
}
