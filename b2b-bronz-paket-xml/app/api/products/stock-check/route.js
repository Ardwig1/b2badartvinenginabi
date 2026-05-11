import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { items } = body; // Array of { id, qty }

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid items format' }, { status: 400 });
        }

        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const productIds = items.map(i => i.id);
        const { data: products, error } = await adminSupabase
            .from('products')
            .select('id, name, stock_quantity')
            .in('id', productIds);

        if (error) throw error;

        const failures = [];
        items.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            if (!p || (p.stock_quantity < item.qty)) {
                failures.push({
                    id: item.id,
                    name: p?.name || 'Bilinmeyen Ürün',
                    requested: item.qty,
                    available: p?.stock_quantity || 0
                });
            }
        });

        return NextResponse.json({ 
            success: failures.length === 0, 
            failures 
        });

    } catch (err) {
        console.error("STOCK CHECK ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
