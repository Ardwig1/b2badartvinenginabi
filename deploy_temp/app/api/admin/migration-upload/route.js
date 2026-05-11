import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { uploadToR2 } from '@/lib/r2/storage';

export async function POST(request) {
    try {
        // Migration bypass key check
        const migrationKey = request.headers.get('x-migration-key');
        if (migrationKey !== 'SUPER_SECRET_MIGRATION_KEY') {
            return NextResponse.json({ error: 'Yetkisiz erişim (Migration key geçersiz)' }, { status: 401 });
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Cloudflare R2
        // Since the image is already optimized by the migration script or we just want to push it directly,
        // we'll just forward it to R2
        const originalName = file.name || `image_${Date.now()}.jpg`;
        const publicUrl = await uploadToR2(buffer, `products/migrated_${originalName}`, file.type || 'image/webp');

        return NextResponse.json({
            success: true,
            url: publicUrl
        });

    } catch (error) {
        console.error('Migration Yükleme hatası:', error);
        return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
