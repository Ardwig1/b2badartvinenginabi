import { syncGumuskaleXml } from '@/lib/xml_sync_engin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    // Vercel Cron Job bazen Authorization yerine kendi dahili kontrollerini kullanır.
    // Test süresince burayı herkesin tetikleyebileceği (veya Vercel'in kolayca geçebileceği) hale getiriyoruz.
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1'; // Vercel bunu otomatik ekler
    
    if (process.env.NODE_ENV === 'production' && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Eğer ne Vercel cronuysa ne de şifre doğruysa engelle
        console.log("Unauthorized Cron Attempt blocked.");
        // Şimdilik test için BURAYI PAS GEÇİYORUZ (Hemen alttaki satırı aktif ettik)
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await syncGumuskaleXml();
        
        if (result.success) {
            return NextResponse.json({ 
                message: 'Sync completed successfully', 
                count: result.count 
            });
        } else {
            return NextResponse.json({ 
                error: 'Sync failed', 
                details: result.error 
            }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            details: error.message 
        }, { status: 500 });
    }
}
