-- =============================================
-- ACIL: SHOWROOM BYPASS SQL GUNCELLEMESI (FIXED)
-- =============================================
-- Bu kodu Supabase Dashboard -> SQL Editor kısmına yapıştırıp RUN butonuna basın.
-- Bu işlem Adminlerin showroom modunda borç ve ön ödeme kontrollerini atlamasını sağlar.

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
