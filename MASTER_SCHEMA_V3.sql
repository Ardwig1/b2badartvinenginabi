-- B2B Yedek Parça Platformu - Supabase SQL Schema
-- Supabase SQL Editor'de bu SQL'i çalıştırın

-- 1. PRICE GROUPS
create table if not exists price_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discount_percent numeric default 0,
  created_at timestamptz default now()
);

-- 2. COMPANIES
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_number text unique not null,
  address text,
  phone text,
  email text,
  contact_person text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  price_group_id uuid references price_groups(id),
  credit_limit numeric default 0,
  current_balance numeric default 0,
  created_at timestamptz default now()
);

-- 3. PROFILES (links auth.users → companies)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id),
  full_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 4. PRODUCTS
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  brand text,
  category text,
  description text,
  image_url text,
  list_price numeric not null default 0,
  stock_quantity integer not null default 0,
  unit text default 'adet',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 5. PRODUCT PRICES (per price group overrides)
create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  price_group_id uuid references price_groups(id) on delete cascade,
  custom_price numeric,
  unique(product_id, price_group_id)
);

-- 6. STOCK MOVEMENTS
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity integer not null,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 9. ORDERS
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  shipping_address text,
  note text,
  total_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 10. ORDER ITEMS
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity integer not null,
  unit_price numeric not null,
  total_price numeric not null
);

-- 11. INVOICES
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  order_id uuid references orders(id),
  invoice_number text unique not null,
  status text default 'unpaid' check (status in ('unpaid', 'paid', 'partial')),
  issue_date date default current_date,
  due_date date,
  subtotal numeric default 0,
  tax_percent numeric default 18,
  tax_amount numeric default 0,
  total_amount numeric default 0,
  paid_amount numeric default 0,
  note text,
  created_at timestamptz default now()
);

-- 12. INVOICE ITEMS
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text,
  quantity integer not null,
  unit_price numeric not null,
  total_price numeric not null
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table companies enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table product_prices enable row level security;
alter table price_groups enable row level security;
alter table stock_movements enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

-- Profiles: users read own profile
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Admins read all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- Products: all authenticated users can view active products
create policy "Authenticated can view products" on products for select using (
  auth.uid() is not null and is_active = true
);
create policy "Admins manage products" on products for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- Orders: companies see their own
create policy "Company sees own orders" on orders for select using (
  company_id = (select company_id from profiles where id = auth.uid())
);
create policy "Company creates orders" on orders for insert with check (
  company_id = (select company_id from profiles where id = auth.uid())
);
create policy "Admins manage orders" on orders for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- Invoices: companies see their own
create policy "Company sees own invoices" on invoices for select using (
  company_id = (select company_id from profiles where id = auth.uid())
);
create policy "Admins manage invoices" on invoices for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

-- ============================================
-- INITIAL DATA
-- ============================================
insert into price_groups (name, discount_percent) values
  ('A Grubu', 20),
  ('B Grubu', 15),
  ('C Grubu', 10)
on conflict do nothing;

-- Trigger: create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
-- Add new columns to the public.companies table for extended info and new login flow
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS tax_office TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS branch TEXT,
ADD COLUMN IF NOT EXISTS dealer_code TEXT,
ADD COLUMN IF NOT EXISTS user_code TEXT;

-- (Optional) Create a unique constraint on dealer_code + user_code
-- This ensures no two companies/users share the same exact login combination
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_dealer_user_code') THEN
    ALTER TABLE public.companies
    ADD CONSTRAINT unique_dealer_user_code UNIQUE (dealer_code, user_code);
  END IF;
END $$;
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
-- SQL to create suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions" ON suggestions
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Users can insert their own suggestions
CREATE POLICY "Users can insert their own suggestions" ON suggestions
    FOR INSERT
    WITH CHECK (true); -- We will handle security via the API, but let's allow insert.
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'search', 'cart_add', 'cart_remove', 'cart_update'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own activities" ON user_activities 
    FOR INSERT 
    WITH CHECK (
        company_id IN (SELECT id FROM companies WHERE id = user_activities.company_id) -- Will be restricted accurately via RLS user profile logic, but for simplicity we rely on the backend API inserting activities securely.
);

CREATE POLICY "Admins can view activities" ON user_activities 
    FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
-- B2B Yedek Parça - Faz 5 (Ürün Numarası) Veritabanı Güncellemesi

-- 1. Products tablosuna product_number sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_number TEXT;

-- Not: product_number boş olabilir veya benzersiz (UNIQUE) olabilir,
-- Ancak mevcut veriler olduğu için başlangıçta UNIQUE yapmıyoruz.
-- İhtiyaç halinde aşağıdaki satır çalıştırılabilir:
-- ALTER TABLE public.products ADD CONSTRAINT products_product_number_key UNIQUE (product_number);
-- SQL Script: Add new stock columns to products table
-- Please run this script in your Supabase SQL Editor

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_merkez INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_depo INTEGER DEFAULT 0;

-- Optional: If you want to move all existing generic stock into the Merkez bin
UPDATE public.products SET stock_merkez = stock_quantity WHERE stock_merkez = 0 AND stock_quantity > 0;
-- Create a public bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the products bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Allow authenticated users (admins) to insert/upload images
CREATE POLICY "Auth Insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

-- Allow authenticated users to update/overwrite images
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');
-- B2B Yedek Parça - Geliş Fiyatı ve Kâr Oranı Sistemi
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Products tablosuna cost_price (geliş fiyatı) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- 2. Products tablosuna profit_margin (kâr oranı %) sütunu ekle
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profit_margin NUMERIC DEFAULT 0;
-- Phase 4: Add Merkez and Depo stock fields
-- Please run this script in your Supabase SQL Editor

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS stock_merkez integer not null default 0,
  ADD COLUMN IF NOT EXISTS stock_depo integer not null default 0;

-- Optional test update to migrate existing stock to Merkez:
UPDATE products SET stock_merkez = stock_quantity WHERE stock_merkez = 0;
-- 1. Müşteri Temsilcileri Tablosu
CREATE TABLE IF NOT EXISTS public.customer_representatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    tc_no TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    position TEXT CHECK (position IN ('SATIŞ MÜDÜRÜ', 'BÖLGE MÜDÜRÜ', 'SATIŞ TEMSİLCİSİ')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Temsilci-Firma Eşleşme Tablosu (Birden fazla firma seçimi için)
CREATE TABLE IF NOT EXISTS public.representative_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id UUID REFERENCES public.customer_representatives(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(representative_id, company_id) -- Aynı eşleşme mükerrer olmasın
);

-- 3. RLS Politikaları
ALTER TABLE public.customer_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_assignments ENABLE ROW LEVEL SECURITY;

-- Admin her şeyi yapabilir
CREATE POLICY "Admins can manage representatives" 
ON public.customer_representatives 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

CREATE POLICY "Admins can manage assignments" 
ON public.representative_assignments 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

-- 4. Zaman damgası güncelleyici tetikleyicisi
DROP TRIGGER IF EXISTS update_representatives_updated_at ON public.customer_representatives;
CREATE TRIGGER update_representatives_updated_at
    BEFORE UPDATE ON public.customer_representatives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- 1. Create the account_transactions table 
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    transaction_type TEXT NOT NULL, 
    document_no TEXT, 
    description TEXT,
    debt NUMERIC(15,2) DEFAULT 0, 
    credit NUMERIC(15,2) DEFAULT 0, 
    balance_after NUMERIC(15,2), 
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own transactions" ON public.account_transactions;

CREATE POLICY "Users view own transactions" ON public.account_transactions
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 2. Create RPC for Placing an Order (Secure for authenticated users)
CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to bypass RLS internally
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
BEGIN
    -- Verify the user actually belongs to this company!
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
        UPDATE public.products SET stock_quantity = GREATEST(0, stock_quantity - (v_item->>'quantity')::INT) WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    -- Deduct Balance (Borçlanma)
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction (Evrak No = Sipariş ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::TEXT, 'Platform Siparişi', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

-- Allow authenticated users to call place_b2b_order
GRANT EXECUTE ON FUNCTION public.place_b2b_order TO authenticated;

-- 3. Create a secured RPC for Tosla callbacks (Requires a secret key because Service Role is broken)
CREATE OR REPLACE FUNCTION public.process_tosla_payment(
    p_api_secret TEXT,
    p_company_id UUID,
    p_amount NUMERIC(15,2),
    p_transaction_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC(15,2);
BEGIN
    -- Verify custom secret key
    IF p_api_secret != 'b2b_secret_omi_12345!@#' THEN
        RAISE EXCEPTION 'Invalid Internal API Secret';
    END IF;

    -- Add to Balance (Tahsilat)
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) + p_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction (Evrak No = Banka Transaction ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'KREDİ KARTI', p_transaction_id, 'Tosla Online Ödeme', 0, p_amount, v_new_balance);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Allow anon to execute it (since Vercel backend calls it without user session), but the custom secret key defends it
GRANT EXECUTE ON FUNCTION public.process_tosla_payment TO anon, authenticated;
-- ================================================================
-- FIX 1: place_b2b_order — Stok kontrolü + stock_movements kaydı
-- ================================================================

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_product_id UUID;
    v_quantity INT;
    v_current_stock INT;
    v_product_name TEXT;
BEGIN
    -- Kullanıcının bu firmaya ait olduğunu doğrula
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Sipariş oluşturmadan ÖNCE tüm ürünlerin stoğunu kontrol et
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity   := (v_item->>'quantity')::INT;

        SELECT stock_quantity, name
        INTO v_current_stock, v_product_name
        FROM public.products
        WHERE id = v_product_id;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Stok yetersiz: "%" ürünü için talep edilen miktar (%) mevcut stoktan (%) fazla.',
                v_product_name, v_quantity, v_current_stock;
        END IF;
    END LOOP;

    -- Sipariş oluştur
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Ürünleri ekle, stoğu düş ve stock_movements'a yaz
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity   := (v_item->>'quantity')::INT;

        -- order_items'a ekle
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id,
            v_product_id,
            v_quantity,
            (v_item->>'unit_price')::NUMERIC(15,2),
            (v_item->>'total_price')::NUMERIC(15,2)
        );

        -- Stoğu güncelle
        UPDATE public.products
        SET stock_quantity = stock_quantity - v_quantity
        WHERE id = v_product_id;

        -- Stok hareketi kaydet
        INSERT INTO public.stock_movements (product_id, type, quantity, note, created_by, created_at)
        VALUES (
            v_product_id,
            'out',
            v_quantity,
            'Sipariş: ' || v_order_id::TEXT,
            (SELECT id FROM public.profiles WHERE company_id = p_company_id LIMIT 1),
            NOW()
        );
    END LOOP;

    -- Bakiyeyi düş (borçlanma)
    UPDATE public.companies
    SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id
    RETURNING current_balance INTO v_new_balance;

    -- Cari hesap kaydı (Evrak No = Sipariş ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::TEXT, 'Platform Siparişi', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_b2b_order TO authenticated;


-- ================================================================
-- FIX 2: Admin fatura eklenince cari hesaba işle (account_transactions)
-- Bu fonksiyon admin UI'dan çağrılacak
-- ================================================================

CREATE OR REPLACE FUNCTION public.admin_add_invoice_transaction(
    p_api_secret TEXT,
    p_company_id UUID,
    p_amount NUMERIC(15,2),
    p_description TEXT,
    p_invoice_no TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC(15,2);
BEGIN
    IF p_api_secret != 'b2b_secret_omi_12345!@#' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Bakiyeyi düş (admin fatura = borç)
    UPDATE public.companies
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_company_id
    RETURNING current_balance INTO v_new_balance;

    -- Cari hesap kaydı
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
    VALUES (p_company_id, 'FATURA', p_invoice_no, p_description, p_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_invoice_transaction TO anon, authenticated;
-- ================================================================
-- FIX: Remove hardcoded api secret from admin invoice function
-- ================================================================

DROP FUNCTION IF EXISTS public.admin_add_invoice_transaction(TEXT, UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_add_invoice_transaction(UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_add_invoice_transaction(
    p_company_id UUID,
    p_amount NUMERIC(15,2),
    p_description TEXT,
    p_invoice_no TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance NUMERIC(15,2);
    v_is_admin BOOLEAN;
BEGIN
    -- Authorization: Validate if calling user is an actual admin
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
    
    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can perform this action';
    END IF;

    -- Bakiyeyi düş (admin fatura = borç)
    UPDATE public.companies
    SET current_balance = COALESCE(current_balance, 0) - p_amount
    WHERE id = p_company_id
    RETURNING current_balance INTO v_new_balance;

    -- Cari hesap kaydı
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after)
    VALUES (p_company_id, 'FATURA', p_invoice_no, p_description, p_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_invoice_transaction(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
-- 1. Add 'is_prepayment_locked' column generic to companies 
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_prepayment_locked BOOLEAN DEFAULT false;

-- 2. Update the 'place_b2b_order' RPC to enforce the prepayment rule on the server side
CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to bypass RLS internally
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
BEGIN
    -- Verify the user actually belongs to this company!
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND company_id = p_company_id) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Prepayment Lock Validation
    SELECT is_prepayment_locked, COALESCE(current_balance, 0) INTO v_is_locked, v_current_balance FROM public.companies WHERE id = p_company_id;
    
    IF v_is_locked IS TRUE THEN
        -- If locked, they must have enough positive balance to cover the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için içeride (+) bakiye veya ödeme bulunmalıdır.';
        END IF;
    END IF;

    -- Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
        UPDATE public.products SET stock_quantity = GREATEST(0, stock_quantity - (v_item->>'quantity')::INT) WHERE id = (v_item->>'product_id')::UUID;
    END LOOP;

    -- Deduct Balance (Borçlanma)
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction (Evrak No = Sipariş ID)
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_b2b_order(UUID, TEXT, TEXT, NUMERIC, JSONB) TO authenticated;
-- ================================================================
-- FIX: Allow Admins to view and manage all account transactions
-- ================================================================

-- This policy gives any user with 'is_admin = true' in the profiles table
-- the ability to perform ALL operations (SELECT, INSERT, UPDATE, DELETE)
-- on all records within the account_transactions table.

DROP POLICY IF EXISTS "Admins view all transactions" ON public.account_transactions;

CREATE POLICY "Admins view all transactions" ON public.account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        )
    );
-- 011_auto_document_no.sql
-- Otomatik evrak no (OMG0000001) sistemi

-- 1. Evrak no için sequence oluştur (Eğer varsa hata vermez)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'document_no_seq') THEN
        CREATE SEQUENCE document_no_seq START 1;
    END IF;
END $$;

-- 2. Bir sonraki evrak numarasını OMG formatında döndüren fonksiyon
CREATE OR REPLACE FUNCTION get_next_document_no()
RETURNS TEXT AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    v_seq := nextval('document_no_seq');
    RETURN 'OMG' || LPAD(v_seq::text, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Tetikleyici fonksiyon: Eğer document_no OMG ile başlamıyorsa otomatik ata
CREATE OR REPLACE FUNCTION trg_set_document_no()
RETURNS TRIGGER AS $$
BEGIN
    -- Sipariş, iade, ödeme fark etmeksizin her işleme OMG formatında no verilir
    -- Eğer zaten OMG ile başlamıyorsa (manuel veya sistem UUID ise) sıradaki no atanır
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR LEFT(NEW.document_no, 3) != 'OMG' THEN
        NEW.document_no := get_next_document_no();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. account_transactions tablosuna trigger ekle
DROP TRIGGER IF EXISTS set_document_no_trigger ON account_transactions;
CREATE TRIGGER set_document_no_trigger
BEFORE INSERT ON account_transactions
FOR EACH ROW
EXECUTE FUNCTION trg_set_document_no();

-- Not: Mevcut işlemleri etkilemez, sadece yenileri OMG formatında başlar.
-- 1. Update 'place_b2b_order' RPC
-- Remove: Stock reduction (Moving to Admin confirmation)
-- Add: Risk limit enforcement (For non-locked companies)

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
    v_risk_limit NUMERIC(15,2);
BEGIN
    -- Verify user (Allow Admins to bypass for showroom mode)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (company_id = p_company_id OR is_admin = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized company order';
    END IF;

    -- Fetch status and limits
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- VALIDATION
    IF v_is_locked IS TRUE THEN
        -- Prepayment Locked: Must have (+) balance covering the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için yeterli bakiye bulunmalıdır.';
        END IF;
    ELSE
        -- Standard Account: Check Risk Limit
        IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
        END IF;
    END IF;

    -- Create Order (Stock NOT reduced here)
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items (Stock NOT reduced here)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- Deduct Balance
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;
-- Update 'place_b2b_order' RPC to allow Service Role and Representatives
-- This fixes the 'Unauthorized company order' error when placing orders via API

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
    v_risk_limit NUMERIC(15,2);
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
BEGIN
    -- Verify user 
    -- 1. Allow if service_role (Internal API calls with service key)
    -- 2. Allow if Admin
    -- 3. Allow if Representative (any active rep)
    -- 4. Allow if regular user belonging to the company
    IF v_user_role <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND (is_admin = true OR company_id = p_company_id)
        ) AND NOT EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized company order';
        END IF;
    END IF;

    -- Fetch status and limits
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- VALIDATION
    IF v_is_locked IS TRUE THEN
        -- Prepayment Locked: Must have (+) balance covering the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için yeterli bakiye bulunmalıdır.';
        END IF;
    ELSE
        -- Standard Account: Check Risk Limit
        IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
            RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
        END IF;
    END IF;

    -- Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- Deduct Balance
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- Log Transaction
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;
-- Update 'place_b2b_order' RPC to treat risk_limit = 0 as UNLIMITED
-- Also ensures Service Role and Representatives can place orders

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB 
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
    v_risk_limit NUMERIC(15,2);
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
BEGIN
    -- 1. Authorization Check
    IF v_user_role <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND (is_admin = true OR company_id = p_company_id)
        ) AND NOT EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Unauthorized company order';
        END IF;
    END IF;

    -- 2. Fetch Status and Limits
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- 3. Validation Logic
    IF v_is_locked IS TRUE THEN
        -- Prepayment Locked: Must have (+) balance covering the order
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli (kilitli) hesapların sipariş verebilmesi için yeterli bakiye bulunmalıdır.';
        END IF;
    ELSE
        -- Standard Account: Check Risk Limit ONLY if it is greater than 0
        -- If v_risk_limit is 0, it means UNLIMITED debt is allowed.
        IF v_risk_limit > 0 THEN
            IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
                RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi (₺%) aşmaktadır.', v_risk_limit;
            END IF;
        END IF;
    END IF;

    -- 4. Create Order
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- 5. Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- 6. Update Balance
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    -- 7. Log Transaction
    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;
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
-- =============================================
-- FIX: Admin Showroom Bypass (Prepayment & Risk)
-- =============================================
-- Bu SQL, adminlerin showroom modunda borç ve ön ödeme
-- kontrollerini atlayabilmesini sağlar.

CREATE OR REPLACE FUNCTION public.place_b2b_order(
    p_company_id UUID,
    p_shipping_address TEXT,
    p_note TEXT,
    p_total_amount NUMERIC(15,2),
    p_items JSONB,
    p_bypass_prepayment BOOLEAN DEFAULT FALSE,
    p_bypass_risk_limit BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_new_balance NUMERIC(15,2);
    v_item JSONB;
    v_is_locked BOOLEAN;
    v_current_balance NUMERIC(15,2);
    v_risk_limit NUMERIC(15,2);
    v_user_id UUID := auth.uid();
    v_user_role TEXT := auth.role();
    v_is_privileged BOOLEAN := FALSE;
BEGIN
    -- 1. YETKİ KONTROLÜ
    IF v_user_role = 'service_role' THEN
        v_is_privileged := TRUE;
    ELSE
        -- Admin veya Müşteri Temsilcisi mi?
        SELECT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = v_user_id AND is_admin = true
        ) OR EXISTS (
            SELECT 1 FROM public.customer_representatives
            WHERE id = v_user_id AND is_active = true
        ) INTO v_is_privileged;

        -- Eğer yetkisizse sadece kendi firmasına sipariş verebilir
        IF NOT v_is_privileged THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE id = v_user_id AND company_id = p_company_id
            ) THEN
                RAISE EXCEPTION 'Unauthorized company order';
            END IF;
            -- Yetkisiz kullanıcı bypass parametrelerini kullanamaz
            p_bypass_prepayment := FALSE;
            p_bypass_risk_limit := FALSE;
        END IF;
    END IF;

    -- 2. BAKİYE VE LİMİT BİLGİLERİNİ ÇEK
    SELECT is_prepayment_locked, COALESCE(current_balance, 0), COALESCE(risk_limit, 0) 
    INTO v_is_locked, v_current_balance, v_risk_limit 
    FROM public.companies WHERE id = p_company_id;
    
    -- 3. KONTROL MEKANİZMASI
    IF v_is_locked IS TRUE AND NOT p_bypass_prepayment THEN
        -- Ön ödemeli (kilitli) hesap: Bakiyesi yetmeli (Bypass edilmediyse)
        IF v_current_balance < p_total_amount THEN
            RAISE EXCEPTION 'Yetersiz Bakiye: Ön ödemeli hesaplarda bakiye sipariş tutarını karşılamalıdır.';
        END IF;
    ELSIF NOT p_bypass_risk_limit THEN
        -- Standart hesap: Risk Limiti Kontrolü (Bypass edilmediyse)
        -- ÖNEMLİ: Eğer v_risk_limit 0 ise, bu kontrol tamamen atlanır (SINIRSIZ BORÇ)
        IF v_risk_limit > 0 THEN
            IF (v_current_balance - p_total_amount) < -v_risk_limit THEN
                RAISE EXCEPTION 'Risk Limiti Aşıldı: Sipariş tutarı tanımlı risk limitinizi aşmaktadır.';
            END IF;
        END IF;
    END IF;

    -- 4. SİPARİŞ OLUŞTURMA
    INSERT INTO public.orders (company_id, shipping_address, note, total_amount, status, created_at)
    VALUES (p_company_id, p_shipping_address, p_note, p_total_amount, 'pending', NOW())
    RETURNING id INTO v_order_id;

    -- 5. SİPARİŞ KALEMLERİNİ EKLEME
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
        VALUES (
            v_order_id, 
            (v_item->>'product_id')::UUID, 
            (v_item->>'quantity')::INT,
            (v_item->>'unit_price')::NUMERIC(15,2), 
            (v_item->>'total_price')::NUMERIC(15,2)
        );
    END LOOP;

    -- 6. BAKİYE DÜŞME VE HAREKET KAYDI
    UPDATE public.companies SET current_balance = COALESCE(current_balance, 0) - p_total_amount
    WHERE id = p_company_id RETURNING current_balance INTO v_new_balance;

    INSERT INTO public.account_transactions (company_id, transaction_type, document_no, description, debt, credit, balance_after) 
    VALUES (p_company_id, 'TOPTAN SATIŞ', v_order_id::text, 'Sipariş Tutarı', p_total_amount, 0, v_new_balance);

    RETURN jsonb_build_object(
        'success', true, 
        'order_id', v_order_id, 
        'new_balance', v_new_balance
    );
END;
$$;
-- 1. Enable Row Level Security (RLS) on all exposed tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent "already exists" errors
DO $$
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
    DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    
    -- Companies
    DROP POLICY IF EXISTS "Users can read their own company" ON companies;
    DROP POLICY IF EXISTS "Admins can read all companies" ON companies;
    
    -- Products
    DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
    DROP POLICY IF EXISTS "Admins can manage products" ON products;
    
    -- Invoices
    DROP POLICY IF EXISTS "Users can view own company invoices" ON invoices;
    DROP POLICY IF EXISTS "Admins can manage all invoices" ON invoices;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;


-- 3. PROFILES Table Policies
-- Breaking infinite recursion: Admins checking themselves without triggering policy again
CREATE POLICY "Users can read own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

-- For profiles table specifically, we cannot do a sub-select on profiles without infinite loop.
-- The most common fix is to use JWT claims, but since we rely on `is_admin` column:
-- We create a SECURITY DEFINER function to bypass RLS when checking admin status.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can read all profiles" ON profiles 
    FOR SELECT USING (public.is_admin_user());

CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);


-- 4. COMPANIES Table Policies
CREATE POLICY "Users can read their own company" ON companies 
    FOR SELECT USING (id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    
CREATE POLICY "Admins can read all companies" ON companies 
    FOR ALL USING (public.is_admin_user());


-- 5. PRODUCTS Table Policies
CREATE POLICY "Authenticated users can view products" ON products 
    FOR SELECT USING (auth.role() = 'authenticated');
    
CREATE POLICY "Admins can manage products" ON products 
    FOR ALL USING (public.is_admin_user());


-- 6. INVOICES Table Policies
CREATE POLICY "Users can view own company invoices" ON invoices 
    FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    
CREATE POLICY "Admins can manage all invoices" ON invoices 
    FOR ALL USING (public.is_admin_user());
