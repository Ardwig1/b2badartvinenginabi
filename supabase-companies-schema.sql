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
