-- ========================================================
-- LIVE DUMP FROM KAAN ABI'S DATABASE (1:1 EXACT)
-- Generated on: 12.05.2026 01:52:31
-- ========================================================

-- TABLE: banners
CREATE TABLE IF NOT EXISTS public."banners" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    "image_url" text NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "display_order" bigint DEFAULT 0
);

-- TABLE: product_prices
CREATE TABLE IF NOT EXISTS public."product_prices" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid,
    "price_group_id" uuid,
    "custom_price" numeric
);

-- TABLE: orders
CREATE TABLE IF NOT EXISTS public."orders" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid,
    "status" text DEFAULT 'pending',
    "shipping_address" text,
    "note" text,
    "total_amount" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "shipping_company" text,
    "tracking_number" text,
    "shipping_origin" text,
    "is_stock_reduced" boolean DEFAULT false
);

-- TABLE: user_activities
CREATE TABLE IF NOT EXISTS public."user_activities" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid,
    "action_type" text NOT NULL,
    "details" jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

-- TABLE: companies
CREATE TABLE IF NOT EXISTS public."companies" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "tax_number" text NOT NULL,
    "address" text,
    "phone" text,
    "email" text,
    "contact_person" text,
    "status" text DEFAULT 'pending',
    "price_group_id" uuid,
    "credit_limit" numeric DEFAULT 0,
    "current_balance" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "tax_office" text,
    "city" text,
    "district" text,
    "branch" text,
    "dealer_code" text,
    "user_code" text,
    "is_prepayment_locked" boolean DEFAULT false,
    "risk_limit" numeric DEFAULT 0
);

-- TABLE: profiles
CREATE TABLE IF NOT EXISTS public."profiles" (
    "id" uuid NOT NULL,
    "company_id" uuid,
    "full_name" text,
    "is_admin" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now()
);

-- TABLE: invoice_items
CREATE TABLE IF NOT EXISTS public."invoice_items" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "invoice_id" uuid,
    "product_id" uuid,
    "description" text,
    "quantity" bigint NOT NULL,
    "unit_price" numeric NOT NULL,
    "total_price" numeric NOT NULL
);

-- TABLE: customer_representatives
CREATE TABLE IF NOT EXISTS public."customer_representatives" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "first_name" text NOT NULL,
    "last_name" text NOT NULL,
    "tc_no" text,
    "phone" text,
    "email" text,
    "position" text,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "dealer_code" text,
    "user_code" text,
    "password" text
);

-- TABLE: products
CREATE TABLE IF NOT EXISTS public."products" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "brand" text,
    "category" text,
    "description" text,
    "image_url" text,
    "list_price" numeric DEFAULT 0 NOT NULL,
    "stock_quantity" bigint DEFAULT 0 NOT NULL,
    "unit" text DEFAULT 'adet',
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "product_number" text,
    "stock_merkez" bigint DEFAULT 0,
    "stock_depo" bigint DEFAULT 0,
    "currency" text DEFAULT 'TRY',
    "discount_rate" numeric DEFAULT 0,
    "box_quantity" bigint DEFAULT 1,
    "oem_no" text,
    "car_brand" text,
    "car_model" text,
    "cost_price" numeric DEFAULT 0,
    "profit_margin" numeric DEFAULT 0,
    "is_campaign" boolean DEFAULT false,
    "supplier_brand" text,
    "is_fixed_price" boolean DEFAULT false,
    "cart_discount_rate" numeric DEFAULT 0,
    "fixed_price_value" numeric DEFAULT 0,
    "fixed_price_currency" character varying DEFAULT 'TRY',
    "fixed_usd_rate" numeric
);

-- TABLE: representative_assignments
CREATE TABLE IF NOT EXISTS public."representative_assignments" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "representative_id" uuid,
    "company_id" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

-- TABLE: product_follows
CREATE TABLE IF NOT EXISTS public."product_follows" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid,
    "product_id" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

-- TABLE: account_transactions
CREATE TABLE IF NOT EXISTS public."account_transactions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "company_id" uuid NOT NULL,
    "transaction_type" text,
    "document_no" text,
    "description" text,
    "debt" numeric,
    "credit" numeric,
    "balance_after" numeric,
    "due_date" timestamp with time zone,
    "order_id" uuid
);

-- TABLE: invoices
CREATE TABLE IF NOT EXISTS public."invoices" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid,
    "order_id" uuid,
    "invoice_number" text NOT NULL,
    "status" text DEFAULT 'unpaid',
    "issue_date" date DEFAULT 'CURRENT_DATE',
    "due_date" date,
    "subtotal" numeric DEFAULT 0,
    "tax_percent" numeric DEFAULT 18,
    "tax_amount" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0,
    "paid_amount" numeric DEFAULT 0,
    "note" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "oem_nos" text
);

-- TABLE: order_items
CREATE TABLE IF NOT EXISTS public."order_items" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid,
    "product_id" uuid,
    "quantity" bigint NOT NULL,
    "unit_price" numeric NOT NULL,
    "total_price" numeric NOT NULL,
    "shipping_company" text,
    "tracking_number" text,
    "shipping_origin" text
);

-- TABLE: cart_items
CREATE TABLE IF NOT EXISTS public."cart_items" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL,
    "product_id" uuid NOT NULL,
    "quantity" bigint DEFAULT 1 NOT NULL,
    "unselected" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- TABLE: company_extra_discounts
CREATE TABLE IF NOT EXISTS public."company_extra_discounts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid,
    "product_id" uuid,
    "discount_rate" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "is_used" boolean DEFAULT false,
    "used_at" timestamp with time zone
);

-- TABLE: stock_movements
CREATE TABLE IF NOT EXISTS public."stock_movements" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid,
    "type" text NOT NULL,
    "quantity" bigint NOT NULL,
    "note" text,
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

-- TABLE: price_groups
CREATE TABLE IF NOT EXISTS public."price_groups" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "discount_percent" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "rules" jsonb
);

-- TABLE: suggestions
CREATE TABLE IF NOT EXISTS public."suggestions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid,
    "user_id" uuid,
    "subject" text NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);

