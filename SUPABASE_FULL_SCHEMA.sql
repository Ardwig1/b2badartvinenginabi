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
-- ================================================================
-- FIX 1: place_b2b_order — Stok kontrolü + stock_movements kaydı
-- ================================================================

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
    v_product_id UUID;
    v_quantity INT;
    v_current_stock INT;
    v_product_name TEXT;
BEGIN
    -- Kullanıcının bu firmaya ait olduğunu doğrula
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Sipariş oluşturmadan ÖNCE tüm ürünlerin stoğunu kontrol et
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity   := (v_item->>'quantity')::INT;

        SELECT stock_quantity, name
        INTO v_current_stock, v_product_name
        FROM public.products
        WHERE id = v_product_id;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stok yetersiz: "%" ürünü için talep edilen miktar (%) mevcut stoktan (%) fazla.',
                v_product_name, v_quantity, v_current_stock;
        END IF;
    END LOOP;

    -- Sipariş oluştur
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Ürünleri ekle, stoğu düş ve stock_movements'a yaz
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity   := (v_item->>'quantity')::INT;

        -- order_items'a ekle
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            (v_item->>'unit_price')::NUMERIC(15,2),
            (v_item->>'total_price')::NUMERIC(15,2)
        );

        -- Stoğu güncelle
        UPDATE public.products
        SET stock_quantity = stock_quantity - v_quantity
        WHERE id = v_product_id;

        -- Stok hareketi kaydet
        INSERT INTO public.stock_movements (product_id, type, quantity, note, created_by, created_at)
        VALUES (
            v_product_id,
            'out',
            v_quantity,
            'Sipariş: ' || v_order_id::TEXT,
            (SELECT id FROM public.profiles WHERE company_id = p_company_id LIMIT 1),
            NOW()
        );
    END LOOP;

    -- Bakiyeyi düş (borçlanma)
    UPDATE public.companies
    SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id
    RETURNING current_balance INTO v_new_balance;

    -- Cari hesap kaydı (Evrak No = Sipariş ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::TEXT, 'Platform Siparişi', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_b2b_order TO authenticated;


-- ================================================================
-- FIX 2: Admin fatura eklenince cari hesaba işle (account_transactions)
-- Bu fonksiyon admin UI'dan çağrılacak
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_add_invoice_transaction(
    p_api_secret TEXT,
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
BEGIN
    IF p_api_secret != 'b2b_secret_omi_12345!@#' THEN
        RAISE EXCEPTION 'Unauthorized';
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

GRANT EXECUTE ON FUNCTION public.admin_add_invoice_transaction TO anon, authenticated;
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
-- ================================================================
-- FIX: Allow Admins to view and manage all account transactions
-- ================================================================

-- This policy gives any user with 'is_admin = true' in the profiles table
-- the ability to perform ALL operations (SELECT, INSERT, UPDATE, DELETE)
-- on all records within the account_transactions table.

DROP POLICY IF EXISTS "Admins view all transactions" ON public.account_transactions;

CREATE POLICY "Admins view all transactions" ON public.account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        )
    );
-- 011_auto_document_no.sql
-- Otomatik evrak no (OMG0000001) sistemi

-- 1. Evrak no için sequence oluştur (Eğer varsa hata vermez)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'document_no_seq') THEN
        CREATE SEQUENCE document_no_seq START 1;
    END IF;
END $$;

-- 2. Bir sonraki evrak numarasını OMG formatında döndüren fonksiyon
CREATE OR REPLACE FUNCTION get_next_document_no()
RETURNS TEXT AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    v_seq := nextval('document_no_seq');
    RETURN 'OMG' || LPAD(v_seq::text, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Tetikleyici fonksiyon: Eğer document_no OMG ile başlamıyorsa otomatik ata
CREATE OR REPLACE FUNCTION trg_set_document_no()
RETURNS TRIGGER AS $$
BEGIN
    -- Sipariş, iade, ödeme fark etmeksizin her işleme OMG formatında no verilir
    -- Eğer zaten OMG ile başlamıyorsa (manuel veya sistem UUID ise) sıradaki no atanır
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR LEFT(NEW.document_no, 3) != 'OMG' THEN
        NEW.document_no := get_next_document_no();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. account_transactions tablosuna trigger ekle
DROP TRIGGER IF EXISTS set_document_no_trigger ON account_transactions;
CREATE TRIGGER set_document_no_trigger
BEFORE INSERT ON account_transactions
FOR EACH ROW
EXECUTE FUNCTION trg_set_document_no();

-- Not: Mevcut işlemleri etkilemez, sadece yenileri OMG formatında başlar.
-- 1. Update 'place_b2b_order' RPC
-- Remove: Stock reduction (Moving to Admin confirmation)
-- Add: Risk limit enforcement (For non-locked companies)

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
BEGIN
    -- Verify user (Allow Admins to bypass for showroom mode)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (company_id = p_company_id OR is_admin = true)
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
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
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
-- Update 'place_b2b_order' RPC to allow Service Role and Representatives
-- This fixes the 'Unauthorized company order' error when placing orders via API

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
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
BEGIN
    -- Verify user 
    -- 1. Allow if service_role (Internal API calls with service key)
    -- 2. Allow if Admin
    -- 3. Allow if Representative (any active rep)
    -- 4. Allow if regular user belonging to the company
    IF v_user_role <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND (is_admin = true OR company_id = p_company_id)
        ) AND NOT EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized company order';
        END IF;
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
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
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
-- Update 'place_b2b_order' RPC to treat risk_limit = 0 as UNLIMITED
-- Also ensures Service Role and Representatives can place orders

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
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
BEGIN
    -- 1. Authorization Check
    IF v_user_role <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND (is_admin = true OR company_id = p_company_id)
        ) AND NOT EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized company order';
        END IF;
    END IF;

    -- 2. Fetch Status and Limits
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- 3. Validation Logic
    IF v_is_locked IS TRUE THEN
        -- Prepayment Locked: Must have (+) balance covering the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için yeterli bakiye bulunmalıdır.';
        END IF;
    ELSE
        -- Standard Account: Check Risk Limit ONLY if it is greater than 0
        -- If v_risk_limit is 0, it means UNLIMITED debt is allowed.
        IF v_risk_limit > 0 THEN
            IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
                RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
            END IF;
        END IF;
    END IF;

    -- 4. Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- 5. Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- 6. Update Balance
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- 7. Log Transaction
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;
-- B2B Yedek Parça - Firma Bazlı Özel Ürün İskonto Sistemi
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Ek İskonto Tablosunu Oluştur
CREATE TABLE IF NOT EXISTS public.company_extra_discounts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade,
    discount_rate numeric not null default 0,
    created_at timestamp with time zone default now(),
    unique(company_id, product_id)
);

-- 2. Row Level Security (RLS) Ayarları
-- Bu tabloya Service Role (Admin) her zaman erişebilsin
ALTER TABLE public.company_extra_discounts ENABLE ROW LEVEL SECURITY;

-- Mevcut politikaları temizle (varsa)
DROP POLICY IF EXISTS "Allow all for service role" ON public.company_extra_discounts;

-- Yeni politikayı ekle
CREATE POLICY "Allow all for service role" 
ON public.company_extra_discounts 
USING (true) 
WITH CHECK (true);

-- 3. Tabloyu Schema Cache'e Tanıtmak İçin Bir Yorum Ekle
COMMENT ON TABLE public.company_extra_discounts IS 'Firmaya özel ürün bazlı ek iskonto tanımlamaları';
-- =============================================
-- FIX: Admin Showroom Bypass (Prepayment & Risk)
-- =============================================
-- Bu SQL, adminlerin showroom modunda borç ve ön ödeme
-- kontrollerini atlayabilmesini sağlar.

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB,
    p_bypass_prepayment BOOLEAN DEFAULT FALSE,
    p_bypass_risk_limit BOOLEAN DEFAULT FALSE
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
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
    v_is_privileged BOOLEAN := FALSE;
BEGIN
    -- 1. YETKİ KONTROLÜ
    IF v_user_role = 'service_role' THEN
        v_is_privileged := TRUE;
    ELSE
        -- Admin veya Müşteri Temsilcisi mi?
        SELECT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND is_admin = true
        ) OR EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) INTO v_is_privileged;

        -- Eğer yetkisizse sadece kendi firmasına sipariş verebilir
        IF NOT v_is_privileged THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = v_user_id AND company_id = p_company_id
            ) THEN
                RAISE EXCEPTION 'Unauthorized company order';
            END IF;
            -- Yetkisiz kullanıcı bypass parametrelerini kullanamaz
            p_bypass_prepayment := FALSE;
            p_bypass_risk_limit := FALSE;
        END IF;
    END IF;

    -- 2. BAKİYE VE LİMİT BİLGİLERİNİ ÇEK
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- 3. KONTROL MEKANİZMASI
    IF v_is_locked IS TRUE AND NOT p_bypass_prepayment THEN
        -- Ön ödemeli (kilitli) hesap: Bakiyesi yetmeli (Bypass edilmediyse)
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli hesaplarda bakiye sipariş tutarını karşılamalıdır.';
        END IF;
    ELSIF NOT p_bypass_risk_limit THEN
        -- Standart hesap: Risk Limiti Kontrolü (Bypass edilmediyse)
        -- ÖNEMLİ: Eğer v_risk_limit 0 ise, bu kontrol tamamen atlanır (SINIRSIZ BORÇ)
        IF v_risk_limit > 0 THEN
            IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
                RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi aşmaktadır.';
            END IF;
        END IF;
    END IF;

    -- 4. SİPARİŞ OLUŞTURMA
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- 5. SİPARİŞ KALEMLERİNİ EKLEME
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, 
            (v_item->>'product_id')::UUID, 
            (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), 
            (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- 6. BAKİYE DÜŞME VE HAREKET KAYDI
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'new_balance', v_new_balance
    );
END;
$$;
-- 1. Enable Row Level Security (RLS) on all exposed tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent "already exists" errors
DO $$
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
    DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    
    -- Companies
    DROP POLICY IF EXISTS "Users can read their own company" ON companies;
    DROP POLICY IF EXISTS "Admins can read all companies" ON companies;
    
    -- Products
    DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
    DROP POLICY IF EXISTS "Admins can manage products" ON products;
    
    -- Invoices
    DROP POLICY IF EXISTS "Users can view own company invoices" ON invoices;
    DROP POLICY IF EXISTS "Admins can manage all invoices" ON invoices;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;


-- 3. PROFILES Table Policies
-- Breaking infinite recursion: Admins checking themselves without triggering policy again
CREATE POLICY "Users can read own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

-- For profiles table specifically, we cannot do a sub-select on profiles without infinite loop.
-- The most common fix is to use JWT claims, but since we rely on `is_admin` column:
-- We create a SECURITY DEFINER function to bypass RLS when checking admin status.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can read all profiles" ON profiles 
    FOR SELECT USING (public.is_admin_user());

CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);


-- 4. COMPANIES Table Policies
CREATE POLICY "Users can read their own company" ON companies 
    FOR SELECT USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    
CREATE POLICY "Admins can read all companies" ON companies 
    FOR ALL USING (public.is_admin_user());


-- 5. PRODUCTS Table Policies
CREATE POLICY "Authenticated users can view products" ON products 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "Admins can manage products" ON products 
    FOR ALL USING (public.is_admin_user());


-- 6. INVOICES Table Policies
CREATE POLICY "Users can view own company invoices" ON invoices 
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    
CREATE POLICY "Admins can manage all invoices" ON invoices 
    FOR ALL USING (public.is_admin_user());
