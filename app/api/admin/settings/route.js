import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: profile } = await adminSupabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { data, error } = await adminSupabase
            .from('site_settings')
            .select('*')
            .in('setting_key', ['maintenance_mode', 'admin_notifications']);

        if (error) throw error;

        const settingsMap = {};
        data?.forEach(s => {
            settingsMap[s.setting_key] = s.setting_value;
        });

        return NextResponse.json({
            maintenance_mode: settingsMap.maintenance_mode || {},
            admin_notifications: settingsMap.admin_notifications || { email: '', enabled: false }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: profile } = await adminSupabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { key, value } = body;

        if (!key) return NextResponse.json({ error: 'Missing setting key' }, { status: 400 });

        const { error } = await adminSupabase
            .from('site_settings')
            .upsert({
                setting_key: key,
                setting_value: value,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
