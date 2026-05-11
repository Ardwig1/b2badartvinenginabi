-- ========================================================
-- DATABASE NUKE & RESET SCRIPT
-- ========================================================
-- UYARI: BU İŞLEM 'PUBLIC' ŞEMASINDAKİ TÜM TABLOLARI VE VERİLERİ SİLER!
-- Hazırlayan: Gemini CLI

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. Tüm Tabloları Sil (Cascade ile bağımlılıkları temizler)
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- 2. Tüm Fonksiyonları Sil
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args 
              FROM pg_proc 
              JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
              WHERE pg_namespace.nspname = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;

    -- 3. Tüm Sequence'ları Sil
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
    END LOOP;
END $$;

-- NOT: Bu işlemden sonra FINAL_MASTER_SCHEMA_V5.sql dosyasını çalıştırın.
