-- ============================================================
-- SCHEMA COMPLET UNIFIÉ — HaziOne SaaS
--
-- Fichier unique consolidant l'intégralité du modèle de données :
--   - Tables métier (companies, clients, produits, factures, devis, etc.)
--   - Tables paiement (payments, payment_methods, payment_transactions)
--   - Tables abonnement (subscriptions, licenses, license_users)
--   - Tables admin (profiles, admin_logs)
--   - Boutique en ligne (shops, shop_orders, shop_order_items)
--   - Bons de livraison (delivery_notes)
--   - Vues, index, fonctions, triggers, RLS policies, storage buckets
--
-- INSTRUCTIONS :
--   1. Copier ce script dans l'éditeur SQL de Supabase
--   2. Exécuter d'un bloc
--   3. Tous les IDs métier sont TEXT (UUID auto-générés via gen_random_uuid()::text)
--   4. RLS activé sur chaque table
--   5. company_id = auth.uid()::text pour le filtrage par entreprise
--
-- IMPORTANT : Ce fichier remplace tous les anciens fichiers SQL du projet.
-- ============================================================


-- ========== SECTION 1 : NETTOYAGE COMPLET ==========

DROP VIEW IF EXISTS v_product_stock CASCADE;

DROP TABLE IF EXISTS license_users CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS shop_order_items CASCADE;
DROP TABLE IF EXISTS shop_orders CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS email_send_logs CASCADE;
DROP TABLE IF EXISTS reminder_logs CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS supplier_invoices CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_brand_links CASCADE;
DROP TABLE IF EXISTS product_category_links CASCADE;
DROP TABLE IF EXISTS product_brands CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS products_categories CASCADE;
DROP TABLE IF EXISTS products_brand CASCADE;
DROP TABLE IF EXISTS cash_movements CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS delivery_notes CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_recipes;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS brand CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS recovery_codes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

DROP FUNCTION IF EXISTS public.get_my_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.delete_user_account() CASCADE;
DROP FUNCTION IF EXISTS public.update_payments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_payment_transactions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.update_subscriptions_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_is_super_admin() CASCADE;


-- ========== SECTION 2 : TABLES ==========

-- 2.1 companies
CREATE TABLE companies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mon entreprise',
  legal_structure TEXT NOT NULL DEFAULT 'SAS',
  siret TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'France',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  bic TEXT NOT NULL DEFAULT '',
  default_vat_rate NUMERIC NOT NULL DEFAULT 20,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
  invoice_next_number INTEGER NOT NULL DEFAULT 1,
  quote_prefix TEXT NOT NULL DEFAULT 'DEV',
  quote_next_number INTEGER NOT NULL DEFAULT 1,
  credit_note_prefix TEXT NOT NULL DEFAULT 'AV',
  credit_note_next_number INTEGER NOT NULL DEFAULT 1,
  purchase_order_prefix TEXT NOT NULL DEFAULT 'CF',
  purchase_order_next_number INTEGER NOT NULL DEFAULT 1,
  supplier_invoice_prefix TEXT NOT NULL DEFAULT 'FR',
  supplier_invoice_next_number INTEGER NOT NULL DEFAULT 1,
  vat_exempt BOOLEAN NOT NULL DEFAULT false,
  vat_exempt_article TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_days JSONB NOT NULL DEFAULT '[7, 14, 30]',
  late_fee_rate NUMERIC NOT NULL DEFAULT 3.75,
  electronic_invoicing_ready BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'EUR',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 profiles
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  avatar_url TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_unique UNIQUE (email)
);

-- 2.3 categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 2.4 brands
CREATE TABLE brands (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 2.5 clients
CREATE TABLE clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'company',
  company_name TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'France',
  vat_number TEXT,
  siret TEXT,
  notes TEXT NOT NULL DEFAULT '',
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  margin_total NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC,
  discount_category TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.6 suppliers
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'France',
  vat_number TEXT,
  siret TEXT,
  notes TEXT NOT NULL DEFAULT '',
  payment_conditions TEXT NOT NULL DEFAULT '',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.7 products
CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  category_name TEXT,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  brand TEXT,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 20,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'unité',
  type TEXT NOT NULL DEFAULT 'product',
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  used_in_validated_invoice BOOLEAN NOT NULL DEFAULT false,
  published_on_shop BOOLEAN DEFAULT false,
  shop_sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 product_variants
CREATE TABLE product_variants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attributes JSONB NOT NULL DEFAULT '{}',
  sku TEXT,
  purchase_price NUMERIC(10,2) DEFAULT 0,
  sale_price NUMERIC(10,2),
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.9 invoices
CREATE TABLE invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id TEXT,
  quote_id TEXT,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  invoice_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  total_ht NUMERIC NOT NULL DEFAULT 0,
  total_tva NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_terms TEXT NOT NULL DEFAULT '',
  legal_mentions TEXT NOT NULL DEFAULT '',
  is_validated BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMPTZ,
  electronic_ready BOOLEAN NOT NULL DEFAULT false,
  xml_structure TEXT,
  credit_note_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.10 quotes
CREATE TABLE quotes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  quote_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]',
  total_ht NUMERIC NOT NULL DEFAULT 0,
  total_tva NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT,
  converted_to_invoice_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.11 sales
CREATE TABLE sales (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_number TEXT NOT NULL DEFAULT '',
  client_id TEXT,
  client_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_ht NUMERIC NOT NULL DEFAULT 0,
  total_tva NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'paid',
  refunded_at TIMESTAMPTZ,
  refunded_sale_id TEXT,
  converted_to_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.12 cash_movements
CREATE TABLE cash_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'income',
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoice_id TEXT,
  expense_id TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  source_type TEXT,
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.13 purchase_orders
CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_date TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  quantity_received_data JSONB DEFAULT '{}',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.14 supplier_invoices
CREATE TABLE supplier_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  supplier_invoice_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.15 stock_movements
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'in',
  quantity INTEGER NOT NULL DEFAULT 0,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.16 audit_logs
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  entity_label TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.17 reminder_logs
CREATE TABLE reminder_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  level INTEGER NOT NULL DEFAULT 1,
  method TEXT NOT NULL DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.18 email_send_logs
CREATE TABLE email_send_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_number TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.19 shops
CREATE TABLE shops (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#2563EB',
  contact_phone TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_address TEXT DEFAULT '',
  welcome_message TEXT DEFAULT '',
  delivery_pickup BOOLEAN DEFAULT false,
  delivery_shipping BOOLEAN DEFAULT false,
  shipping_price NUMERIC(10,2) DEFAULT 0,
  payment_in_store BOOLEAN DEFAULT false,
  payment_bank_transfer BOOLEAN DEFAULT false,
  bank_details TEXT DEFAULT '',
  payment_on_delivery BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.20 shop_orders
CREATE TABLE shop_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shop_id TEXT REFERENCES shops(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'nouvelle',
  customer_first_name TEXT NOT NULL DEFAULT '',
  customer_last_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  delivery_mode TEXT DEFAULT 'pickup',
  payment_method TEXT DEFAULT '',
  subtotal_ht NUMERIC(10,2) DEFAULT 0,
  tva_amount NUMERIC(10,2) DEFAULT 0,
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  total_ttc NUMERIC(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.21 shop_order_items
CREATE TABLE shop_order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_info JSONB DEFAULT '{}',
  product_name TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  total_price NUMERIC(10,2) DEFAULT 0
);

-- 2.22 payments (Stripe + CinetPay unified)
CREATE TABLE payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT NOT NULL DEFAULT 'cinetpay',
  provider_transaction_id TEXT,
  provider_payment_url TEXT,
  provider_client_secret TEXT,
  payment_method_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.23 payment_methods
CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  type TEXT NOT NULL DEFAULT 'card',
  last_four TEXT,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.24 payment_transactions (legacy CinetPay)
CREATE TABLE payment_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  sale_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  payment_method TEXT NOT NULL DEFAULT 'other',
  cinetpay_payment_id TEXT,
  cinetpay_payment_url TEXT,
  cinetpay_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.25 product_recipes
CREATE TABLE product_recipes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_recipes_product ON product_recipes(product_id);
CREATE INDEX idx_product_recipes_company ON product_recipes(company_id);

-- 2.26 delivery_notes
CREATE TABLE delivery_notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL DEFAULT '',
  delivery_number TEXT NOT NULL DEFAULT '',
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'preparation',
  notes TEXT DEFAULT '',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.26 subscriptions
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('solo', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'canceled', 'expired')),
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  license_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)
);

-- 2.27 licenses
CREATE TABLE licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('solo', 'pro', 'business')),
  duration TEXT NOT NULL DEFAULT 'lifetime' CHECK (duration IN ('lifetime', '1year', '1month')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  max_users INTEGER NOT NULL DEFAULT 1,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by_email TEXT,
  used_by_company TEXT,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.28 license_users
CREATE TABLE license_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(license_id, user_id)
);

-- 2.29 admin_logs
CREATE TABLE admin_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ========== SECTION 3 : VUES ==========

CREATE OR REPLACE VIEW v_product_stock AS
SELECT
  product_id,
  SUM(
    CASE
      WHEN type IN ('purchase_in', 'in', 'adjustment', 'inventory_correction', 'retour') THEN ABS(quantity)
      WHEN type IN ('sale_out', 'out') THEN -ABS(quantity)
      ELSE quantity
    END
  ) AS calculated_stock
FROM stock_movements
GROUP BY product_id;


-- ========== SECTION 4 : INDEX ==========

CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_categories_company_id ON categories(company_id);
CREATE INDEX idx_brands_company_id ON brands(company_id);
CREATE INDEX idx_clients_company_id ON clients(company_id);
CREATE INDEX idx_clients_is_deleted ON clients(is_deleted);
CREATE INDEX idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX idx_suppliers_is_deleted ON suppliers(is_deleted);
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_is_archived ON products(is_archived);
CREATE INDEX idx_products_category_name ON products(category_name);
CREATE INDEX idx_products_published_on_shop ON products(published_on_shop);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_company ON product_variants(company_id);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_quotes_company_id ON quotes(company_id);
CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_sales_company_id ON sales(company_id);
CREATE INDEX idx_cash_movements_company_id ON cash_movements(company_id);
CREATE INDEX idx_purchase_orders_company_id ON purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_supplier_invoices_company_id ON supplier_invoices(company_id);
CREATE INDEX idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_reminder_logs_company_id ON reminder_logs(company_id);
CREATE INDEX idx_reminder_logs_invoice_id ON reminder_logs(invoice_id);
CREATE INDEX idx_email_send_logs_company_id ON email_send_logs(company_id);
CREATE INDEX idx_email_send_logs_document ON email_send_logs(document_id);
CREATE INDEX idx_shops_company_id ON shops(company_id);
CREATE UNIQUE INDEX idx_shops_slug ON shops(slug);
CREATE INDEX idx_shop_orders_company_id ON shop_orders(company_id);
CREATE INDEX idx_shop_orders_status ON shop_orders(status);
CREATE INDEX idx_shop_orders_shop_id ON shop_orders(shop_id);
CREATE INDEX idx_shop_order_items_order_id ON shop_order_items(order_id);
CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider);
CREATE INDEX idx_payments_provider_txn ON payments(provider_transaction_id);
CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX idx_payment_transactions_company ON payment_transactions(company_id);
CREATE INDEX idx_payment_transactions_sale ON payment_transactions(sale_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_cinetpay_id ON payment_transactions(cinetpay_payment_id);
CREATE INDEX idx_delivery_notes_company_id ON delivery_notes(company_id);
CREATE INDEX idx_delivery_notes_invoice_id ON delivery_notes(invoice_id);
CREATE INDEX idx_delivery_notes_status ON delivery_notes(status);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_licenses_code ON licenses(code);
CREATE INDEX idx_licenses_used_by ON licenses(used_by);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_license_users_license ON license_users(license_id);
CREATE INDEX idx_license_users_user ON license_users(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_super_admin ON profiles(is_super_admin);
CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_timestamp ON admin_logs(timestamp);


-- ========== SECTION 5 : FONCTIONS ==========

-- 5.1 Helper : récupérer le company_id de l'utilisateur courant
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.companies WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- 5.2 Vérification super admin (SECURITY DEFINER pour bypass RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = check_user_id LIMIT 1),
    false
  );
$$;

-- 5.3 RPC publique pour vérifier le statut super admin (appelée par l'app)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()::text LIMIT 1),
    false
  );
$$;

-- 5.4 Trigger : création automatique company + profile à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  new_company_id TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Mon entreprise'
  );
  new_company_id := NEW.id::text;

  INSERT INTO public.companies (id, owner_id, name, email)
  VALUES (new_company_id, NEW.id, 'Entreprise de ' || user_name, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO UPDATE SET owner_id = NEW.id;

  INSERT INTO public.profiles (id, full_name, email, is_super_admin, is_active, created_at, updated_at)
  VALUES (
    new_company_id,
    user_name,
    COALESCE(NEW.email, ''),
    false,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NEW.email, ''),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5.5 Suppression de compte
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.profiles WHERE id = current_user_id::text;
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 5.6 Trigger : auto-update updated_at sur payments
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payments_updated_at();

CREATE TRIGGER trigger_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payments_updated_at();

-- 5.7 Trigger : auto-update updated_at sur subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- 5.8 Trigger : nettoyage license_users quand un utilisateur est supprimé
CREATE OR REPLACE FUNCTION public.cleanup_license_users_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.license_users WHERE user_id = OLD.id;
  UPDATE public.licenses SET used_by = NULL, used_by_email = NULL, used_by_company = NULL, activated_at = NULL, status = 'active'
    WHERE used_by = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted_cleanup_licenses ON auth.users;
CREATE TRIGGER on_auth_user_deleted_cleanup_licenses
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_license_users_on_delete();


-- ========== SECTION 6 : ROW LEVEL SECURITY ==========

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;


-- ========== SECTION 7 : POLICIES ==========

-- companies
CREATE POLICY "company_select" ON companies FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "company_insert" ON companies FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "company_update" ON companies FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- profiles (utilise is_super_admin() SECURITY DEFINER pour éviter la récursion RLS)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid()::text OR public.is_super_admin(auth.uid()::text)
);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid()::text);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  id = auth.uid()::text OR public.is_super_admin(auth.uid()::text)
);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (
  public.is_super_admin(auth.uid()::text)
);

-- categories
CREATE POLICY "categories_select" ON categories FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (company_id = auth.uid()::text);

-- brands
CREATE POLICY "brands_select" ON brands FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "brands_insert" ON brands FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "brands_update" ON brands FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "brands_delete" ON brands FOR DELETE USING (company_id = auth.uid()::text);

-- clients
CREATE POLICY "clients_select" ON clients FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (company_id = auth.uid()::text);

-- suppliers
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (company_id = auth.uid()::text);

-- products
CREATE POLICY "products_select" ON products FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "products_update" ON products FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "products_delete" ON products FOR DELETE USING (company_id = auth.uid()::text);
CREATE POLICY "products_public_shop_read" ON products FOR SELECT USING (published_on_shop = true AND is_active = true AND is_archived = false);

-- product_variants
CREATE POLICY "product_variants_select" ON product_variants FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "product_variants_insert" ON product_variants FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "product_variants_update" ON product_variants FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "product_variants_delete" ON product_variants FOR DELETE USING (company_id = auth.uid()::text);
CREATE POLICY "variants_public_shop_read" ON product_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM products WHERE products.id = product_variants.product_id AND products.published_on_shop = true AND products.is_active = true AND products.is_archived = false)
);

-- invoices
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (company_id = auth.uid()::text);

-- quotes
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "quotes_update" ON quotes FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "quotes_delete" ON quotes FOR DELETE USING (company_id = auth.uid()::text);

-- sales
CREATE POLICY "sales_select" ON sales FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "sales_delete" ON sales FOR DELETE USING (company_id = auth.uid()::text);

-- cash_movements
CREATE POLICY "cash_movements_select" ON cash_movements FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "cash_movements_insert" ON cash_movements FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "cash_movements_update" ON cash_movements FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "cash_movements_delete" ON cash_movements FOR DELETE USING (company_id = auth.uid()::text);

-- purchase_orders
CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE USING (company_id = auth.uid()::text);

-- supplier_invoices
CREATE POLICY "supplier_invoices_select" ON supplier_invoices FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "supplier_invoices_insert" ON supplier_invoices FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "supplier_invoices_update" ON supplier_invoices FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "supplier_invoices_delete" ON supplier_invoices FOR DELETE USING (company_id = auth.uid()::text);

-- stock_movements
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "stock_movements_update" ON stock_movements FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "stock_movements_delete" ON stock_movements FOR DELETE USING (company_id = auth.uid()::text);

-- audit_logs
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (company_id = auth.uid()::text);

-- reminder_logs
CREATE POLICY "reminder_logs_select" ON reminder_logs FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "reminder_logs_insert" ON reminder_logs FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "reminder_logs_update" ON reminder_logs FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "reminder_logs_delete" ON reminder_logs FOR DELETE USING (company_id = auth.uid()::text);

-- email_send_logs
CREATE POLICY "email_send_logs_select" ON email_send_logs FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "email_send_logs_insert" ON email_send_logs FOR INSERT WITH CHECK (company_id = auth.uid()::text);

-- shops
CREATE POLICY "shops_owner_all" ON shops FOR ALL USING (company_id = auth.uid()::text);
CREATE POLICY "shops_public_read" ON shops FOR SELECT USING (is_active = true);

-- shop_orders
CREATE POLICY "shop_orders_public_insert" ON shop_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "shop_orders_owner_all" ON shop_orders FOR ALL USING (company_id = auth.uid()::text);

-- shop_order_items
CREATE POLICY "shop_order_items_public_insert" ON shop_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "shop_order_items_owner_read" ON shop_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.id = shop_order_items.order_id AND shop_orders.company_id = auth.uid()::text)
);
CREATE POLICY "shop_order_items_public_read" ON shop_order_items FOR SELECT USING (true);

-- payments
CREATE POLICY "payments_select" ON payments FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "payments_update" ON payments FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);

-- payment_methods
CREATE POLICY "payment_methods_select" ON payment_methods FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "payment_methods_insert" ON payment_methods FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "payment_methods_update" ON payment_methods FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "payment_methods_delete" ON payment_methods FOR DELETE USING (user_id = auth.uid()::text);

-- payment_transactions
CREATE POLICY "payment_transactions_select" ON payment_transactions FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "payment_transactions_insert" ON payment_transactions FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "payment_transactions_update" ON payment_transactions FOR UPDATE USING (company_id = auth.uid()::text);

-- delivery_notes
CREATE POLICY "delivery_notes_select" ON delivery_notes FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "delivery_notes_insert" ON delivery_notes FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "delivery_notes_update" ON delivery_notes FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "delivery_notes_delete" ON delivery_notes FOR DELETE USING (company_id = auth.uid()::text);

-- product_recipes
CREATE POLICY "product_recipes_select" ON product_recipes FOR SELECT USING (company_id = auth.uid()::text);
CREATE POLICY "product_recipes_insert" ON product_recipes FOR INSERT WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "product_recipes_update" ON product_recipes FOR UPDATE USING (company_id = auth.uid()::text) WITH CHECK (company_id = auth.uid()::text);
CREATE POLICY "product_recipes_delete" ON product_recipes FOR DELETE USING (company_id = auth.uid()::text);

-- subscriptions
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- licenses (super admin peut tout faire, les utilisateurs peuvent lire et claim)
CREATE POLICY "licenses_select" ON licenses FOR SELECT USING (true);
CREATE POLICY "licenses_update_claim" ON licenses FOR UPDATE
  USING (used_by IS NULL OR used_by = auth.uid())
  WITH CHECK (used_by = auth.uid());
CREATE POLICY "licenses_insert_admin" ON licenses FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()::text));
CREATE POLICY "licenses_delete_admin" ON licenses FOR DELETE
  USING (public.is_super_admin(auth.uid()::text));

-- license_users
CREATE POLICY "license_users_select" ON license_users FOR SELECT USING (
  user_id = auth.uid() OR public.is_super_admin(auth.uid()::text)
);
CREATE POLICY "license_users_insert" ON license_users FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid()::text)
);
CREATE POLICY "license_users_delete" ON license_users FOR DELETE USING (
  public.is_super_admin(auth.uid()::text)
);

-- admin_logs
CREATE POLICY "admin_logs_select" ON admin_logs FOR SELECT USING (
  public.is_super_admin(auth.uid()::text)
);
CREATE POLICY "admin_logs_insert" ON admin_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ========== SECTION 8 : PERMISSIONS ==========

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON product_variants TO anon;
GRANT SELECT ON shops TO anon;
GRANT INSERT ON shop_orders TO anon;
GRANT INSERT ON shop_order_items TO anon;
GRANT SELECT ON shop_orders TO anon;
GRANT SELECT ON shop_order_items TO anon;


-- ========== SECTION 9 : STORAGE BUCKETS ==========

INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-invoices', 'purchase-invoices', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads to purchase-invoices" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to purchase-invoices" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-invoices');

DROP POLICY IF EXISTS "Allow public read from purchase-invoices" ON storage.objects;
CREATE POLICY "Allow public read from purchase-invoices" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'purchase-invoices');

DROP POLICY IF EXISTS "Allow authenticated updates to purchase-invoices" ON storage.objects;
CREATE POLICY "Allow authenticated updates to purchase-invoices" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-invoices');

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads to shop-assets" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to shop-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Allow public read from shop-assets" ON storage.objects;
CREATE POLICY "Allow public read from shop-assets" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'shop-assets');

DROP POLICY IF EXISTS "Allow authenticated updates to shop-assets" ON storage.objects;
CREATE POLICY "Allow authenticated updates to shop-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-assets');


-- ========== SECTION 10 : REALTIME ==========

ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions;


-- ========== SECTION 11 : BACKFILL & SEED ==========

-- Créer les profils pour les users existants qui n'en ont pas encore
INSERT INTO profiles (id, full_name, email, is_super_admin, is_active, created_at, updated_at)
SELECT
  u.id::text,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Utilisateur'),
  COALESCE(u.email, ''),
  false,
  true,
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id::text
);

-- Marquer admin@hazione.com comme super admin
UPDATE profiles
SET is_super_admin = true, updated_at = now()
WHERE email = 'admin@hazione.com';


-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
