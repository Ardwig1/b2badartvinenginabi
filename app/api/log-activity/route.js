import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role to bypass all RLS
const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { action_type, details, company_id } = body;

        if (!action_type) {
            return NextResponse.json({ success: false, error: 'Missing action_type' });
        }

        // company_id must be provided by the client
        if (!company_id) {
            return NextResponse.json({ success: false, error: 'Missing company_id' });
        }

        // Validate that the company_id is a real company (security check)
        const { data: company } = await serviceSupabase
            .from('companies')
            .select('id')
            .eq('id', company_id)
            .single();

        if (!company) {
            return NextResponse.json({ success: false, error: 'Invalid company_id' });
        }

        const { error } = await serviceSupabase.from('user_activities').insert({
            company_id,
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
