import fetch from 'node-fetch';

async function check() {
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb2Vjb3YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzcyMjkyNzA3LCJleHAiOjIwODc4Njg3MDd9.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

    // Test the API key validity first
    const res = await fetch('https://fjkasgelauwnsfoqecov.supabase.co/rest/v1/products?select=id,name,list_price,currency,stock_quantity&limit=20', {
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': 'Bearer ' + serviceRoleKey
        }
    });

    // Print the raw HTTP response status and text if not ok
    if (!res.ok) {
        console.error('Error status:', res.status);
        console.error('Error text:', await res.text());
        return;
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
check();
