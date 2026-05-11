import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/"/g, '').trim();
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUrls() {
    const { data: products, error } = await supabase.from('products').select('id, code, name, image_url').neq('image_url', '').not('image_url', 'is', null);

    if (error) {
        console.error('Supabase error:', error);
        return;
    }

    console.log(`Checking ${products.length} URLs...`);
    let broken = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        try {
            // Using fetch to get the headers.
            const res = await fetch(p.image_url, { method: 'HEAD' });
            if (!res.ok) {
                console.log(`❌ Broken: [${p.code}] ${p.name}`);
                console.log(`   URL: ${p.image_url}`);
                console.log(`   Status: ${res.status}`);
                broken++;
            }
        } catch (e) {
            console.log(`⚠️ Error fetching: [${p.code}] ${p.name}`);
            console.log(`   URL: ${p.image_url}`);
            console.log(`   Error: ${e.message}`);
            broken++;
        }
    }

    console.log(`\nDone. ${broken} broken URLs found out of ${products.length}.`);
}

checkUrls();
