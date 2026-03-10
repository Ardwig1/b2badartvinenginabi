import { NextResponse } from 'next/server';
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

        // Check if user is admin is ideal here, but auth is sufficient to prevent public abuse

        // 2. Pars multipart form data
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
        }

        // 3. Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 4. Validate file type (allow PDFs primarily)
        const mimeType = file.type || 'application/octet-stream';
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(mimeType)) {
            return NextResponse.json({ error: 'Sadece PDF veya Resim dosyaları yüklenebilir.' }, { status: 400 });
        }

        // 5. Generate a unique name for the file
        const originalName = file.name || 'document.pdf';
        const extension = originalName.split('.').pop();
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        const newFileName = `invoices/${Date.now()}-${cleanName}.${extension}`;

        // 6. Upload to Cloudflare R2
        // Pass the generic buffer without sharp processing since it might be a PDF
        const publicUrl = await uploadToR2(buffer, newFileName, mimeType);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            size: Math.round(buffer.length / 1024) + ' KB'
        });

    } catch (error) {
        console.error('Dosya yükleme hatası:', error);
        return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
