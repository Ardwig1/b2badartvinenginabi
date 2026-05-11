import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Oturum açılmamış' }, { status: 401 });

        // Verify admin or representative (Double Check: Metadata + DB)
        let isAuthorized = user.user_metadata?.role === 'representative';
        
        if (!isAuthorized) {
            // Check DB directly if metadata is missing
            const { data: repCheck } = await supabase
                .from('customer_representatives')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            if (repCheck) isAuthorized = true;
        }

        if (!isAuthorized) {
            // Check if Admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', user.id)
                .maybeSingle();
            if (profile?.is_admin) isAuthorized = true;
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });
        }

        const { companyId } = await req.json();
        if (!companyId) {
            return NextResponse.json({ error: 'Firma ID gerekli' }, { status: 400 });
        }

        // Set impersonation cookie
        const cookieStore = await cookies();
        cookieStore.set('impersonate_company_id', companyId, {
            path: '/',
            httpOnly: false, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 // 1 day
        });
        
        // Extra cookie to force client update
        cookieStore.set('showroom_ts', Date.now().toString(), { path: '/' });

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete('impersonate_company_id');
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
