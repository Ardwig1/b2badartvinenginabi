const fs = require('fs');

const supabaseUrl = "https://fjkasgelauwnsfoqecov.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI";

async function extractUltimateDNA() {
    console.log("🧬 ULTIMATE DNA (Keys & Zincirler) Çıkarılıyor...");
    
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
        const schema = await res.json();
        const definitions = schema.definitions;

        let sql = `-- ========================================================\n`;
        sql += `-- ULTIMATE DNA DUMP FROM KAAN ABI'S DATABASE\n`;
        sql += `-- Generated on: ${new Date().toLocaleString()}\n`;
        sql += `-- ========================================================\n\n`;
        sql += `CREATE EXTENSION IF NOT EXISTS pg_trgm;\n`;
        sql += `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n`;

        // 1. Önce Tabloları Sütunlarıyla (Constraintsiz) Oluştur
        for (const [tableName, definition] of Object.entries(definitions)) {
            sql += `-- TABLE: ${tableName}\n`;
            sql += `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n`;
            
            const columns = [];
            const props = definition.properties;
            const required = definition.required || [];

            for (const [colName, colDef] of Object.entries(props)) {
                let type = colDef.format || colDef.type;
                if (type === 'string' && colDef.enum) type = 'text';
                else if (type === 'integer') type = 'bigint';
                else if (type === 'number') type = 'numeric';
                else if (type === 'boolean') type = 'boolean';
                else if (colDef.format?.includes('timestamp')) type = 'timestamp with time zone';
                else if (type === 'string') type = 'text';

                let colSql = `    "${colName}" ${type}`;
                if (colDef.default !== undefined) {
                    let def = colDef.default;
                    if (def === 'CURRENT_DATE') def = 'CURRENT_DATE';
                    else if (typeof def === 'string' && !def.includes('(')) def = `'${def}'`;
                    colSql += ` DEFAULT ${def}`;
                }
                if (required.includes(colName)) colSql += " NOT NULL";
                columns.push(colSql);
            }
            sql += columns.join(",\n");
            sql += `\n);\n\n`;
        }

        // 2. Şimdi Tüm Primary Key'leri Zorla (id kolonu olanlara)
        sql += `-- ========================================================\n`;
        sql += `-- PRIMARY KEYS (ANAHTARLAR)\n`;
        sql += `-- ========================================================\n`;
        for (const tableName of Object.keys(definitions)) {
            if (definitions[tableName].properties.id) {
                sql += `ALTER TABLE IF EXISTS public."${tableName}" DROP CONSTRAINT IF EXISTS "${tableName}_pkey" CASCADE;\n`;
                sql += `ALTER TABLE public."${tableName}" ADD PRIMARY KEY ("id");\n`;
            }
        }

        // 3. Şimdi Tüm Zincirleri (Foreign Keys) Zorla
        sql += `\n-- ========================================================\n`;
        sql += `-- FOREIGN KEYS (ZİNCİRLER)\n`;
        sql += `-- ========================================================\n`;
        
        const relations = [
            ['companies', 'price_group_id', 'price_groups', 'id', 'SET NULL'],
            ['profiles', 'company_id', 'companies', 'id', 'CASCADE'],
            ['product_prices', 'product_id', 'products', 'id', 'CASCADE'],
            ['product_prices', 'price_group_id', 'price_groups', 'id', 'CASCADE'],
            ['stock_movements', 'product_id', 'products', 'id', 'CASCADE'],
            ['stock_movements', 'created_by', 'profiles', 'id', 'SET NULL'],
            ['orders', 'company_id', 'companies', 'id', 'CASCADE'],
            ['order_items', 'order_id', 'orders', 'id', 'CASCADE'],
            ['order_items', 'product_id', 'products', 'id', 'CASCADE'],
            ['invoices', 'company_id', 'companies', 'id', 'CASCADE'],
            ['invoices', 'order_id', 'orders', 'id', 'SET NULL'],
            ['invoice_items', 'invoice_id', 'invoices', 'id', 'CASCADE'],
            ['invoice_items', 'product_id', 'products', 'id', 'SET NULL'],
            ['suggestions', 'user_id', 'profiles', 'id', 'CASCADE'], // Profiles üzerinden auth.users'a gider
            ['user_activities', 'company_id', 'companies', 'id', 'CASCADE'],
            ['user_activities', 'user_id', 'profiles', 'id', 'SET NULL'],
            ['representative_assignments', 'representative_id', 'profiles', 'id', 'CASCADE'],
            ['representative_assignments', 'company_id', 'companies', 'id', 'CASCADE'],
            ['account_transactions', 'company_id', 'companies', 'id', 'CASCADE'],
            ['account_transactions', 'order_id', 'orders', 'id', 'SET NULL'],
            ['company_extra_discounts', 'company_id', 'companies', 'id', 'CASCADE'],
            ['company_extra_discounts', 'product_id', 'products', 'id', 'CASCADE'],
            ['product_follows', 'user_id', 'profiles', 'id', 'CASCADE'],
            ['product_follows', 'product_id', 'products', 'id', 'CASCADE'],
            ['cart_items', 'company_id', 'companies', 'id', 'CASCADE'],
            ['cart_items', 'product_id', 'products', 'id', 'CASCADE']
        ];

        for (const [table, col, refTable, refCol, onDelete] of relations) {
            if (definitions[table] && definitions[table].properties[col]) {
                const constraintName = `fk_${table}_${col}`;
                sql += `ALTER TABLE IF EXISTS public."${table}" DROP CONSTRAINT IF EXISTS "${constraintName}" CASCADE;\n`;
                sql += `ALTER TABLE public."${table}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${col}") REFERENCES public."${refTable}"("${refCol}") ON DELETE ${onDelete};\n`;
            }
        }

        // Special case: Profiles to Auth Users
        sql += `ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;\n`;
        sql += `ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;\n`;

        fs.writeFileSync('KAAN_ABI_ULTIMATE_DNA.sql', sql);
        console.log("✅ ULTIMATE DNA Hazır! 'KAAN_ABI_ULTIMATE_DNA.sql' dosyasını kullanabilirsin.");
        
    } catch (err) {
        console.error("❌ HATA:", err.message);
    }
}

extractUltimateDNA();
