import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    return handleCleanup(request);
}

export async function POST(request) {
    return handleCleanup(request);
}

async function handleCleanup(request) {
    try {
        // 1. Güvenlik Kontrolü
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // Vercel Cron yetkilendirmesi
        const isCronAuth = !cronSecret || authHeader === `Bearer ${cronSecret}`;
        
        if (!isCronAuth) {
            return NextResponse.json({ success: false, error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 2. Temizlik Tarihi Hesaplama (Her ayın 1'inde önceki ayı silmek için)
        const now = new Date();
        // Bu ayın ilk günü (Saat 00:00:00)
        const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        console.log(`[Cleanup] Mevcut ayın başından önceki loglar siliniyor: ${firstDayOfCurrentMonth}`);

        // 3. Silme İşlemi
        const { error, count } = await supabase
            .from('user_activities')
            .delete({ count: 'exact' })
            .lt('created_at', firstDayOfCurrentMonth);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: `Temizlik başarıyla tamamlandı.`,
            deletedCount: count || 0,
            cutoffDate: firstDayOfCurrentMonth
        });

    } catch (e) {
        console.error('[Cleanup] Sunucu Hatası:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
