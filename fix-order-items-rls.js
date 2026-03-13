import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addPolicy() {
    console.log("Adding RLS policy for order_items...");
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: `
            -- Drop existing policy if any (optional, safety first)
            DROP POLICY IF EXISTS "Users can insert their own order items" ON order_items;
            
            -- Re-create the insert policy based on the parent order's company_id
            -- Since order_items doesn't have company_id or user_id natively, we need to check the parent order
            -- However, wait... the insert happens using anon key/authenticated role.
            -- So the easiest fix is to allow authenticated users to insert to order_items if the linked order belongs to them.
            
            CREATE POLICY "Users can insert order items" ON order_items
            FOR INSERT 
            WITH CHECK (
                auth.uid() IN (
                    SELECT p.id 
                    FROM profiles p 
                    JOIN orders o ON o.company_id = p.company_id 
                    WHERE o.id = order_items.order_id
                )
            );
        `
    });

    if (error) {
        console.error("Failed to execute SQL via RPC:", error.message);
        console.log("Attempting direct table policy creation might be required via Supabase Dashboard if the raw SQL rpc doesn't exist.");
    } else {
        console.log("Successfully ran SQL.");
    }
}

addPolicy();
