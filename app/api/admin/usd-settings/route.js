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
        const { data: rateData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE').limit(1);
        const { data: activeData } = await supabase.from('price_groups').select('discount_percent').eq('name', 'USD_FIXED_RATE_ACTIVE').limit(1);

        let usd_rate = (rateData && rateData.length > 0) ? rateData[0].discount_percent : 0;
        let is_active = (activeData && activeData.length > 0) ? activeData[0].discount_percent === 1 : false;

        // Auto-heal if missing
        if (!rateData || rateData.length === 0) await supabase.from('price_groups').upsert({ name: 'USD_FIXED_RATE', discount_percent: 0 }, { onConflict: 'name' });
        if (!activeData || activeData.length === 0) await supabase.from('price_groups').upsert({ name: 'USD_FIXED_RATE_ACTIVE', discount_percent: 0 }, { onConflict: 'name' });

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

        // 1. Update Global Settings (Only if not a targeted mass update)
        if (!isTargeted) {
            if (usd_rate !== undefined) {
                await supabase.from('price_groups').update({ discount_percent: Number(usd_rate) }).eq('name', 'USD_FIXED_RATE');
            }
            if (is_active !== undefined) {
                await supabase.from('price_groups').update({ discount_percent: is_active ? 1 : 0 }).eq('name', 'USD_FIXED_RATE_ACTIVE');
            }
        }

        // 2. Targeted or Mass Update on Products
        if (applyToAll) {
            let query = supabase.from('products').select('id, code, name').eq('currency', 'USD');

            if (isTargeted && targetField && targetValue !== undefined) {
                if (['is_fixed_price', 'is_campaign'].includes(targetField)) {
                    query = query.eq(targetField, targetValue === 'true' || targetValue === '1');
                } else if (['cost_price', 'profit_margin', 'discount_rate', 'cart_discount_rate', 'box_quantity', 'stock_merkez', 'stock_depo'].includes(targetField)) {
                    query = query.eq(targetField, Number(targetValue));
                } else {
                    query = query.ilike(targetField, `%${targetValue}%`);
                }
            }

            const { data: products, error: fetchError } = await query;
            if (fetchError) throw new Error(fetchError.message);

            if (products && products.length > 0) {
                const updates = products.map(p => ({
                    id: p.id,
                    fixed_usd_rate: Number(usd_rate)
                }));

                const { error: updateError } = await supabase
                    .from('products')
                    .upsert(updates);

                if (updateError) throw new Error(updateError.message);
                return NextResponse.json({ success: true, updatedCount: products.length });
            }
            return NextResponse.json({ success: true, updatedCount: 0 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
