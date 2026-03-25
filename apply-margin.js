const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function apply() {
    const marginValue = 40; // The target margin

    console.log('Fetching products...');
    const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, cost_price, code, name');
    
    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    console.log(`Found ${products.length} products. Calculating updates...`);
    const updates = products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        profit_margin: marginValue,
        list_price: (Number(p.cost_price) || 0) * (1 + marginValue / 100)
    }));

    console.log('Sending upsert...');
    const { data, error: updateError } = await supabase
        .from('products')
        .upsert(updates);

    if (updateError) {
        console.error('Update error:', updateError);
    } else {
        console.log('Update successful!');
    }
}

apply();
