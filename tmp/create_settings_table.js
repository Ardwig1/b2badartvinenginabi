const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fjkasgelauwnsfoqecov.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const sql = `
        -- 1. Create site_settings table
        CREATE TABLE IF NOT EXISTS site_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value JSONB DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 2. Insert initial maintenance mode settings
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES ('maintenance_mode', '{
            "/dashboard/payment": { "active": false, "message": "Ödeme sistemimizde kısa süreli bir bakım çalışması yapılmaktadır." },
            "/dashboard/cart": { "active": false, "message": "Sepet altyapımızda güncelleme yapılmaktadır." },
            "/dashboard/catalog": { "active": false, "message": "Katalog verilerimiz güncellenmektedir." }
        }'::jsonb)
        ON CONFLICT (setting_key) DO NOTHING;

        -- 3. Enable RLS
        ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

        -- 4. Create Policies
        DROP POLICY IF EXISTS "Anyone can view settings" ON site_settings;
        CREATE POLICY "Anyone can view settings" ON site_settings
            FOR SELECT USING (true);

        DROP POLICY IF EXISTS "Only admins can update settings" ON site_settings;
        CREATE POLICY "Only admins can update settings" ON site_settings
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND is_admin = true
                )
            );
            
        DROP POLICY IF EXISTS "Only admins can insert settings" ON site_settings;
        CREATE POLICY "Only admins can insert settings" ON site_settings
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND is_admin = true
                )
            );
    `;

    console.log("Running migration...");
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });

    if (error) {
        console.error("Migration failed (execute_sql):", error);
        // Try fallback
        const { error: error2 } = await supabase.rpc('run_sql', { sql: sql });
        if (error2) console.error("Fallback migration failed:", error2);
        else console.log("Migration successful via fallback!");
    } else {
        console.log("Migration successful!");
    }
}

runMigration();
