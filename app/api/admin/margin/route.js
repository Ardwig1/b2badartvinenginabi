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
        // Fetch the global margin setting, handle multiple results by taking the first one
        const { data, error } = await supabase
            .from('price_groups')
            .select('discount_percent')
            .eq('name', 'GLOBAL_PROFIT_MARGIN')
            .limit(1);

        if (error || !data || data.length === 0) {
            // If missing, create it with a default value of 36
            // We use upsert to prevent issues if it was concurrently created
            await supabase.from('price_groups').upsert({ name: 'GLOBAL_PROFIT_MARGIN', discount_percent: 36 }, { onConflict: 'name' });
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

        const { margin } = await req.json();
        const marginValue = Number(margin);

        // 1. Update Global Margin Setting
        const { error: marginError } = await supabase
            .from('price_groups')
            .update({ discount_percent: marginValue })
            .eq('name', 'GLOBAL_PROFIT_MARGIN');

        if (marginError) throw new Error(marginError.message);

        // 2. Fetch all products to recalculate list_price based on cost_price
        const { data: products, error: fetchError } = await supabase
            .from('products')
            .select('id, cost_price, code, name');

        if (fetchError) throw new Error(fetchError.message);

        if (products && products.length > 0) {
            const updates = products.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                profit_margin: marginValue,
                list_price: (Number(p.cost_price) || 0) * (1 + marginValue / 100)
            }));

            // 3. Bulk update products
            const { error: updateError } = await supabase
                .from('products')
                .upsert(updates);

            if (updateError) throw new Error(updateError.message);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
