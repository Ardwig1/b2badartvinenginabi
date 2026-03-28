import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getEffectiveCompanyId() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const cookieStore = await cookies();
        const impId = cookieStore.get('impersonate_company_id')?.value;

        // Fetch current user profile
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('company_id, is_admin')
            .eq('id', user.id)
            .maybeSingle();

        // If showroom is active and user is admin, return the impersonated ID
        if (profile?.is_admin && impId && impId !== 'undefined') {
            return impId;
        }

        return profile?.company_id;
    } catch (e) {
        console.error("getEffectiveCompanyId Error:", e);
        return null;
    }
}

export async function GET() {
    try {
        const companyId = await getEffectiveCompanyId();
        if (!companyId) return NextResponse.json([]);

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (err) {
        console.error("ORDERS API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
