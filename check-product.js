const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
    const { data, error } = await supabase
        .from('products')
        .select('code, profit_margin, list_price, cost_price')
        .eq('code', 'OMİ-FR-RNTL000439R')
        .single();
    
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));

    const { data: marginSetting } = await supabase
        .from('price_groups')
        .select('discount_percent')
        .eq('name', 'GLOBAL_PROFIT_MARGIN')
        .single();
    
    console.log('Global Margin Setting:', marginSetting);
}

check();
