const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSecret() {
    const query = `
        CREATE OR REPLACE FUNCTION public.admin_add_invoice_transaction(
            p_company_id UUID,
            p_amount NUMERIC(15,2),
            p_description TEXT,
            p_invoice_no TEXT
        ) RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            v_new_balance NUMERIC(15,2);
            v_is_admin BOOLEAN;
        BEGIN
            -- Check if caller is an admin in profiles
            SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
            IF v_is_admin IS NOT TRUE THEN
                RAISE EXCEPTION 'Unauthorized: Only admins can add invoice transactions';
            END IF;

            -- Bakiyeyi dus (admin fatura = borc)
            UPDATE public.companies
            SET current_balance = COALESCE(current_balance, 0) - p_amount
            WHERE id = p_company_id
            RETURNING current_balance INTO v_new_balance;

            -- Cari hesap kaydi
            INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
            VALUES (p_company_id, 'FATURA', p_invoice_no, p_description, p_amount, 0, v_new_balance);

            RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
        END;
        $$;
    `;
    
    // We run it via postgres_query or rpc if raw SQL isn't exposed.
    // Or we can just drop it if it is unused for now, and have the user run the SQL.
}

fixSecret().catch(console.error);
