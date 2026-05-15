const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

const supabase = createClient(supabaseUrl, supabaseKey);

async function extractFunctions() {
    console.log("🧠 Kaan Abi'nin Veritabanı Zekası (Fonksiyonlar) Çekiliyor...");
    
    try {
        // Query to get source code of all custom functions in public schema
        const sql = `
            SELECT 
                p.proname as function_name,
                pg_get_functiondef(p.oid) as function_definition
            FROM 
                pg_proc p 
                JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE 
                n.nspname = 'public';
        `;

        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error("Fetch Error:", error.message);
            return;
        }

        let functionSQL = "\n-- ========================================================\n";
        functionSQL += "-- 🧠 DATABASE FUNCTIONS (THE BRAIN)\n";
        functionSQL += "-- ========================================================\n\n";

        data.forEach(f => {
            functionSQL += `-- [Function] ${f.function_name}\n`;
            functionSQL += f.function_definition + ";\n\n";
        });

        console.log(`✅ ${data.length} adet fonksiyon başarıyla çekildi.`);
        
        // Append to existing Master DNA
        const masterPath = 'b2b-bronz-paket-xml/ilk kurulumda yapılacaklar/MASTER_DNA.sql';
        let currentMaster = fs.readFileSync(masterPath, 'utf8');
        
        // Replace the old placeholders with real functions
        const updatedMaster = currentMaster + "\n" + functionSQL;
        
        fs.writeFileSync(masterPath, updatedMaster);
        console.log("🚀 MASTER DNA DOSYASI FONKSİYONLARLA GÜNCELLENDİ!");

    } catch (e) {
        console.error("Extraction Error:", e.message);
    }
}

extractFunctions();
