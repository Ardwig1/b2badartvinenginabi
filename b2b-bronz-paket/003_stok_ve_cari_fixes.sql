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
