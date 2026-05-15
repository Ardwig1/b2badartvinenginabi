const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

const kaanSupabase = createClient(supabaseUrl, supabaseKey);

async function fullFunctionDump() {
    console.log("🚀 Kaan Abi'nin Tüm Veritabanı Zekası Dosyaya Dökülüyor...");
    
    try {
        // Create a wrapper function that returns a list to overcome PostgREST limitations
        const setupSQL = `
            CREATE OR REPLACE FUNCTION public.get_all_logic()
            RETURNS TABLE(type text, name text, definition text)
            LANGUAGE plpgsql SECURITY DEFINER AS $$
            BEGIN
                RETURN QUERY 
                SELECT 'FUNCTION'::text, proname::text, pg_get_functiondef(oid)::text 
                FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname NOT IN ('exec_sql', 'get_all_logic');
                
                RETURN QUERY
                SELECT 'TRIGGER'::text, tgname::text, pg_get_triggerdef(oid)::text 
                FROM pg_trigger WHERE tgisinternal = false;
            END; $$;
        `;
        
        await kaanSupabase.rpc('exec_sql', { sql_query: setupSQL });
        
        const { data: logic, error } = await kaanSupabase.rpc('get_all_logic');
        
        if (error) {
            console.error("Dump Error:", error.message);
            return;
        }

        let dumpSQL = "\n-- ========================================================\n";
        dumpSQL += "-- 🧠 ALL DATABASE LOGIC (FUNCTIONS & TRIGGERS)\n";
        dumpSQL += "-- ========================================================\n\n";

        logic.forEach(item => {
            dumpSQL += `-- [${item.type}] ${item.name}\n`;
            dumpSQL += item.definition + ";\n\n";
        });

        const masterPath = '../b2b-bronz-paket-xml/ilk kurulumda yapılacaklar/MASTER_DNA.sql';
        let currentMaster = fs.readFileSync(masterPath, 'utf8');
        
        // Remove old logic if exists and append new
        fs.writeFileSync(masterPath, currentMaster + "\n" + dumpSQL);
        console.log(`✅ ${logic.length} adet mantıksal birim (Fonksiyon/Tetikleyici) başarıyla MASTER DNA'ya eklendi!`);

    } catch (e) {
        console.error("Dump Error:", e.message);
    }
}

fullFunctionDump();
