const fs = require('fs');

// Kaan Abi'nin anahtarları
const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

async function extractSchema() {
    console.log("🔍 Kaan Abi'nin canlı veritabanına bağlanılıyor...");
    
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        if (!res.ok) throw new Error("Bağlantı hatası: " + res.statusText);
        
        const schema = await res.json();
        const definitions = schema.definitions;
        
        if (!definitions) {
            console.error("❌ Tanımlar bulunamadı! Lütfen API anahtarını kontrol et.");
            return;
        }

        let sql = `-- ========================================================\n`;
        sql += `-- LIVE DUMP FROM KAAN ABI'S DATABASE (1:1 EXACT)\n`;
        sql += `-- Generated on: ${new Date().toLocaleString()}\n`;
        sql += `-- ========================================================\n\n`;

        for (const [tableName, definition] of Object.entries(definitions)) {
            sql += `-- TABLE: ${tableName}\n`;
            sql += `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n`;
            
            const columns = [];
            const props = definition.properties;
            const required = definition.required || [];

            for (const [colName, colDef] of Object.entries(props)) {
                let type = colDef.format || colDef.type;
                
                // Postgres Tiplerine Dönüştür
                if (type === 'string' && colDef.enum) type = 'text';
                else if (type === 'integer') type = 'bigint';
                else if (type === 'number') type = 'numeric';
                else if (type === 'boolean') type = 'boolean';
                else if (colDef.format?.includes('timestamp')) type = 'timestamp with time zone';
                else if (type === 'string') type = 'text';

                let colSql = `    "${colName}" ${type}`;
                
                if (colDef.default !== undefined) {
                    let def = colDef.default;
                    if (typeof def === 'string' && !def.includes('(')) def = `'${def}'`;
                    colSql += ` DEFAULT ${def}`;
                }
                
                if (required.includes(colName)) colSql += " NOT NULL";
                
                columns.push(colSql);
            }
            
            sql += columns.join(",\n");
            sql += `\n);\n\n`;
        }

        fs.writeFileSync('KAAN_ABI_LIVE_DUMP.sql', sql);
        console.log("✅ BAŞARILI! Kaan Abi'nin tüm şeması 'KAAN_ABI_LIVE_DUMP.sql' dosyasına çıkarıldı.");
        console.log(`📊 Toplam ${Object.keys(definitions).length} tablo bulundu.`);
        
    } catch (err) {
        console.error("❌ HATA:", err.message);
    }
}

extractSchema();
