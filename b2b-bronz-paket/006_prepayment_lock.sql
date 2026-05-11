-- 1. Add 'is_prepayment_locked' column generic to companies 
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_prepayment_locked BOOLEAN DEFAULT false;

-- 2. Update the 'place_b2b_order' RPC to enforce the prepayment rule on the server side
CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to bypass RLS internally
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
BEGIN
    -- Verify the user actually belongs to this company!
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Prepayment Lock Validation
    SELECT is_prepayment_locked, COALESCE(current_balance, 0) INTO v_is_locked, v_current_balance FROM public.companies WHERE id = p_company_id;
    
    IF v_is_locked IS TRUE THEN
        -- If locked, they must have enough positive balance to cover the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için içeride (+) bakiye veya ödeme bulunmalıdır.';
        END IF;
    END IF;

    -- Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
        UPDATE public.products SET stock_quantity = GREATEST(0, stock_quantity - (v_item->>'quantity')::INT) WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    -- Deduct Balance (Borçlanma)
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction (Evrak No = Sipariş ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_b2b_order(UUID, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
