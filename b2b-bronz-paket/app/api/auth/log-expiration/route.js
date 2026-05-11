import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const serviceSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Decodes the base64url payload of a JWT
function parseJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Using Buffer in Node/Edge to decode
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { cookie } = body;

        if (!cookie) {
            return NextResponse.json({ success: false, error: 'No cookie provided' }, { status: 400 });
        }

        // The cookie value from supabase is often an array or JSON, but usually looks like:
        // base64-encoded-jwt... or similar.
        // Supabase SSR cookies are usually chunked or stored as base64.
        // Let's extract the actual JWT string from it.
        let jwtString = '';
        try {
            // It could be JSON.stringify(['access_token', 'refresh_token', ...])
            const parsed = JSON.parse(cookie);
            if (Array.isArray(parsed) && parsed.length > 0) {
                jwtString = parsed[0];
            } else {
                jwtString = cookie;
            }
        } catch {
            jwtString = cookie;
        }

        const payload = parseJwtPayload(jwtString);
        
        if (!payload || !payload.sub) {
            return NextResponse.json({ success: false, error: 'Invalid JWT payload' }, { status: 400 });
        }

        const userId = payload.sub;

        // Find the company_id for this user
        const { data: profile } = await serviceSupabase
            .from('profiles')
            .select('company_id')
            .eq('id', userId)
            .maybeSingle();

        if (profile?.company_id) {
            // Check if there is already a recent session_expired log within the last 5 minutes to prevent spam
            // (e.g. if middleware hits this multiple times in quick succession)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: recentLog } = await serviceSupabase
                .from('user_activities')
                .select('id')
                .eq('company_id', profile.company_id)
                .eq('action_type', 'session_expired')
                .gte('created_at', fiveMinutesAgo)
                .limit(1)
                .maybeSingle();

            if (!recentLog) {
                // Insert the log
                await serviceSupabase.from('user_activities').insert({
                    company_id: profile.company_id,
                    action_type: 'session_expired',
                    details: { reason: 'auto_logged_out', timestamp: new Date().toISOString() }
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('[log-expiration] Error:', e.message);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
