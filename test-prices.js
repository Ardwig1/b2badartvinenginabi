import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fjkasgelauwnsfoqecov.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb2Vjb3YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcyMjkyNzA3LCJleHAiOjIwODc4Njg3MDd9.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI'
);

async function check() {
    const { data, error } = await supabase.from('products').select('id, name, list_price, currency').limit(10);
    if (error) console.error(error);
    console.log(data);
}
check();
