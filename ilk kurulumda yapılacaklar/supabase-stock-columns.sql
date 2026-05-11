-- SQL Script: Add new stock columns to products table
-- Please run this script in your Supabase SQL Editor

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_merkez INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_depo INTEGER DEFAULT 0;

-- Optional: If you want to move all existing generic stock into the Merkez bin
UPDATE public.products SET stock_merkez = stock_quantity WHERE stock_merkez = 0 AND stock_quantity > 0;
