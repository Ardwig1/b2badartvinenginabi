-- ========================================================
-- DATABASE RESTORE FINAL STEP (API & RLS & SECURITY)
-- ========================================================
-- Bu script tabloların yanındaki 'Dünya' simgesini (API) aktif eder,
-- yetkileri Supabase rollerine geri verir ve RLS'yi açar.

-- 1. ŞEMA YETKİLERİNİ GERİ VER (Dünya Simgesi İçin Kritik)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 2. TÜM TABLOLARDA RLS'Yİ AKTİF ET
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 3. POSTGREST CACHE YENİLEME (Sisteme 'ben buradayım' de)
NOTIFY pgrst, 'reload schema';

-- 4. TEMEL POLİTİKALAR (Hata almamak için)
-- Products: Herkes görebilsin
DROP POLICY IF EXISTS "Public Read" ON public.products;
CREATE POLICY "Public Read" ON public.products FOR SELECT USING (true);

-- Banners: Herkes görebilsin
DROP POLICY IF EXISTS "Public Read Banners" ON public.banners;
CREATE POLICY "Public Read Banners" ON public.banners FOR SELECT USING (true);

-- Companies: Admin her şeyi yapsın
DROP POLICY IF EXISTS "Admin All" ON public.companies;
CREATE POLICY "Admin All" ON public.companies FOR ALL USING (true);

-- Done! 🚀
-- NOT: Bu scripti çalıştırdıktan sonra Supabase sayfasını (F5) yenilemeyi unutma!
