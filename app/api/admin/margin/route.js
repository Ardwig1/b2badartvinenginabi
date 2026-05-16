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

        // 1. Update Global Margin Setting & Rules
        const { data: existing } = await supabase.from('price_groups').select('*').eq('name', 'GLOBAL_PROFIT_MARGIN').single();
        
        let newRules = existing?.rules || {};
        if (isTargeted && targetField === 'supplier_brand' && targetValue) {
            // "Alındığı Firma" (supplier_brand) bazlı kural ekle/güncelle
            newRules[targetValue] = marginValue;
        }

        if (existing) {
            await supabase.from('price_groups').update({ 
                discount_percent: isTargeted ? existing.discount_percent : marginValue, 
                rules: newRules 
            }).eq('name', 'GLOBAL_PROFIT_MARGIN');
        } else {
            await supabase.from('price_groups').insert({ 
                name: 'GLOBAL_PROFIT_MARGIN', 
                discount_percent: marginValue,
                rules: newRules
            });
        }

        // 2. ONLY if applyToAll is true, update products in DB
        if (applyToAll) {
            let allProducts = [];
            let lastId = null;
            let hasMore = true;

            console.log("Fetching all products for bulk update...");
            
            // Loop to bypass 1000 limit
            while (hasMore) {
                let query = supabase
                    .from('products')
                    .select('id, cost_price, code, name')
                    .order('id', { ascending: true })
                    .limit(1000);
                
                if (lastId) {
                    query = query.gt('id', lastId);
                }

                if (isTargeted && targetField && targetValue !== undefined) {
                    if (['is_fixed_price', 'is_campaign'].includes(targetField)) {
                        query = query.eq(targetField, targetValue === 'true' || targetValue === '1');
                    } else if (['cost_price', 'profit_margin', 'discount_rate', 'cart_discount_rate', 'box_quantity', 'stock_merkez', 'stock_depo'].includes(targetField)) {
                        query = query.eq(targetField, Number(targetValue));
                    } else {
                        query = query.ilike(targetField, `%${targetValue}%`);
                    }
                }

                const { data, error } = await query;
                if (error) throw new Error(error.message);

                if (data && data.length > 0) {
                    allProducts = [...allProducts, ...data];
                    lastId = data[data.length - 1].id;
                    if (data.length < 1000) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            if (allProducts.length > 0) {
                const updates = allProducts.map(p => ({
                    id: p.id,
                    code: p.code,
                    name: p.name,
                    profit_margin: marginValue,
                    list_price: (Number(p.cost_price) || 0) * (1 + marginValue / 100)
                }));

                console.log(`Updating ${updates.length} products total...`);
                for (let i = 0; i < updates.length; i += 1000) {
                    const chunk = updates.slice(i, i + 1000);
                    const { error: upErr } = await supabase.from('products').upsert(chunk);
                    if (upErr) console.error("Update error:", upErr.message);
                }
                
                return NextResponse.json({ success: true, updatedCount: allProducts.length });
            }
        }

        return NextResponse.json({ success: true, updatedCount: 0 });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
