-- Customer Representatives tablosuna giriş bilgilerini ekle
ALTER TABLE public.customer_representatives ADD COLUMN IF NOT EXISTS dealer_code TEXT UNIQUE;
ALTER TABLE public.customer_representatives ADD COLUMN IF NOT EXISTS user_code TEXT;
ALTER TABLE public.customer_representatives ADD COLUMN IF NOT EXISTS password TEXT;

-- Mükerrer girişi önlemek için temsilci bazlı benzersizlik (Opsiyonel)
-- ALTER TABLE public.customer_representatives ADD CONSTRAINT rep_login_unique UNIQUE(dealer_code, user_code);
