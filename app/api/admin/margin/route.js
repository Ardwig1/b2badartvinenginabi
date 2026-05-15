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
        // Fetch the global margin setting, handle multiple results by taking the first one
        const { data, error } = await supabase
            .from('price_groups')
            .select('discount_percent')
            .eq('name', 'GLOBAL_PROFIT_MARGIN')
            .limit(1);

        if (error || !data || data.length === 0) {
            // If missing, create it with a default value of 36
            await supabase.from('price_groups').insert({ name: 'GLOBAL_PROFIT_MARGIN', discount_percent: 36 });
            return NextResponse.json({ margin: 36 });
        }

        return NextResponse.json({ margin: data[0].discount_percent });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const user = await verifyAdmin();
        if (!user) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

        const { margin, applyToAll, isTargeted, targetField, targetValue } = await req.json();
        const marginValue = Number(margin);

        // 1. Update Global Margin Setting (Only if it's a general save, not a filtered mass update)
        if (!isTargeted) {
            const { data } = await supabase.from('price_groups').select('id').eq('name', 'GLOBAL_PROFIT_MARGIN').limit(1);
            if (data && data.length > 0) {
                await supabase.from('price_groups').update({ discount_percent: marginValue }).eq('name', 'GLOBAL_PROFIT_MARGIN');
            } else {
                await supabase.from('price_groups').insert({ name: 'GLOBAL_PROFIT_MARGIN', discount_percent: marginValue });
            }
        }

        // 2. ONLY if applyToAll is true, update products
        if (applyToAll) {
            let query = supabase.from('products').select('id, cost_price, code, name');
            
            if (isTargeted && targetField && targetValue !== undefined) {
                // Handle different types (boolean, number, string)
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
                    code: p.code,
                    name: p.name,
                    profit_margin: marginValue,
                    list_price: (Number(p.cost_price) || 0) * (1 + marginValue / 100)
                }));

                const { error: updateError } = await supabase
                    .from('products')
                    .upsert(updates);

                if (updateError) throw new Error(updateError.message);
                return NextResponse.json({ success: true, updatedCount: products.length });
            }
            return NextResponse.json({ success: true, updatedCount: 0 });
        }

        return NextResponse.json({ success: true, updatedCount: 0 });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
