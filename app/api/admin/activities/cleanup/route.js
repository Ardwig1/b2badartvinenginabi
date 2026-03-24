import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Configuration: Days of logs to keep
const DAYS_TO_KEEP = 30;

export async function GET(request) {
    return handleCleanup(request);
}

export async function POST(request) {
    return handleCleanup(request);
}

async function handleCleanup(request) {
    try {
        // 1. Security Check
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // Verify via CRON_SECRET (for Vercel Cron)
        const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
        
        // If not cron auth, we could check for an admin session here if needed
        // but for now let's stick to the Cron Secret or allow if no secret is set (for testing)
        // [IMPORTANT] In production, CRON_SECRET MUST be set.
        if (cronSecret && !isCronAuth) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Initialize Supabase Admin Client
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 3. Calculate Cut-off Date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
        const cutoffStr = cutoffDate.toISOString();

        console.log(`[Cleanup] Deleting activities older than: ${cutoffStr}`);

        // 4. Perform Deletion
        const { data, error, count } = await supabase
            .from('user_activities')
            .delete({ count: 'exact' })
            .lt('created_at', cutoffStr);

        if (error) {
            console.error('[Cleanup] Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Cleanup completed successfully.`,
            deletedCount: count || 0,
            cutoffDate: cutoffStr
        });

    } catch (e) {
        console.error('[Cleanup] Server Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
