-- B2B Yedek Parça - Faz 5 (Ürün Numarası) Veritabanı Güncellemesi

-- 1. Products tablosuna product_number sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_number TEXT;

-- Not: product_number boş olabilir veya benzersiz (UNIQUE) olabilir,
-- Ancak mevcut veriler olduğu için başlangıçta UNIQUE yapmıyoruz.
-- İhtiyaç halinde aşağıdaki satır çalıştırılabilir:
-- ALTER TABLE public.products ADD CONSTRAINT products_product_number_key UNIQUE (product_number);
