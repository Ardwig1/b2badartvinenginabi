import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const companyId = "21d36240-e51f-4504-bc78-e44933cc1691"; // DENEME HESABI OTOMOTİV
    const { data, error } = await supabase.rpc('place_b2b_order', {
        p_company_id: companyId,
        p_shipping_address: "Debug Test",
        p_note: "Debug Test",
        p_total_amount: 100.00,
        p_items: [{ product_id: "fb4cd70f-3d9c-4018-a0e9-12d3fb4833ab", quantity: 1, unit_price: 100.00, total_price: 100.00 }]
    });

    return NextResponse.json({ data, error });
}
