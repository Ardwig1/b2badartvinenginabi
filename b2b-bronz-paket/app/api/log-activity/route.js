import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const serviceSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
    try {
        const body = await request.json();
        const { action_type, details } = body;
        let { company_id } = body;

        if (!action_type) return NextResponse.json({ success: false, error: 'Missing action_type' });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        // Get user's profile to find their own company_id
        const { data: profile } = await serviceSupabase.from('profiles').select('company_id, is_admin').eq('id', user.id).maybeSingle();
        
        // If company_id is not provided by client, use the user's own company_id
        if (!company_id) {
            company_id = profile?.company_id;
        }

        if (!company_id) return NextResponse.json({ success: false, error: 'Could not determine company_id' });

        // --- AUTH CHECK ---
        const isAdmin = !!profile?.is_admin;
        const isOwner = profile?.company_id === company_id;
        
        // Check if user is a representative for this company
        const isRepMetadata = user.user_metadata?.role === 'representative';
        const { data: repAssignment } = await serviceSupabase
            .from('representative_assignments')
            .select('representative_id')
            .eq('representative_id', user.id)
            .eq('company_id', company_id)
            .limit(1)
            .maybeSingle();
        const isRepForThisCompany = isRepMetadata || !!repAssignment;

        // Allow if Admin OR Representative for this company OR the Company Owner
        if (!isAdmin && !isRepForThisCompany && !isOwner) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await serviceSupabase.from('user_activities').insert({
            company_id,
            action_type,
            details: details || {}
        });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('[log-activity] Error:', e.message);
        return NextResponse.json({ success: false, error: e.message });
    }
}
