-- ========================================================
-- DATABASE NUKE & RESET SCRIPT (V2 - Hatasız Versiyon)
-- ========================================================
-- UYARI: BU İŞLEM TÜM TABLOLARI, VERİLERİ VE FONKSİYONLARI SİLER!
-- Hazırlayan: Gemini CLI

-- 1. Önce her şeyi (eklentiler dahil) cascade ile sil
DROP SCHEMA public CASCADE;

-- 2. Şemayı tertemiz yeniden oluştur
CREATE SCHEMA public;

-- 3. Yetkileri Supabase standartlarına göre geri ver
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- NOT: Bu işlemden sonra FINAL_MASTER_SCHEMA_V5.sql dosyasını çalıştırın.
-- Master Schema içinde "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 
-- komutu olduğu için eklenti de otomatik olarak yeniden kurulacaktır.
