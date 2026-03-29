import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Use admin client to bypass RLS for representative assignments
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 1. Fetch assigned companies
        const { data: assignments, error: assignError } = await adminSupabase
            .from('representative_assignments')
            .select('company_id, companies(*)')
            .eq('representative_id', user.id);

        if (assignError) throw assignError;

        const companies = assignments?.map(a => a.companies).filter(Boolean) || [];
        return NextResponse.json(companies);

    } catch (err) {
        console.error('Rep Companies API Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
