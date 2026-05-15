import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

// Use Service Role to bypass Row Level Security constraints for settings
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    try {
        const { data: rateData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE').limit(1);
        const { data: activeData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE_ACTIVE').limit(1);

        let usd_rate = (rateData && rateData.length > 0) ? rateData[0].discount_percent : 0;
        let is_active = (activeData && activeData.length > 0) ? activeData[0].discount_percent === 1 : false;

        return NextResponse.json({ usd_rate, is_active });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { usd_rate, is_active, applyToAll, isTargeted, targetField, targetValue } = await req.json();

        // 1. Update Global Settings
        if (!isTargeted) {
            if (is_active !== undefined && is_active === false) {
                // User turned off USD fixing, delete records from DB to prevent clutter
                await supabase.from('price_groups').delete().in('name', ['USD_FIXED_RATE', 'USD_FIXED_RATE_ACTIVE']);
            } else {
                // Active or just updating rate
                if (usd_rate !== undefined) {
                    const { data } = await supabase.from('price_groups').select('id').eq('name', 'USD_FIXED_RATE').limit(1);
                    if (data && data.length > 0) {
                        await supabase.from('price_groups').update({ discount_percent: Number(usd_rate) }).eq('name', 'USD_FIXED_RATE');
                    } else {
                        await supabase.from('price_groups').insert({ name: 'USD_FIXED_RATE', discount_percent: Number(usd_rate) });
                    }
                }
                if (is_active !== undefined) {
                    const { data } = await supabase.from('price_groups').select('id').eq('name', 'USD_FIXED_RATE_ACTIVE').limit(1);
                    if (data && data.length > 0) {
                        await supabase.from('price_groups').update({ discount_percent: 1 }).eq('name', 'USD_FIXED_RATE_ACTIVE');
                    } else {
                        await supabase.from('price_groups').insert({ name: 'USD_FIXED_RATE_ACTIVE', discount_percent: 1 });
                    }
                }
            }
        }



        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
