-- B2B Yedek Parça - Geliş Fiyatı ve Kâr Oranı Sistemi
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Products tablosuna cost_price (geliş fiyatı) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- 2. Products tablosuna profit_margin (kâr oranı %) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profit_margin NUMERIC DEFAULT 0;
