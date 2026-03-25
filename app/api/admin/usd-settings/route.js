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
        const { data: rateData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE').single();
        const { data: activeData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE_ACTIVE').single();

        let usd_rate = rateData ? rateData.discount_percent : 0;
        let is_active = activeData ? activeData.discount_percent === 1 : false;

        // Auto-heal if missing
        if (!rateData) await supabase.from('price_groups').insert({ name: 'USD_FIXED_RATE', discount_percent: 0 });
        if (!activeData) await supabase.from('price_groups').insert({ name: 'USD_FIXED_RATE_ACTIVE', discount_percent: 0 });

        return NextResponse.json({ usd_rate, is_active });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { usd_rate, is_active } = await req.json();

        if (usd_rate !== undefined) {
            await supabase.from('price_groups').update({ discount_percent: Number(usd_rate) }).eq('name', 'USD_FIXED_RATE');
        }
        if (is_active !== undefined) {
            await supabase.from('price_groups').update({ discount_percent: is_active ? 1 : 0 }).eq('name', 'USD_FIXED_RATE_ACTIVE');
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
