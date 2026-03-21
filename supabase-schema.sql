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
