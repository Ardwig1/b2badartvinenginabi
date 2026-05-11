-- ==========================================
-- B2B Yedek Parça - Multi-Currency Pricing (Phase 11)
-- ==========================================

-- 1. products tablosuna 'currency' kolonunu ekle
-- Eğer değer belirtilmezse varsayılan olarak 'TRY' (Türk Lirası) kaydedilir.
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TRY';

-- 2. Mevcut ürünlerin tümünün list fiyatlarını otomatik olarak TRY kabul et.
-- Eğer tablonuzda önceden eklenmiş veriler varsa:
UPDATE public.products
SET currency = 'TRY'
WHERE currency IS NULL;
