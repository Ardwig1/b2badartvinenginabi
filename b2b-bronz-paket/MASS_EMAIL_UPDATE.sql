-- =============================================
-- MASS EMAIL UPDATE: bayikodu@bayikodu.com
-- =============================================
-- Bu SQL, sistemdeki tüm mevcut firmaların ve bunlara bağlı 
-- kullanıcıların mail adreslerini bayikodu@bayikodu.com yapar.

-- 1. Companies Tablosunu Güncelle
UPDATE public.companies 
SET email = LOWER(dealer_code) || '@' || LOWER(dealer_code) || '.com'
WHERE dealer_code IS NOT NULL;

-- 2. Auth.Users (Giriş) Tablosunu Güncelle
-- Profiller üzerinden şirketle bağlantı kurarak login maillerini değiştiriyoruz.
UPDATE auth.users 
SET email = LOWER(c.dealer_code) || '@' || LOWER(c.dealer_code) || '.com'
FROM public.profiles p
JOIN public.companies c ON p.company_id = c.id
WHERE auth.users.id = p.id
AND c.dealer_code IS NOT NULL;

-- 3. Identifiers Tablosunu Güncelle (Supabase dahili mail tablosu)
UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(LOWER(c.dealer_code) || '@' || LOWER(c.dealer_code) || '.com'))
FROM public.profiles p
JOIN public.companies c ON p.company_id = c.id
WHERE auth.identities.user_id = p.id
AND c.dealer_code IS NOT NULL;
