const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function updateRPC() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const sql = `
CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
    v_risk_limit NUMERIC(15,2);
    v_is_rep BOOLEAN;
BEGIN
    -- Check if user is a representative for this company
    SELECT EXISTS (
        SELECT 1 FROM public.representative_assignments 
        WHERE representative_id = auth.uid() AND company_id = p_company_id
    ) OR (auth.jwt()->'user_metadata'->>'role' = 'representative') INTO v_is_rep;

    -- Verify user (Allow Admins and Representatives to bypass for showroom mode)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (company_id = p_company_id OR is_admin = true OR v_is_rep = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Fetch status and limits
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- VALIDATION
    IF v_is_locked IS TRUE THEN
        -- Prepayment Locked: Must have (+) balance covering the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için yeterli bakiye bulunmalıdır.';
        END IF;
    ELSE
        -- Standard Account: Check Risk Limit
        IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi aşmaktadır.';
        END IF;
    END IF;

    -- Create Order (Stock NOT reduced here)
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items (Stock NOT reduced here)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- Deduct Balance
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;
    `;

    const { error } = await supabase.rpc('run_sql', { sql });
    if (error) {
        console.error('Error updating RPC:', error);
    } else {
        console.log('RPC updated successfully');
    }
}

updateRPC();
