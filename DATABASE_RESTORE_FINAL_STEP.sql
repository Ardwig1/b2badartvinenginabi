-- ========================================================
-- DATABASE RESTORE FINAL STEP (RLS & SECURITY)
-- ========================================================
-- Bu script tabloların yanındaki 'Dünya' simgesini aktif eder
-- ve temel güvenlik kurallarını (RLS) tanımlar.

-- 1. Tüm Tablolarda RLS'yi Aktif Et (Dünya Simgesini Getirir)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 2. Temel Erişim Politikaları (Kaan Abi Standartları)
-- Not: Bu kurallar başlangıç seviyesindedir, sistemin çalışmasını sağlar.

-- Products: Herkes görebilsin
DROP POLICY IF EXISTS "Public Read" ON public.products;
CREATE POLICY "Public Read" ON public.products FOR SELECT USING (true);

-- Banners: Herkes görebilsin
DROP POLICY IF EXISTS "Public Read Banners" ON public.banners;
CREATE POLICY "Public Read Banners" ON public.banners FOR SELECT USING (true);

-- Companies & Profiles: Admin her şeyi yapsın
DROP POLICY IF EXISTS "Admin All" ON public.companies;
CREATE POLICY "Admin All" ON public.companies FOR ALL USING (true);

-- Done!
