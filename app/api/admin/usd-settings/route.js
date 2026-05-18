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
        const { data: usdRateData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE').limit(1);
        const { data: usdActiveData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE_ACTIVE').limit(1);
        const { data: eurRateData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'EUR_FIXED_RATE').limit(1);
        const { data: eurActiveData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'EUR_FIXED_RATE_ACTIVE').limit(1);

        let usd_rate = (usdRateData && usdRateData.length > 0) ? usdRateData[0].discount_percent : 0;
        let is_active = (usdActiveData && usdActiveData.length > 0) ? usdActiveData[0].discount_percent === 1 : false;
        
        let eur_rate = (eurRateData && eurRateData.length > 0) ? eurRateData[0].discount_percent : 0;
        let eur_active = (eurActiveData && eurActiveData.length > 0) ? eurActiveData[0].discount_percent === 1 : false;

        return NextResponse.json({ usd_rate, is_active, eur_rate, eur_active });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { usd_rate, is_active, eur_rate, eur_active, currency = 'USD' } = await req.json();

        // 1. Update USD Settings
        if (currency === 'USD') {
            if (is_active === false) {
                await supabase.from('price_groups').delete().in('name', ['USD_FIXED_RATE', 'USD_FIXED_RATE_ACTIVE']);
            } else {
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

        // 2. Update EUR Settings
        if (currency === 'EUR') {
            if (eur_active === false) {
                await supabase.from('price_groups').delete().in('name', ['EUR_FIXED_RATE', 'EUR_FIXED_RATE_ACTIVE']);
            } else {
                if (eur_rate !== undefined) {
                    const { data } = await supabase.from('price_groups').select('id').eq('name', 'EUR_FIXED_RATE').limit(1);
                    if (data && data.length > 0) {
                        await supabase.from('price_groups').update({ discount_percent: Number(eur_rate) }).eq('name', 'EUR_FIXED_RATE');
                    } else {
                        await supabase.from('price_groups').insert({ name: 'EUR_FIXED_RATE', discount_percent: Number(eur_rate) });
                    }
                }
                if (eur_active !== undefined) {
                    const { data } = await supabase.from('price_groups').select('id').eq('name', 'EUR_FIXED_RATE_ACTIVE').limit(1);
                    if (data && data.length > 0) {
                        await supabase.from('price_groups').update({ discount_percent: 1 }).eq('name', 'EUR_FIXED_RATE_ACTIVE');
                    } else {
                        await supabase.from('price_groups').insert({ name: 'EUR_FIXED_RATE_ACTIVE', discount_percent: 1 });
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
