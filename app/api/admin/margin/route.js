import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

// Use Service Role to bypass Row Level Security constraints for settings
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        const { data, error } = await supabase
            .from('price_groups')
            .select('discount_percent')
            .eq('name', 'GLOBAL_PROFIT_MARGIN')
            .single();

        if (error || !data) {
            // Auto-heal if missing
            await supabase.from('price_groups').insert({ name: 'GLOBAL_PROFIT_MARGIN', discount_percent: 36 });
            return NextResponse.json({ margin: 36 });
        }

        return NextResponse.json({ margin: data.discount_percent });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { margin } = await req.json();

        const { error } = await supabase
            .from('price_groups')
            .update({ discount_percent: Number(margin) })
            .eq('name', 'GLOBAL_PROFIT_MARGIN');

        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
