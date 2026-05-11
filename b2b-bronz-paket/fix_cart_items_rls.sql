-- 1. RLS'i Etkinleştir (Eğer kapalıysa)
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- 2. Eski tüm politikaları temizle (Sıfırdan kurmak için)
DROP POLICY IF EXISTS "Users can manage their own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Admins can manage all cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Admins can view all cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Everyone can do everything" ON public.cart_items;

-- 3. MÜŞTERİ POLİTİKASI: Kullanıcılar bağlı oldukları firmanın sepetini yönetebilir
CREATE POLICY "Users can manage their company cart items" 
ON public.cart_items 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = cart_items.company_id
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.company_id = cart_items.company_id
  )
);

-- 4. ADMİN POLİTİKASI: Adminler tüm sepetleri görebilir ve yönetebilir (Showroom için)
CREATE POLICY "Admins can manage all cart items" 
ON public.cart_items 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- 5. UNIQUE CONSTRAINT: Aynı firma aynı ürünü iki kez eklemesin
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_company_id_product_id_key;
ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_company_id_product_id_key UNIQUE (company_id, product_id);

-- 6. Zaman Damgası Otomasyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON public.cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
