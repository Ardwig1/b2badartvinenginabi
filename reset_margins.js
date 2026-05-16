const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function resetMargins() {
    console.log("🛠️  Resetting all margins to 0...");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Reset GLOBAL_PROFIT_MARGIN setting
    console.log("- Updating price_groups (GLOBAL_PROFIT_MARGIN)...");
    const { error: pgError } = await supabase
        .from('price_groups')
        .update({ discount_percent: 0 })
        .eq('name', 'GLOBAL_PROFIT_MARGIN');
    
    if (pgError) console.error("❌ price_groups error:", pgError.message);

    // 2. Reset individual product profit margins
    // Note: We'll do this for all products in the database.
    console.log("- Resetting profit_margin for ALL products...");
    const { error: prodError } = await supabase
        .from('products')
        .update({ profit_margin: 0 });

    if (prodError) {
        console.error("❌ products margin reset error:", prodError.message);
    } else {
        console.log("✅ All margins reset to 0.");
    }
}

resetMargins();
