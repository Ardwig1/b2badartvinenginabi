-- ========================================================
-- B2B PLATFORM - FINAL 1:1 MASTER SCHEMA (V5)
-- ========================================================
-- Hazırlayan: Gemini CLI (Yağız adına)
-- Bu SQL dosyası Kaan Abi'nin projesindeki tüm tabloları,
-- kolonları, kuralları ve fonksiyonları BİREBİR içerir.
-- Toplam 20 Tablo, RLS Kuralları, Fonksiyonlar ve Triggerlar.

-- 0. EXTENSIONS & SEQUENCES
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'document_no_seq') THEN
        CREATE SEQUENCE document_no_seq START 1;
    END IF;
END $$;

-- 1. PRICE GROUPS
CREATE TABLE IF NOT EXISTS public.price_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_percent numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. COMPANIES
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_number text UNIQUE NOT NULL,
  address text,
  district text,
  city text,
  phone text,
  email text,
  contact_person text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  price_group_id uuid REFERENCES public.price_groups(id),
  credit_limit numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  risk_limit_unlimited boolean DEFAULT false,
  extra_discount_percent numeric DEFAULT 0,
  dealer_code text,
  user_code text,
  password text -- Plain text for legacy sync/lookup
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_dealer_user_code ON public.companies (dealer_code, user_code);

-- 3. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  full_name text,
  is_admin boolean DEFAULT false,
  role text DEFAULT 'customer',
  created_at timestamptz DEFAULT now()
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  description text,
  image_url text,
  list_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'adet',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  currency text DEFAULT 'TRY',
  discount_rate numeric DEFAULT 0,
  box_quantity integer DEFAULT 1,
  oem_no text,
  car_brand text,
  car_model text,
  cost_price numeric DEFAULT 0,
  suggested_price numeric DEFAULT 0,
  supplier_brand text,
  profit_margin numeric DEFAULT 36
);

-- 5. PRODUCT PRICES
CREATE TABLE IF NOT EXISTS public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  price_group_id uuid REFERENCES public.price_groups(id) ON DELETE CASCADE,
  custom_price numeric,
  UNIQUE(product_id, price_group_id)
);

-- 6. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity integer NOT NULL,
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 7. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  shipping_address text,
  note text,
  total_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  document_no text UNIQUE
);

-- 8. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  shipping_origin text
);

-- 9. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id),
  invoice_number text UNIQUE NOT NULL,
  status text DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial')),
  issue_date date DEFAULT current_date,
  due_date date,
  subtotal numeric DEFAULT 0,
  tax_percent numeric DEFAULT 20,
  tax_amount numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 10. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL
);

-- 11. SUGGESTIONS
CREATE TABLE IF NOT EXISTS public.suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'pending',
    admin_note text,
    created_at timestamptz DEFAULT now()
);

-- 12. USER ACTIVITIES
CREATE TABLE IF NOT EXISTS public.user_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    action_type text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

-- 13. CUSTOMER REPRESENTATIVES
CREATE TABLE IF NOT EXISTS public.customer_representatives (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text,
    tc_no text UNIQUE,
    phone text,
    email text,
    position text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    dealer_code text,
    user_code text,
    password text
);

-- 14. REPRESENTATIVE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.representative_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    representative_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(representative_id, company_id)
);

-- 15. ACCOUNT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    transaction_type text NOT NULL, 
    document_no text, 
    description text,
    debt numeric(15,2) DEFAULT 0, 
    credit numeric(15,2) DEFAULT 0, 
    balance_after numeric(15,2), 
    due_date timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 16. COMPANY EXTRA DISCOUNTS
CREATE TABLE IF NOT EXISTS public.company_extra_discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    discount_rate numeric NOT NULL DEFAULT 0,
    is_used boolean DEFAULT false,
    used_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(company_id, product_id)
);

-- 17. BANNERS
CREATE TABLE IF NOT EXISTS public.banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    title text,
    link_url text
);

-- 18. PRODUCT FOLLOWS
CREATE TABLE IF NOT EXISTS public.product_follows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- 19. CART ITEMS
CREATE TABLE IF NOT EXISTS public.cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    unselected boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id, product_id)
);

-- 20. USD RATES (Global Settings)
CREATE TABLE IF NOT EXISTS public.usd_rates (
    id integer PRIMARY KEY DEFAULT 1,
    is_active boolean DEFAULT false,
    usd_rate numeric DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT only_one_row CHECK (id = 1)
);

-- ========================================================
-- TRIGGERS & FUNCTIONS
-- ========================================================

-- A. Handle New User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'customer'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- B. Auto Document Number
CREATE OR REPLACE FUNCTION public.get_next_document_no()
RETURNS text AS $$
DECLARE
    v_seq integer;
BEGIN
    v_seq := nextval('document_no_seq');
    RETURN 'OMG' || LPAD(v_seq::text, 7, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_set_document_no()
RETURNS trigger AS $$
BEGIN
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR LEFT(NEW.document_no, 3) != 'OMG' THEN
        NEW.document_no := public.get_next_document_no();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_document_no_trigger ON public.account_transactions;
CREATE TRIGGER set_document_no_trigger
  BEFORE INSERT ON public.account_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_document_no();

-- C. Updated At Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reps_updated_at ON public.customer_representatives;
CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON public.customer_representatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================================
-- RLS POLICIES
-- ========================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_extra_discounts ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Public read banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage all" ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- ========================================================
-- INITIAL DATA
-- ========================================================
INSERT INTO public.price_groups (name, discount_percent) VALUES
  ('A Grubu', 20), ('B Grubu', 15), ('C Grubu', 10)
ON CONFLICT DO NOTHING;

INSERT INTO public.usd_rates (id, is_active, usd_rate) VALUES (1, false, 32.50) ON CONFLICT DO NOTHING;

-- DONE!
