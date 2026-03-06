import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { uploadToR2 } from '@/lib/r2/storage';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request) {
    try {
        // 1. Verify Authentication
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    get(name) { return cookieStore.get(name)?.value; }
                }
            }
        );

        // Check if the user is logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        // 2. Pars multipart form data
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
        }

        // 3. Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Optimize the image with Sharp to WebP format
        // Resize max dimensions to 1080px to save space, output at 80% quality
        const optimizedBuffer = await sharp(buffer)
            .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        // 5. Generate a unique name for the file
        const originalName = file.name || 'image.jpg';
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        const newFileName = `products/${Date.now()}-${cleanName}.webp`;

        // 6. Upload to Cloudflare R2
        const publicUrl = await uploadToR2(optimizedBuffer, newFileName, 'image/webp');

        return NextResponse.json({
            success: true,
            url: publicUrl,
            originalSize: Math.round(buffer.length / 1024) + ' KB',
            optimizedSize: Math.round(optimizedBuffer.length / 1024) + ' KB'
        });

    } catch (error) {
        console.error('Yükleme hatası:', error);
        return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
