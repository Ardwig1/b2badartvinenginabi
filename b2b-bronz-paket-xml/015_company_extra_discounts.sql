-- B2B Yedek Parça - Firma Bazlı Özel Ürün İskonto Sistemi
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Ek İskonto Tablosunu Oluştur
CREATE TABLE IF NOT EXISTS public.company_extra_discounts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid references public.companies(id) on delete cascade,
    product_id uuid references public.products(id) on delete cascade,
    discount_rate numeric not null default 0,
    created_at timestamp with time zone default now(),
    unique(company_id, product_id)
);

-- 2. Row Level Security (RLS) Ayarları
-- Bu tabloya Service Role (Admin) her zaman erişebilsin
ALTER TABLE public.company_extra_discounts ENABLE ROW LEVEL SECURITY;

-- Mevcut politikaları temizle (varsa)
DROP POLICY IF EXISTS "Allow all for service role" ON public.company_extra_discounts;

-- Yeni politikayı ekle
CREATE POLICY "Allow all for service role" 
ON public.company_extra_discounts 
USING (true) 
WITH CHECK (true);

-- 3. Tabloyu Schema Cache'e Tanıtmak İçin Bir Yorum Ekle
COMMENT ON TABLE public.company_extra_discounts IS 'Firmaya özel ürün bazlı ek iskonto tanımlamaları';
