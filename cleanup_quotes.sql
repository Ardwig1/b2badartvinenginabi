-- B2B Yedek Parça - Quotes Temizlik Betiği
-- Bu SQL betiği, artık kullanılmayan "Teklifler" (Quotes) tablolarını ve sütunlarını kaldırır.
-- Supabase SQL Editor'de çalıştırın.

-- 1. Tabloları Kaldır (Bağımlılıklar nedeniyle sırayla)
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;

-- 2. Siparişler (orders) tablosundaki quote_id sütununu kaldır
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS quote_id;

-- 3. Varsa eski politikaları temizle (CASCADE zaten tabloları siliyorsa politikalar da gider ama garanti olsun)
DROP POLICY IF EXISTS "Company sees own quotes" ON quotes;
DROP POLICY IF EXISTS "Company creates quotes" ON quotes;
DROP POLICY IF EXISTS "Admins manage quotes" ON quotes;
