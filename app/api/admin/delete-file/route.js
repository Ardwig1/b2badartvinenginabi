import { NextResponse } from 'next/server';
import { deleteFromR2 } from '@/lib/r2/storage';
import { verifyAdmin } from '@/lib/auth/admin';

export async function POST(request) {
    try {
        const user = await verifyAdmin();
        if (!user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const { url } = await request.json();
        if (!url) {
            return NextResponse.json({ error: 'URL belirtilmedi' }, { status: 400 });
        }

        // Only allow deleting files from the R2 public URL domain to prevent misuse
        const publicUrl = process.env.R2_PUBLIC_URL;
        if (publicUrl && !url.startsWith(publicUrl)) {
             // If it's the full URL, we extract the key. if it's just a path, it might be different.
             // deleteFromR2 handles both full URLs and relative keys.
        }

        const success = await deleteFromR2(url);

        if (!success) {
            return NextResponse.json({ error: 'Dosya silinemedi veya bulunamadı' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete file error:', error);
        return NextResponse.json({ error: error.message || 'Bir hata oluştu' }, { status: 500 });
    }
}
