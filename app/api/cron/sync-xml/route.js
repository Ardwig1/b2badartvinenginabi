import { syncGumuskaleXml } from '@/lib/xml_sync_engin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
    const authHeader = req.headers.get('authorization');
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const urlSecret = new URL(req.url).searchParams.get('secret');
    const validSecret = process.env.CRON_SECRET || 'b2badartvinenginabi_123';

    // Güvenlik kontrolü
    if (process.env.NODE_ENV === 'production' && !isVercelCron && authHeader !== `Bearer ${validSecret}` && urlSecret !== validSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
