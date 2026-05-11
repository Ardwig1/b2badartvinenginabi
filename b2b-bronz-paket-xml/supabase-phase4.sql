-- Phase 4: Add Merkez and Depo stock fields
-- Please run this script in your Supabase SQL Editor

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS stock_merkez integer not null default 0,
  ADD COLUMN IF NOT EXISTS stock_depo integer not null default 0;

-- Optional test update to migrate existing stock to Merkez:
UPDATE products SET stock_merkez = stock_quantity WHERE stock_merkez = 0;
