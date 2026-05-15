const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

const kaanSupabase = createClient(supabaseUrl, supabaseKey);

async function fullTruthExtraction() {
    console.log("🔍 Kaan Abi'nin Veritabanı Ruhunu Söküyorum...");
    
    try {
        // Step 1: Query for ALL non-system functions, triggers, and views
        const query = `
            WITH logic AS (
                -- Functions
                SELECT 'FUNCTION'::text as type, proname::text as name, pg_get_functiondef(oid)::text as def 
                FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname NOT IN ('exec_sql', 'get_db_intelligence')
                UNION ALL
                -- Triggers
                SELECT 'TRIGGER'::text as type, tgname::text as name, pg_get_triggerdef(oid)::text as def 
                FROM pg_trigger WHERE tgisinternal = false
                UNION ALL
                -- Views
                SELECT 'VIEW'::text as type, viewname::text as name, definition::text as def 
                FROM pg_views WHERE schemaname = 'public'
            )
            SELECT json_agg(logic) FROM logic;
        `;

        const { data, error } = await kaanSupabase.rpc('exec_sql_data', { sql_query: query });
        
        // If exec_sql_data doesn't exist (returning result set), let's create a temp one
        if (error && error.message.includes('not found')) {
            const helperSQL = `
                CREATE OR REPLACE FUNCTION public.exec_sql_data(sql_query text)
                RETURNS json
                LANGUAGE plpgsql SECURITY DEFINER AS $$
                DECLARE
                    result json;
                BEGIN
                    EXECUTE 'SELECT json_agg(t) FROM (' || sql_query || ') t' INTO result;
                    RETURN result;
                END; $$;
            `;
            await kaanSupabase.rpc('exec_sql', { sql_query: helperSQL });
            // Re-try after creation
            const { data: data2, error: error2 } = await kaanSupabase.rpc('exec_sql_data', { sql_query: query });
            if (error2) throw error2;
            processResults(data2);
        } else if (data) {
            processResults(data);
        }

    } catch (e) {
        console.error("Extraction Failed:", e.message);
    }
}

function processResults(logic) {
    let finalSQL = "\n-- ========================================================\n";
    finalSQL += "-- 👑 THE ABSOLUTE MASTER DNA - 100% COMPLETE LOGIC\n";
    finalSQL += "-- ========================================================\n\n";

    logic.forEach(item => {
        finalSQL += `-- [${item.type}] ${item.name}\n`;
        finalSQL += item.def + (item.type === 'VIEW' ? '' : ';') + "\n\n";
    });

    fs.writeFileSync('../b2b-bronz-paket-xml/ilk kurulumda yapılacaklar/MASTER_DNA_FINAL.sql', finalSQL);
    console.log(`✅ BAŞARILI! ${logic.length} adet mantıksal birim çekildi.`);
}

fullTruthExtraction();
