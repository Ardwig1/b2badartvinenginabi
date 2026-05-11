-- 1. Müşteri Temsilcileri Tablosu
CREATE TABLE IF NOT EXISTS public.customer_representatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tc_no TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    position TEXT CHECK (position IN ('SATIŞ MÜDÜRÜ', 'BÖLGE MÜDÜRÜ', 'SATIŞ TEMSİLCİSİ')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Temsilci-Firma Eşleşme Tablosu (Birden fazla firma seçimi için)
CREATE TABLE IF NOT EXISTS public.representative_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.customer_representatives(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(representative_id, company_id) -- Aynı eşleşme mükerrer olmasın
);

-- 3. RLS Politikaları
ALTER TABLE public.customer_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_assignments ENABLE ROW LEVEL SECURITY;

-- Admin her şeyi yapabilir
CREATE POLICY "Admins can manage representatives" 
ON public.customer_representatives 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

CREATE POLICY "Admins can manage assignments" 
ON public.representative_assignments 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- 4. Zaman damgası güncelleyici tetikleyicisi
DROP TRIGGER IF EXISTS update_representatives_updated_at ON public.customer_representatives;
CREATE TRIGGER update_representatives_updated_at
    BEFORE UPDATE ON public.customer_representatives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
