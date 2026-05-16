import { syncGumuskaleXml } from '@/lib/xml_sync_engin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    
    // Güvenlik kontrolü
    if (process.env.NODE_ENV === 'production' && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 🚀 FAIL-SAFE: Bugün zaten çalıştı mı kontrolü
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const today = new Date().toISOString().split('T')[0];

        const { data: syncStatus } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'last_xml_sync')
            .single();

        if (syncStatus?.setting_value?.date === today && syncStatus?.setting_value?.status === 'success') {
            return NextResponse.json({ message: 'Already synced today', date: today });
        }

        // Değilse başlat
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
