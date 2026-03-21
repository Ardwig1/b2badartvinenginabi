-- ================================================================
-- FIX: Remove hardcoded api secret from admin invoice function
-- ================================================================

DROP FUNCTION IF EXISTS public.admin_add_invoice_transaction(TEXT, UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_add_invoice_transaction(UUID, NUMERIC, TEXT, TEXT);

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
    -- Authorization: Validate if calling user is an actual admin
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can perform this action';
    END IF;

    -- Bakiyeyi düş (admin fatura = borç)
    UPDATE public.companies
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_company_id
    RETURNING current_balance INTO v_new_balance;

    -- Cari hesap kaydı
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
    VALUES (p_company_id, 'FATURA', p_invoice_no, p_description, p_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_invoice_transaction(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
