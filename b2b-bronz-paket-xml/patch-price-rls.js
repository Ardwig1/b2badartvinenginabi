import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function patch() {
    console.log("Applying RLS policy via RPC...");
    const { error } = await supabase.rpc('exec_sql', {
        sql_string: `
            DO $$
            BEGIN
                DROP POLICY IF EXISTS "Admins can manage price groups" ON price_groups;
                DROP POLICY IF EXISTS "Users can read price groups" ON price_groups;
            EXCEPTION
                WHEN undefined_object THEN null;
            END $$;
        
            CREATE POLICY "Admins can manage price groups" ON price_groups 
                FOR ALL USING (public.is_admin_user());
                
            CREATE POLICY "Users can read price groups" ON price_groups
                FOR SELECT USING (auth.role() = 'authenticated');
        `
    });

    // Fallback: If exec_sql doesn't exist, we must use the REST API or tell the user to do it.
    // Wait, the user has a test-rls.js that executes SQL using postgres driver directly? No, wait. 
    // In a previous turn, we used pg or psql? No, we used `vercel env` or `pnpm i pg`. 
    // Let me check if 'exec_sql' exists.
    if (error) {
        console.error("RPC exec_sql failed:", error.message);
    } else {
        console.log("Successfully applied RLS patch.");
    }
}
patch();
