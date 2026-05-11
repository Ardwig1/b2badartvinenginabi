-- 1. Create the account_transactions table 
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    transaction_type TEXT NOT NULL, 
    document_no TEXT, 
    description TEXT,
    debt NUMERIC(15,2) DEFAULT 0, 
    credit NUMERIC(15,2) DEFAULT 0, 
    balance_after NUMERIC(15,2), 
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own transactions" ON public.account_transactions;

CREATE POLICY "Users view own transactions" ON public.account_transactions
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 2. Create RPC for Placing an Order (Secure for authenticated users)
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
BEGIN
    -- Verify the user actually belongs to this company!
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
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
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::TEXT, 'Platform Siparişi', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

-- Allow authenticated users to call place_b2b_order
GRANT EXECUTE ON FUNCTION public.place_b2b_order TO authenticated;

-- 3. Create a secured RPC for Tosla callbacks (Requires a secret key because Service Role is broken)
CREATE OR REPLACE FUNCTION public.process_tosla_payment(
    p_api_secret TEXT,
    p_company_id UUID,
    p_amount NUMERIC(15,2),
    p_transaction_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC(15,2);
BEGIN
    -- Verify custom secret key
    IF p_api_secret != 'b2b_secret_omi_12345!@#' THEN
        RAISE EXCEPTION 'Invalid Internal API Secret';
    END IF;

    -- Add to Balance (Tahsilat)
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) + p_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction (Evrak No = Banka Transaction ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'KREDİ KARTI', p_transaction_id, 'Tosla Online Ödeme', 0, p_amount, v_new_balance);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Allow anon to execute it (since Vercel backend calls it without user session), but the custom secret key defends it
GRANT EXECUTE ON FUNCTION public.process_tosla_payment TO anon, authenticated;
