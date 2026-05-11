-- B2B Yedek Parça - Ürün İskonto ve Katalog Güncellemesi
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Products tablosuna discount_rate (iskonto oranı) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_rate NUMERIC DEFAULT 0;

-- 2. Products tablosuna box_quantity (koli adeti) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS box_quantity INTEGER DEFAULT 1;

-- 3. Products tablosuna oem_no sütunu ekle (eğer yoksa)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS oem_no TEXT;

-- 4. Products tablosuna car_brand ve car_model sütunları ekle (eğer yoksa)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS car_brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS car_model TEXT;

-- 5. Ürün takip tablosu oluştur
CREATE TABLE IF NOT EXISTS product_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- RLS for product_follows
ALTER TABLE product_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follows" ON product_follows FOR ALL USING (auth.uid() = user_id);
