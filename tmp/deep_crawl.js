const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

const kaanSupabase = createClient(supabaseUrl, supabaseKey);

async function deepCrawl() {
    console.log("🕵️‍♂️ Kaan Abi'nin Veritabanı Hafızasına İniyorum...");
    
    try {
        // Step 1: Create a helper function in Kaan's DB to fetch all logic as a list
        // This is necessary because direct SELECT via exec_sql over RPC is limited.
        const setupSQL = `
            CREATE OR REPLACE FUNCTION public.get_db_intelligence()
            RETURNS TABLE(obj_type text, obj_name text, obj_def text)
            LANGUAGE plpgsql SECURITY DEFINER AS $$
            BEGIN
                -- Fetch Functions
                RETURN QUERY 
                SELECT 'FUNCTION'::text, proname::text, pg_get_functiondef(oid)::text 
                FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname NOT IN ('exec_sql', 'get_db_intelligence');
                
                -- Fetch Triggers
                RETURN QUERY
                SELECT 'TRIGGER'::text, tgname::text, pg_get_triggerdef(oid)::text 
                FROM pg_trigger WHERE tgisinternal = false;
            END; $$;
        `;
        
        await kaanSupabase.rpc('exec_sql', { sql_query: setupSQL });
        console.log("Master Key Activated...");

        // Step 2: Fetch the actual data
        const { data: intelligence, error } = await kaanSupabase.rpc('get_db_intelligence');
        
        if (error) {
            console.error("Crawl Error:", error.message);
            return;
        }

        console.log(`Found ${intelligence.length} logical components.`);

        let brainSQL = "\n-- ========================================================\n";
        brainSQL += "-- 🧠 LIVE EXTRACTED LOGIC FROM KAAN ABI\n";
        brainSQL += "-- ========================================================\n\n";

        intelligence.forEach(item => {
            brainSQL += `-- [${item.obj_type}] ${item.obj_name}\n`;
            brainSQL += item.obj_def + ";\n\n";
        });

        // Append to Master DNA
        const masterPath = '../b2b-bronz-paket-xml/ilk kurulumda yapılacaklar/MASTER_DNA.sql';
        if (fs.existsSync(masterPath)) {
            const currentContent = fs.readFileSync(masterPath, 'utf8');
            fs.writeFileSync(masterPath, brainSQL + "\n\n" + currentContent);
        } else {
            fs.writeFileSync(masterPath, brainSQL);
        }
        
        console.log("✅ LIVE DNA SUCCESSFULLY EXTRACTED AND SAVED!");

    } catch (e) {
        console.error("Extraction Failed:", e.message);
    }
}

deepCrawl();
