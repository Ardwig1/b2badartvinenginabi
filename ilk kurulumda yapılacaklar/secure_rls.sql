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
