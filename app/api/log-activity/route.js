import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Use service role to bypass all RLS
const serviceSupabase = createAdminClient(
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

        // --- AUTH CHECK ---
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await serviceSupabase.from('profiles').select('company_id, is_admin').eq('id', user.id).maybeSingle();
        
        const isRepMetadata = user.user_metadata?.role === 'representative';
        const { data: repAssignment } = await serviceSupabase
            .from('representative_assignments')
            .select('representative_id')
            .eq('representative_id', user.id)
            .eq('company_id', company_id)
            .limit(1)
            .maybeSingle();
        const isRepForThisCompany = isRepMetadata || !!repAssignment;

        const isOwner = profile?.company_id === company_id;
        const isAdmin = !!profile?.is_admin;

        if (!isAdmin && !isRepForThisCompany && !isOwner) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
        // ------------------

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
