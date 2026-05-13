const { createClient } = require('@supabase/supabase-js');
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb2Vjb3YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcyMjkyNzA3LCJleHAiOjIwODc4Njg3MDd9.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';
const url = 'https://xpziispstwarngpsmstd.supabase.co';
const supabase = createClient(url, key);

async function test() {
    const { data, error } = await supabase.from('companies').select('id').limit(1);
    console.log('Data:', data);
    console.log('Error:', error);
}
test();
