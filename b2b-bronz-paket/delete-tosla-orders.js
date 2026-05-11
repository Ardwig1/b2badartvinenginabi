import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteToslaOrders() {
    console.log("Finding TOSLA company...");
    const { data: companies, error: companyErr } = await supabase
        .from('companies')
        .select('id, name, dealer_code')
        .ilike('dealer_code', 'TOSLA%');

    if (companyErr) {
        console.error("Error finding company:", companyErr);
        return;
    }

    if (!companies || companies.length === 0) {
        console.log("No company found with dealer code TOSLA");
        return;
    }

    const companyId = companies[0].id;
    console.log(`Found company: ${companies[0].name} (ID: ${companyId})`);

    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('company_id', companyId);

    if (ordersErr) {
        console.error("Error fetching orders:", ordersErr);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log("No orders found for this company.");
        return;
    }

    console.log(`Found ${orders.length} test orders. Deleting them now...`);

    const orderIds = orders.map(o => o.id);

    // Delete order_items first to avoid foreign key constraints (if no cascade)
    const { error: itemsErr } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

    if (itemsErr) {
        console.error("Error deleting order items:", itemsErr);
    } else {
        console.log("Deleted order items.");
    }

    // Delete orders
    const { error: deleteErr } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

    if (deleteErr) {
        console.error("Error deleting orders:", deleteErr);
    } else {
        console.log("Deleted orders successfully!");
    }
}

deleteToslaOrders();
