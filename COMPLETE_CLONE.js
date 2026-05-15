const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery(sql) {
    const { data, error } = await supabase.rpc('query_sql', { sql_query: sql });
    if (error) {
        console.error(`Query failed: ${sql.substring(0, 100)}...`);
        throw error;
    }
    return data || [];
}

function escapeSql(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    return `'${val.toString().replace(/'/g, "''")}'`;
}

async function extract() {
    console.log("🚀 Starting COMPLETE Database Cloning (V4 - Clean Slate)...");
    let fullSql = `-- ========================================================\n`;
    fullSql += `-- 👑 COMPLETE DATABASE CLONE (CLEAN SLATE MODE)\n`;
    fullSql += `-- Source: ${supabaseUrl}\n`;
    fullSql += `-- Generated on: ${new Date().toLocaleString()}\n`;
    fullSql += `-- ========================================================\n\n`;

    fullSql += `BEGIN;\n\n`;
    fullSql += `-- 🛑 Bypass integrity checks\n`;
    fullSql += `SET session_replication_role = 'replica';\n\n`;

    // 1. EXTENSIONS
    console.log("📦 Extracting Extensions...");
    const extensions = await runQuery(`SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql')`);
    fullSql += `-- 1. EXTENSIONS\n`;
    extensions.forEach(e => {
        fullSql += `CREATE EXTENSION IF NOT EXISTS "${e.extname}";\n`;
    });
    fullSql += `\n`;

    // 2. TYPES
    console.log("🎨 Extracting Types...");
    const types = await runQuery(`
        SELECT n.nspname as schema, t.typname as name, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) as labels
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY n.nspname, t.typname
    `);
    fullSql += `-- 2. TYPES\n`;
    types.forEach(t => {
        const labels = t.labels.split(',').map(l => `'${l}'`).join(', ');
        fullSql += `DROP TYPE IF EXISTS public."${t.name}" CASCADE;\n`;
        fullSql += `CREATE TYPE public."${t.name}" AS ENUM (${labels});\n`;
    });
    fullSql += `\n`;

    // 3. TABLES (SCHEMA - PUBLIC ONLY)
    console.log("📋 Extracting Table Structures (Public Only)...");
    const tables = await runQuery(`
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('schema_migrations')
    `);

    for (const table of tables) {
        const tableName = table.table_name;
        const schema = table.table_schema;
        console.log(`   - Structure: ${schema}.${tableName}`);
        fullSql += `-- TABLE STRUCTURE: ${schema}.${tableName}\n`;
        fullSql += `DROP TABLE IF EXISTS ${schema}."${tableName}" CASCADE;\n`;
        
        const cols = await runQuery(`
            SELECT column_name, data_type, column_default, is_nullable, udt_name, is_generated, generation_expression
            FROM information_schema.columns
            WHERE table_schema = '${schema}' AND table_name = '${tableName}'
            ORDER BY ordinal_position
        `);

        fullSql += `CREATE TABLE ${schema}."${tableName}" (\n`;
        const colDefs = cols.map(c => {
            let type = c.data_type;
            if (type === 'USER-DEFINED') type = c.udt_name;
            if (type === 'ARRAY') {
                type = c.udt_name.startsWith('_') ? c.udt_name.substring(1) + '[]' : c.udt_name + '[]';
            }
            
            let def = `    "${c.column_name}" ${type}`;
            if (c.is_generated === 'ALWAYS') {
                def += ` GENERATED ALWAYS AS (${c.generation_expression}) STORED`;
            } else {
                if (c.column_default) def += ` DEFAULT ${c.column_default}`;
                if (c.is_nullable === 'NO') def += ` NOT NULL`;
            }
            return def;
        });
        fullSql += colDefs.join(",\n");
        fullSql += `\n);\n\n`;
    }

    // 4. DATA (PUBLIC AND AUTH)
    console.log("💾 Extracting Table Data (Excluding Generated Columns)...");
    
    const authOrder = ['instances', 'users', 'identities', 'sessions', 'mfa_factors', 'mfa_challenges', 'mfa_amr_claims'];
    
    const allTablesForData = await runQuery(`
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE (table_schema = 'public' OR table_schema = 'auth') AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('schema_migrations', 'audit_log_entries', 'refresh_tokens', 'saml_providers', 'saml_relay_states', 'sso_domains', 'sso_providers', 'flow_state')
    `);

    const sortedTables = allTablesForData.sort((a, b) => {
        if (a.table_schema === 'auth' && b.table_schema !== 'auth') return -1;
        if (a.table_schema !== 'auth' && b.table_schema === 'auth') return 1;
        if (a.table_schema === 'auth' && b.table_schema === 'auth') {
            const idxA = authOrder.indexOf(a.table_name);
            const idxB = authOrder.indexOf(b.table_name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
        }
        return a.table_name.localeCompare(b.table_name);
    });

    for (const table of sortedTables) {
        const tableName = table.table_name;
        const schema = table.table_schema;
        
        const insertableCols = await runQuery(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = '${schema}' AND table_name = '${tableName}'
              AND is_generated = 'NEVER'
            ORDER BY ordinal_position
        `);
        
        if (insertableCols.length === 0) continue;
        const colNames = insertableCols.map(c => c.column_name);

        console.log(`   - Data: ${schema}.${tableName}`);
        const rows = await runQuery(`SELECT "${colNames.join('", "')}" FROM ${schema}."${tableName}"`);
        
        if (rows.length > 0) {
            fullSql += `-- DATA: ${schema}.${tableName} (${rows.length} rows)\n`;
            const chunkSize = 100;
            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                fullSql += `INSERT INTO ${schema}."${tableName}" ("${colNames.join('", "')}") VALUES\n`;
                const values = chunk.map(row => {
                    return `(${colNames.map(k => escapeSql(row[k])).join(', ')})`;
                });
                fullSql += values.join(",\n") + `\nON CONFLICT DO NOTHING;\n\n`;
            }
        }
    }

    // 5. CONSTRAINTS (PUBLIC ONLY)
    console.log("🔗 Extracting Constraints (Public Only)...");
    const constraints = await runQuery(`
        SELECT conname, pg_get_constraintdef(c.oid) as def, n.nspname as schema, relname as table
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
    `);
    fullSql += `-- 5. CONSTRAINTS\n`;
    constraints.forEach(c => {
        fullSql += `ALTER TABLE ${c.schema}."${c.table}" ADD CONSTRAINT "${c.conname}" ${c.def};\n`;
    });
    fullSql += `\n`;

    // 6. INDEXES (PUBLIC ONLY)
    console.log("⚡ Extracting Indexes (Public Only)...");
    const indexes = await runQuery(`
        SELECT indexname, indexdef, schemaname
        FROM pg_indexes
        WHERE schemaname = 'public'
    `);
    fullSql += `-- 6. INDEXES\n`;
    indexes.forEach(i => {
        if (!i.indexdef.includes('_pkey')) {
             let def = i.indexdef;
             def = def.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS');
             def = def.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS');
             fullSql += `${def};\n`;
        }
    });
    fullSql += `\n`;

    // 7. FUNCTIONS
    console.log("⚙️ Extracting Functions...");
    const functions = await runQuery(`
        SELECT n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as def
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.proname NOT IN ('exec_sql', 'query_sql', 'admin_add_invoice_transaction')
    `);
    fullSql += `-- 7. FUNCTIONS\n`;
    functions.forEach(f => {
        fullSql += `DROP FUNCTION IF EXISTS ${f.schema}."${f.name}" CASCADE;\n`;
        fullSql += `${f.def};\n\n`;
    });

    // 8. RLS POLICIES (PUBLIC ONLY)
    console.log("🛡️ Extracting RLS Policies (Public Only)...");
    const rlsTables = await runQuery(`
        SELECT relname, n.nspname as schema
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND relrowsecurity = true
    `);
    fullSql += `-- 8. RLS POLICIES\n`;
    rlsTables.forEach(t => {
        fullSql += `ALTER TABLE ${t.schema}."${t.relname}" ENABLE ROW LEVEL SECURITY;\n`;
    });

    const policies = await runQuery(`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
    `);
    policies.forEach(p => {
        let sql = `CREATE POLICY "${p.policyname}" ON ${p.schemaname}."${p.tablename}"`;
        sql += ` FOR ${p.cmd}`;
        sql += ` TO ${p.roles.join(', ')}`;
        if (p.qual) sql += ` USING (${p.qual})`;
        if (p.with_check) sql += ` WITH CHECK (${p.with_check})`;
        fullSql += `${sql};\n`;
    });
    fullSql += `\n`;

    // 9. TRIGGERS
    console.log("🔔 Extracting Triggers...");
    const triggers = await runQuery(`
        SELECT trg.tgname, rel.relname, pg_get_triggerdef(trg.oid) as def, nsp.nspname as schema
        FROM pg_trigger trg
        JOIN pg_class rel ON trg.tgrelid = rel.oid
        JOIN pg_namespace nsp ON rel.relnamespace = nsp.oid
        WHERE nsp.nspname = 'public' AND NOT trg.tgisinternal
    `);
    fullSql += `-- 9. TRIGGERS\n`;
    triggers.forEach(t => {
        fullSql += `${t.def};\n`;
    });

    fullSql += `\n-- 🟢 Re-enable integrity checks\n`;
    fullSql += `SET session_replication_role = 'origin';\n`;
    fullSql += `\nCOMMIT;\n`;

    fs.writeFileSync('COMPLETE_CLONE.sql', fullSql);
    console.log("✅ SUCCESS! Complete clone saved to 'COMPLETE_CLONE.sql'");
}

extract().catch(err => {
    console.error("❌ CLONING FAILED:", err);
});
