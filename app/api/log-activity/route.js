import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll() { /* read only needed here */ }
                }
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { action_type, details } = body;

        // Fire and forget logic
        if (!action_type) {
            return NextResponse.json({ success: false, error: 'Missing action_type' });
        }

        // We use service role to gracefully bypass any RLS on inserts 
        const { error } = await serviceSupabase.from('user_activities').insert({
            company_id: user.id,
            action_type,
            details: details || {}
        });

        if (error) {
            console.error('[log-activity] Insert Error:', error);
            return NextResponse.json({ success: false, error: error.message });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('[log-activity] Server Error:', e);
        return NextResponse.json({ success: false, error: e.message });
    }
}
