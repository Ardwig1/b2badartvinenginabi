-- =============================================
-- FIX: Sipariş Yetki Hatası (Unauthorized Order)
-- =============================================
-- Bu SQL, hem normal müşterilerin hem de showroom modundaki 
-- yetkililerin (Admin/Temsilci) sipariş verebilmesini sağlar.

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Fonksiyonu oluşturanın yetkisiyle çalışır
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
    -- 1. YETKİ KONTROLÜ
    -- Eğer istek API (service_role) üzerinden geliyorsa veya 
    -- Kullanıcı Admin ise veya Bayi kendi hesabındaysa izin ver.
    -- Ayrıca Temsilci tablosunda kaydı varsa izin ver.
    
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

    -- 2. BAKİYE VE LİMİT KONTROLLERİ
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    IF v_is_locked IS TRUE THEN
        -- Ön ödemeli (kilitli) hesap kontrolü
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli hesaplarda bakiyeniz sipariş tutarını karşılamalıdır.';
        END IF;
    ELSE
        -- Standart hesap (Risk Limiti) kontrolü
        IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi aşmaktadır.';
        END IF;
    END IF;

    -- 3. SİPARİŞ OLUŞTURMA
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- 4. SİPARİŞ KALEMLERİNİ EKLEME
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

    -- 5. BAKİYE DÜŞME VE HAREKET KAYDI
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
