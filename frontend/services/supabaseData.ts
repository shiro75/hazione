import { supabase, isSupabaseConfigured } from './supabase';
import 'react-native-get-random-values';
import type {
  Company, Client, Product, ProductVariant, Invoice, Quote, Sale, CashMovement, AuditLog,
  OrderItem, QuoteItem, SaleItem, VATRate, AuditActionType, AuditEntityType,
  SalePaymentMethod, SaleStatus, InvoiceStatus, QuoteStatus, CashMovementType,
  LegalStructure,
  Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
  SupplierInvoice, SupplierInvoiceItem, SupplierInvoiceStatus,
  StockMovementRecord, StockMovementType, ReminderLogRecord, ReminderLevel,
} from '@/types';
import { normalizeProductType } from '@/constants/productTypes';

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

function toVATRate(val: unknown): VATRate {
  const n = toNumber(val);
  if (n === 20 || n === 10 || n === 5.5 || n === 2.1 || n === 0) return n;
  return 20;
}

// ====== COMPANY ======

export function mapCompanyFromDB(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    name: row.name as string,
    legalStructure: row.legal_structure as LegalStructure,
    siret: row.siret as string,
    vatNumber: row.vat_number as string,
    address: row.address as string,
    city: row.city as string,
    postalCode: row.postal_code as string,
    country: row.country as string,
    phone: row.phone as string,
    email: row.email as string,
    website: row.website as string,
    iban: row.iban as string,
    bic: row.bic as string,
    defaultVatRate: toVATRate(row.default_vat_rate),
    paymentTermsDays: toNumber(row.payment_terms_days),
    invoicePrefix: row.invoice_prefix as string,
    invoiceNextNumber: toNumber(row.invoice_next_number),
    quotePrefix: row.quote_prefix as string,
    quoteNextNumber: toNumber(row.quote_next_number),
    creditNotePrefix: row.credit_note_prefix as string,
    creditNoteNextNumber: toNumber(row.credit_note_next_number),
    purchaseOrderPrefix: (row.purchase_order_prefix as string) || 'CF',
    purchaseOrderNextNumber: toNumber(row.purchase_order_next_number) || 1,
    supplierInvoicePrefix: (row.supplier_invoice_prefix as string) || 'FR',
    supplierInvoiceNextNumber: toNumber(row.supplier_invoice_next_number) || 1,
    vatExempt: row.vat_exempt as boolean,
    vatExemptArticle: row.vat_exempt_article as string | undefined,
    reminderEnabled: row.reminder_enabled as boolean,
    reminderDays: (row.reminder_days as number[]) || [7, 14, 30],
    lateFeeRate: toNumber(row.late_fee_rate),
    electronicInvoicingReady: row.electronic_invoicing_ready as boolean,
    currency: (row.currency as string) || 'EUR',
    logoUrl: row.logo_url as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapCompanyToDB(company: Partial<Company>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (company.id !== undefined) m.id = company.id;
  if (company.name !== undefined) m.name = company.name;
  if (company.legalStructure !== undefined) m.legal_structure = company.legalStructure;
  if (company.siret !== undefined) m.siret = company.siret;
  if (company.vatNumber !== undefined) m.vat_number = company.vatNumber;
  if (company.address !== undefined) m.address = company.address;
  if (company.city !== undefined) m.city = company.city;
  if (company.postalCode !== undefined) m.postal_code = company.postalCode;
  if (company.country !== undefined) m.country = company.country;
  if (company.phone !== undefined) m.phone = company.phone;
  if (company.email !== undefined) m.email = company.email;
  if (company.website !== undefined) m.website = company.website;
  if (company.iban !== undefined) m.iban = company.iban;
  if (company.bic !== undefined) m.bic = company.bic;
  if (company.defaultVatRate !== undefined) m.default_vat_rate = company.defaultVatRate;
  if (company.paymentTermsDays !== undefined) m.payment_terms_days = company.paymentTermsDays;
  if (company.invoicePrefix !== undefined) m.invoice_prefix = company.invoicePrefix;
  if (company.invoiceNextNumber !== undefined) m.invoice_next_number = company.invoiceNextNumber;
  if (company.quotePrefix !== undefined) m.quote_prefix = company.quotePrefix;
  if (company.quoteNextNumber !== undefined) m.quote_next_number = company.quoteNextNumber;
  if (company.creditNotePrefix !== undefined) m.credit_note_prefix = company.creditNotePrefix;
  if (company.creditNoteNextNumber !== undefined) m.credit_note_next_number = company.creditNoteNextNumber;
  if (company.purchaseOrderPrefix !== undefined) m.purchase_order_prefix = company.purchaseOrderPrefix;
  if (company.purchaseOrderNextNumber !== undefined) m.purchase_order_next_number = company.purchaseOrderNextNumber;
  if (company.supplierInvoicePrefix !== undefined) m.supplier_invoice_prefix = company.supplierInvoicePrefix;
  if (company.supplierInvoiceNextNumber !== undefined) m.supplier_invoice_next_number = company.supplierInvoiceNextNumber;
  if (company.vatExempt !== undefined) m.vat_exempt = company.vatExempt;
  if (company.vatExemptArticle !== undefined) m.vat_exempt_article = company.vatExemptArticle;
  if (company.reminderEnabled !== undefined) m.reminder_enabled = company.reminderEnabled;
  if (company.reminderDays !== undefined) m.reminder_days = company.reminderDays;
  if (company.lateFeeRate !== undefined) m.late_fee_rate = company.lateFeeRate;
  if (company.electronicInvoicingReady !== undefined) m.electronic_invoicing_ready = company.electronicInvoicingReady;
  if (company.currency !== undefined) m.currency = company.currency;
  if (company.logoUrl !== undefined) m.logo_url = company.logoUrl;
  return m;
}

// ====== CLIENT ======

function mapClientFromDB(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    type: row.type as 'company' | 'individual',
    companyName: row.company_name as string | undefined,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: row.phone as string,
    address: row.address as string,
    city: row.city as string,
    postalCode: row.postal_code as string,
    country: row.country as string,
    vatNumber: row.vat_number as string | undefined,
    siret: row.siret as string | undefined,
    notes: row.notes as string,
    discountPercent: row.discount_percent != null ? toNumber(row.discount_percent) : undefined,
    discountCategory: (row.discount_category as string) || undefined,
    totalOrders: toNumber(row.total_orders),
    totalRevenue: toNumber(row.total_revenue),
    marginTotal: toNumber(row.margin_total),
    isDeleted: row.is_deleted as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapClientToDB(client: Partial<Client>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (client.id !== undefined) m.id = client.id;
  if (client.companyId !== undefined) m.company_id = client.companyId;
  if (client.type !== undefined) m.type = client.type;
  if (client.companyName !== undefined) m.company_name = client.companyName;
  if (client.firstName !== undefined) m.first_name = client.firstName;
  if (client.lastName !== undefined) m.last_name = client.lastName;
  if (client.email !== undefined) m.email = client.email;
  if (client.phone !== undefined) m.phone = client.phone;
  if (client.address !== undefined) m.address = client.address;
  if (client.city !== undefined) m.city = client.city;
  if (client.postalCode !== undefined) m.postal_code = client.postalCode;
  if (client.country !== undefined) m.country = client.country;
  if (client.vatNumber !== undefined) m.vat_number = client.vatNumber;
  if (client.siret !== undefined) m.siret = client.siret;
  if (client.notes !== undefined) m.notes = client.notes;
  if (client.discountPercent !== undefined) m.discount_percent = client.discountPercent ?? null;
  if (client.discountCategory !== undefined) m.discount_category = client.discountCategory ?? null;
  if (client.totalOrders !== undefined) m.total_orders = client.totalOrders;
  if (client.totalRevenue !== undefined) m.total_revenue = client.totalRevenue;
  if (client.marginTotal !== undefined) m.margin_total = client.marginTotal;
  if (client.isDeleted !== undefined) m.is_deleted = client.isDeleted;
  if (client.updatedAt !== undefined) m.updated_at = client.updatedAt;
  return m;
}

// ====== PRODUCT ======

function mapProductFromDB(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    description: row.description as string,
    sku: row.sku as string,
    categoryName: (row.category_name as string) || undefined,
    supplierId: row.supplier_id as string | undefined,
    supplierName: (row.supplier_name as string) || undefined,
    brand: (row.brand as string) || undefined,
    purchasePrice: toNumber(row.purchase_price),
    salePrice: toNumber(row.sale_price),
    vatRate: toVATRate(row.vat_rate),
    stockQuantity: toNumber(row.stock_quantity),
    lowStockThreshold: toNumber(row.low_stock_threshold),
    unit: row.unit as string,
    type: normalizeProductType(row.type),
    photoUrl: row.photo_url as string | undefined,
    isActive: row.is_active as boolean,
    isArchived: row.is_archived as boolean,
    usedInValidatedInvoice: row.used_in_validated_invoice as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapProductToDB(product: Partial<Product>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (product.id !== undefined) m.id = product.id;
  if (product.companyId !== undefined) m.company_id = product.companyId;
  if (product.name !== undefined) m.name = product.name;
  if (product.description !== undefined) m.description = product.description;
  if (product.sku !== undefined) m.sku = product.sku;
  if (product.categoryName !== undefined) m.category_name = product.categoryName || null;
  if (product.supplierId !== undefined && product.supplierId !== '') m.supplier_id = product.supplierId;
  if (product.brand !== undefined) m.brand = product.brand || null;
  if (product.purchasePrice !== undefined) m.purchase_price = product.purchasePrice;
  if (product.salePrice !== undefined) m.sale_price = product.salePrice;
  if (product.vatRate !== undefined) m.vat_rate = product.vatRate;
  if (product.stockQuantity !== undefined) m.stock_quantity = product.stockQuantity;
  if (product.lowStockThreshold !== undefined) m.low_stock_threshold = product.lowStockThreshold;
  if (product.unit !== undefined) m.unit = product.unit;
  if (product.type !== undefined) m.type = product.type;
  if (product.photoUrl !== undefined && product.photoUrl !== '') m.photo_url = product.photoUrl;
  if (product.isActive !== undefined) m.is_active = product.isActive;
  if (product.isArchived !== undefined) m.is_archived = product.isArchived;
  if (product.usedInValidatedInvoice !== undefined) m.used_in_validated_invoice = product.usedInValidatedInvoice;
  if (product.updatedAt !== undefined) m.updated_at = product.updatedAt;
  return m;
}

// ====== PRODUCT VARIANT ======

function mapVariantFromDB(row: Record<string, unknown>): ProductVariant {
  let attrs: Record<string, string> = {};
  if (typeof row.attributes === 'string') {
    try { attrs = JSON.parse(row.attributes); } catch { attrs = {}; }
  } else if (row.attributes && typeof row.attributes === 'object') {
    attrs = row.attributes as Record<string, string>;
  }
  return {
    id: row.id as string,
    productId: row.product_id as string,
    companyId: row.company_id as string,
    attributes: attrs,
    sku: (row.sku as string) || '',
    purchasePrice: toNumber(row.purchase_price),
    salePrice: toNumber(row.sale_price),
    stockQuantity: toNumber(row.stock_quantity),
    minStock: toNumber(row.min_stock),
    isActive: row.is_active !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapVariantToDB(v: Partial<ProductVariant>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (v.id !== undefined) m.id = v.id;
  if (v.productId !== undefined) m.product_id = v.productId;
  if (v.companyId !== undefined) m.company_id = v.companyId;
  if (v.attributes !== undefined) m.attributes = v.attributes;
  if (v.sku !== undefined) m.sku = v.sku;
  if (v.purchasePrice !== undefined) m.purchase_price = v.purchasePrice;
  if (v.salePrice !== undefined) m.sale_price = v.salePrice;
  if (v.stockQuantity !== undefined) m.stock_quantity = v.stockQuantity;
  if (v.updatedAt !== undefined) m.updated_at = v.updatedAt;
  return m;
}

// ====== INVOICE ======

function mapInvoiceFromDB(row: Record<string, unknown>): Invoice {
  const rawItems = row.items as unknown;
  let items: OrderItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems as OrderItem[];
  } else if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems); } catch { items = []; }
  }
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    orderId: row.order_id as string | undefined,
    quoteId: row.quote_id as string | undefined,
    clientId: row.client_id as string,
    clientName: row.client_name as string,
    invoiceNumber: row.invoice_number as string,
    status: row.status as InvoiceStatus,
    items,
    totalHT: toNumber(row.total_ht),
    totalTVA: toNumber(row.total_tva),
    totalTTC: toNumber(row.total_ttc),
    paidAmount: toNumber(row.paid_amount),
    issueDate: row.issue_date as string,
    dueDate: row.due_date as string,
    paymentTerms: row.payment_terms as string,
    legalMentions: row.legal_mentions as string,
    isValidated: row.is_validated as boolean,
    isLocked: row.is_locked as boolean,
    validatedAt: row.validated_at as string | undefined,
    electronicReady: row.electronic_ready as boolean,
    xmlStructure: row.xml_structure as string | undefined,
    creditNoteId: row.credit_note_id as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapInvoiceToDB(inv: Partial<Invoice>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (inv.id !== undefined) m.id = inv.id;
  if (inv.companyId !== undefined) m.company_id = inv.companyId;
  if (inv.orderId !== undefined) m.order_id = inv.orderId;
  if (inv.quoteId !== undefined) m.quote_id = inv.quoteId;
  if (inv.clientId !== undefined) m.client_id = inv.clientId;
  if (inv.clientName !== undefined) m.client_name = inv.clientName;
  if (inv.invoiceNumber !== undefined) m.invoice_number = inv.invoiceNumber;
  if (inv.status !== undefined) m.status = inv.status;
  if (inv.items !== undefined) m.items = inv.items;
  if (inv.totalHT !== undefined) m.total_ht = inv.totalHT;
  if (inv.totalTVA !== undefined) m.total_tva = inv.totalTVA;
  if (inv.totalTTC !== undefined) m.total_ttc = inv.totalTTC;
  if (inv.paidAmount !== undefined) m.paid_amount = inv.paidAmount;
  if (inv.issueDate !== undefined) m.issue_date = inv.issueDate;
  if (inv.dueDate !== undefined) m.due_date = inv.dueDate;
  if (inv.paymentTerms !== undefined) m.payment_terms = inv.paymentTerms;
  if (inv.legalMentions !== undefined) m.legal_mentions = inv.legalMentions;
  if (inv.isValidated !== undefined) m.is_validated = inv.isValidated;
  if (inv.isLocked !== undefined) m.is_locked = inv.isLocked;
  if (inv.validatedAt !== undefined) m.validated_at = inv.validatedAt;
  if (inv.electronicReady !== undefined) m.electronic_ready = inv.electronicReady;
  if (inv.xmlStructure !== undefined) m.xml_structure = inv.xmlStructure;
  if (inv.creditNoteId !== undefined) m.credit_note_id = inv.creditNoteId;
  return m;
}

// ====== QUOTE ======

function mapQuoteFromDB(row: Record<string, unknown>): Quote {
  const rawItems = row.items as unknown;
  let items: QuoteItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems as QuoteItem[];
  } else if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems); } catch { items = []; }
  }
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    clientId: row.client_id as string,
    clientName: row.client_name as string,
    quoteNumber: row.quote_number as string,
    status: row.status as QuoteStatus,
    items,
    totalHT: toNumber(row.total_ht),
    totalTVA: toNumber(row.total_tva),
    totalTTC: toNumber(row.total_ttc),
    issueDate: row.issue_date as string,
    expirationDate: row.expiration_date as string,
    acceptedAt: row.accepted_at as string | undefined,
    acceptedBy: row.accepted_by as string | undefined,
    convertedToInvoiceId: row.converted_to_invoice_id as string | undefined,
    notes: row.notes as string,
    createdAt: row.created_at as string,
  };
}

function mapQuoteToDB(q: Partial<Quote>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (q.id !== undefined) m.id = q.id;
  if (q.companyId !== undefined) m.company_id = q.companyId;
  if (q.clientId !== undefined) m.client_id = q.clientId;
  if (q.clientName !== undefined) m.client_name = q.clientName;
  if (q.quoteNumber !== undefined) m.quote_number = q.quoteNumber;
  if (q.status !== undefined) m.status = q.status;
  if (q.items !== undefined) m.items = q.items;
  if (q.totalHT !== undefined) m.total_ht = q.totalHT;
  if (q.totalTVA !== undefined) m.total_tva = q.totalTVA;
  if (q.totalTTC !== undefined) m.total_ttc = q.totalTTC;
  if (q.issueDate !== undefined) m.issue_date = q.issueDate;
  if (q.expirationDate !== undefined) m.expiration_date = q.expirationDate;
  if (q.acceptedAt !== undefined) m.accepted_at = q.acceptedAt;
  if (q.acceptedBy !== undefined) m.accepted_by = q.acceptedBy;
  if (q.convertedToInvoiceId !== undefined) m.converted_to_invoice_id = q.convertedToInvoiceId;
  if (q.notes !== undefined) m.notes = q.notes;
  return m;
}

// ====== SALE ======

function mapSaleFromDB(row: Record<string, unknown>): Sale {
  const rawItems = row.items as unknown;
  let items: SaleItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems as SaleItem[];
  } else if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems); } catch { items = []; }
  }
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    saleNumber: row.sale_number as string,
    clientId: row.client_id as string | undefined,
    clientName: row.client_name as string | undefined,
    items,
    totalHT: toNumber(row.total_ht),
    totalTVA: toNumber(row.total_tva),
    totalTTC: toNumber(row.total_ttc),
    paymentMethod: row.payment_method as SalePaymentMethod,
    status: row.status as SaleStatus,
    refundedAt: row.refunded_at as string | undefined,
    refundedSaleId: row.refunded_sale_id as string | undefined,
    convertedToInvoiceId: row.converted_to_invoice_id as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapSaleToDB(s: Partial<Sale>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (s.id !== undefined) m.id = s.id;
  if (s.companyId !== undefined) m.company_id = s.companyId;
  if (s.saleNumber !== undefined) m.sale_number = s.saleNumber;
  if (s.clientId !== undefined) m.client_id = s.clientId;
  if (s.clientName !== undefined) m.client_name = s.clientName;
  if (s.items !== undefined) m.items = s.items;
  if (s.totalHT !== undefined) m.total_ht = s.totalHT;
  if (s.totalTVA !== undefined) m.total_tva = s.totalTVA;
  if (s.totalTTC !== undefined) m.total_ttc = s.totalTTC;
  if (s.paymentMethod !== undefined) m.payment_method = s.paymentMethod;
  if (s.status !== undefined) m.status = s.status;
  if (s.refundedAt !== undefined) m.refunded_at = s.refundedAt;
  if (s.refundedSaleId !== undefined) m.refunded_sale_id = s.refundedSaleId;
  if (s.convertedToInvoiceId !== undefined) m.converted_to_invoice_id = s.convertedToInvoiceId;
  return m;
}

// ====== CASH MOVEMENT ======

function mapCashMovementFromDB(row: Record<string, unknown>): CashMovement {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    type: row.type as CashMovementType,
    amount: toNumber(row.amount),
    description: row.description as string,
    category: row.category as string,
    date: row.date as string,
    invoiceId: row.invoice_id as string | undefined,
    expenseId: row.expense_id as string | undefined,
    balance: toNumber(row.balance),
    sourceType: row.source_type as string | undefined,
    sourceRef: row.source_ref as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapCashMovementToDB(cm: Partial<CashMovement>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (cm.id !== undefined) m.id = cm.id;
  if (cm.companyId !== undefined) m.company_id = cm.companyId;
  if (cm.type !== undefined) m.type = cm.type;
  if (cm.amount !== undefined) m.amount = cm.amount;
  if (cm.description !== undefined) m.description = cm.description;
  if (cm.category !== undefined) m.category = cm.category;
  if (cm.date !== undefined) m.date = cm.date;
  if (cm.invoiceId !== undefined) m.invoice_id = cm.invoiceId;
  if (cm.expenseId !== undefined) m.expense_id = cm.expenseId;
  if (cm.balance !== undefined) m.balance = cm.balance;
  if (cm.sourceType !== undefined) m.source_type = cm.sourceType;
  if (cm.sourceRef !== undefined) m.source_ref = cm.sourceRef;
  return m;
}

// ====== SUPPLIER ======

function mapSupplierFromDB(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    companyName: row.company_name as string,
    email: row.email as string,
    phone: row.phone as string,
    address: row.address as string,
    city: row.city as string,
    postalCode: row.postal_code as string,
    country: row.country as string,
    vatNumber: row.vat_number as string | undefined,
    siret: row.siret as string | undefined,
    notes: row.notes as string,
    paymentConditions: row.payment_conditions as string,
    isDeleted: row.is_deleted as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSupplierToDB(s: Partial<Supplier>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (s.id !== undefined) m.id = s.id;
  if (s.companyId !== undefined) m.company_id = s.companyId;
  if (s.companyName !== undefined) m.company_name = s.companyName;
  if (s.email !== undefined) m.email = s.email;
  if (s.phone !== undefined) m.phone = s.phone;
  if (s.address !== undefined) m.address = s.address;
  if (s.city !== undefined) m.city = s.city;
  if (s.postalCode !== undefined) m.postal_code = s.postalCode;
  if (s.country !== undefined) m.country = s.country;
  if (s.vatNumber !== undefined) m.vat_number = s.vatNumber;
  if (s.siret !== undefined) m.siret = s.siret;
  if (s.notes !== undefined) m.notes = s.notes;
  if (s.paymentConditions !== undefined) m.payment_conditions = s.paymentConditions;
  if (s.isDeleted !== undefined) m.is_deleted = s.isDeleted;
  if (s.updatedAt !== undefined) m.updated_at = s.updatedAt;
  return m;
}

// ====== PURCHASE ORDER ======

function mapPurchaseOrderFromDB(row: Record<string, unknown>): PurchaseOrder {
  const rawItems = row.items as unknown;
  let items: PurchaseOrderItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems as PurchaseOrderItem[];
  } else if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems); } catch { items = []; }
  }
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    supplierId: row.supplier_id as string,
    number: row.number as string,
    status: row.status as PurchaseOrderStatus,
    date: row.date as string,
    expectedDate: row.expected_date as string | undefined,
    notes: row.notes as string,
    items,
    subtotal: toNumber(row.subtotal),
    taxAmount: toNumber(row.tax_amount),
    total: toNumber(row.total),
    isDeleted: row.is_deleted as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPurchaseOrderToDB(po: Partial<PurchaseOrder>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (po.id !== undefined) m.id = po.id;
  if (po.companyId !== undefined) m.company_id = po.companyId;
  if (po.supplierId !== undefined) m.supplier_id = po.supplierId;
  if (po.number !== undefined) m.number = po.number;
  if (po.status !== undefined) m.status = po.status;
  if (po.date !== undefined) m.date = po.date;
  if (po.expectedDate !== undefined) m.expected_date = po.expectedDate;
  if (po.notes !== undefined) m.notes = po.notes;
  if (po.items !== undefined) m.items = po.items;
  if (po.subtotal !== undefined) m.subtotal = po.subtotal;
  if (po.taxAmount !== undefined) m.tax_amount = po.taxAmount;
  if (po.total !== undefined) m.total = po.total;
  if (po.isDeleted !== undefined) m.is_deleted = po.isDeleted;
  if (po.updatedAt !== undefined) m.updated_at = po.updatedAt;
  return m;
}

// ====== SUPPLIER INVOICE ======

function mapSupplierInvoiceFromDB(row: Record<string, unknown>): SupplierInvoice {
  const rawItems = row.items as unknown;
  let items: SupplierInvoiceItem[] = [];
  if (Array.isArray(rawItems)) {
    items = rawItems as SupplierInvoiceItem[];
  } else if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems); } catch { items = []; }
  }
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    supplierId: row.supplier_id as string,
    purchaseOrderId: row.purchase_order_id as string | undefined,
    number: row.number as string,
    supplierInvoiceNumber: (row.supplier_invoice_number as string) || undefined,
    status: row.status as SupplierInvoiceStatus,
    date: row.date as string,
    dueDate: row.due_date as string,
    notes: row.notes as string,
    items,
    subtotal: toNumber(row.subtotal),
    taxAmount: toNumber(row.tax_amount),
    total: toNumber(row.total),
    attachmentUrl: (row.attachment_url as string) || undefined,
    isDeleted: row.is_deleted as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSupplierInvoiceToDB(si: Partial<SupplierInvoice>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (si.id !== undefined) m.id = si.id;
  if (si.companyId !== undefined) m.company_id = si.companyId;
  if (si.supplierId !== undefined) m.supplier_id = si.supplierId;
  if (si.purchaseOrderId !== undefined) m.purchase_order_id = si.purchaseOrderId;
  if (si.number !== undefined) m.number = si.number;
  if (si.supplierInvoiceNumber !== undefined) m.supplier_invoice_number = si.supplierInvoiceNumber;
  if (si.status !== undefined) m.status = si.status;
  if (si.date !== undefined) m.date = si.date;
  if (si.dueDate !== undefined) m.due_date = si.dueDate;
  if (si.notes !== undefined) m.notes = si.notes;
  if (si.items !== undefined) m.items = si.items;
  if (si.subtotal !== undefined) m.subtotal = si.subtotal;
  if (si.taxAmount !== undefined) m.tax_amount = si.taxAmount;
  if (si.total !== undefined) m.total = si.total;
  if (si.attachmentUrl !== undefined) m.attachment_url = si.attachmentUrl;
  if (si.isDeleted !== undefined) m.is_deleted = si.isDeleted;
  if (si.updatedAt !== undefined) m.updated_at = si.updatedAt;
  return m;
}

// ====== RECIPE ======

function mapRecipeFromDB(row: Record<string, unknown>): { id: string; productId: string; variantId?: string; companyId: string; items: unknown[]; createdAt: string; updatedAt: string } {
  let items: unknown[] = [];
  if (Array.isArray(row.items)) {
    items = row.items;
  } else if (typeof row.items === 'string') {
    try { items = JSON.parse(row.items); } catch { items = []; }
  }
  return {
    id: row.id as string,
    productId: row.product_id as string,
    variantId: (row.variant_id as string) || undefined,
    companyId: row.company_id as string,
    items,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRecipeToDB(r: { id?: string; productId?: string; variantId?: string; companyId?: string; items?: unknown[]; updatedAt?: string }): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (r.id !== undefined) m.id = r.id;
  if (r.productId !== undefined) m.product_id = r.productId;
  if (r.variantId !== undefined) m.variant_id = r.variantId || null;
  if (r.companyId !== undefined) m.company_id = r.companyId;
  if (r.items !== undefined) m.items = r.items;
  if (r.updatedAt !== undefined) m.updated_at = r.updatedAt;
  return m;
}

// ====== STOCK MOVEMENT ======

function mapStockMovementFromDB(row: Record<string, unknown>): StockMovementRecord {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    productId: row.product_id as string,
    variantId: row.variant_id as string | undefined,
    type: row.type as StockMovementType,
    quantity: toNumber(row.quantity),
    reference: row.reference as string,
    notes: row.notes as string,
    createdAt: row.created_at as string,
  };
}

function mapStockMovementToDB(sm: Partial<StockMovementRecord>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (sm.id !== undefined) m.id = sm.id;
  if (sm.companyId !== undefined) m.company_id = sm.companyId;
  if (sm.productId !== undefined) m.product_id = sm.productId;
  if (sm.variantId !== undefined) m.variant_id = sm.variantId;
  if (sm.type !== undefined) m.type = sm.type;
  if (sm.quantity !== undefined) m.quantity = sm.quantity;
  if (sm.reference !== undefined) m.reference = sm.reference;
  if (sm.notes !== undefined) m.notes = sm.notes;
  return m;
}

// ====== REMINDER LOG ======

function mapReminderLogFromDB(row: Record<string, unknown>): ReminderLogRecord {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    invoiceId: row.invoice_id as string,
    sentAt: row.sent_at as string,
    level: toNumber(row.level) as ReminderLevel,
    method: row.method as string,
    createdAt: row.created_at as string,
  };
}

function mapReminderLogToDB(rl: Partial<ReminderLogRecord>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (rl.id !== undefined) m.id = rl.id;
  if (rl.companyId !== undefined) m.company_id = rl.companyId;
  if (rl.invoiceId !== undefined) m.invoice_id = rl.invoiceId;
  if (rl.sentAt !== undefined) m.sent_at = rl.sentAt;
  if (rl.level !== undefined) m.level = rl.level;
  if (rl.method !== undefined) m.method = rl.method;
  return m;
}

// ====== AUDIT LOG ======

function mapAuditLogFromDB(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    action: row.action as AuditActionType,
    entityType: row.entity_type as AuditEntityType,
    entityId: row.entity_id as string,
    entityLabel: row.entity_label as string,
    details: row.details as string,
    previousValue: row.previous_value as string | undefined,
    newValue: row.new_value as string | undefined,
    ipAddress: row.ip_address as string | undefined,
    timestamp: row.timestamp as string,
  };
}

function mapAuditLogToDB(a: Partial<AuditLog>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (a.id !== undefined) m.id = a.id;
  if (a.companyId !== undefined) m.company_id = a.companyId;
  if (a.userId !== undefined) m.user_id = a.userId;
  if (a.userName !== undefined) m.user_name = a.userName;
  if (a.action !== undefined) m.action = a.action;
  if (a.entityType !== undefined) m.entity_type = a.entityType;
  if (a.entityId !== undefined) m.entity_id = a.entityId;
  if (a.entityLabel !== undefined) m.entity_label = a.entityLabel;
  if (a.details !== undefined) m.details = a.details;
  if (a.previousValue !== undefined) m.previous_value = a.previousValue;
  if (a.newValue !== undefined) m.new_value = a.newValue;
  if (a.ipAddress !== undefined) m.ip_address = a.ipAddress;
  if (a.timestamp !== undefined) m.timestamp = a.timestamp;
  return m;
}

// ====== CATEGORY / BRAND ======

export interface DBCategory {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface DBBrand {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

// ====== NETWORK GUARD ======

let _networkWarningShown = false;
let _lastNetworkError = 0;

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message === 'Network request failed')) return true;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: string }).message;
    if (msg === 'Failed to fetch' || msg === 'Network request failed' || msg.includes('Failed to fetch') || msg.includes('Network request failed')) return true;
  }
  return false;
}

function logNetworkWarningOnce(label: string): void {
  const now = Date.now();
  if (!_networkWarningShown || now - _lastNetworkError > 30000) {

    _networkWarningShown = true;
    _lastNetworkError = now;
  }
}

async function safeFetch<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured) {
    return fallback;
  }
  try {
    return await fn();
  // eslint-disable-next-line no-unused-vars
  } catch (_err) {
    logNetworkWarningOnce(label);
    return fallback;
  }
}

async function safeMutate<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error(`[DB] ${label}: Supabase not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.`);
  }
  try {
    return await fn();
  } catch (err) {
    if (isNetworkError(err)) {
      throw new Error(`[DB] ${label}: Erreur réseau. Vérifiez votre connexion internet.`);
    }
    throw err;
  }
}

// ====== API FUNCTIONS ======

export const db = {
  // --- Company ---
  async fetchCompany(companyId: string): Promise<Company | null> {
    return safeFetch('fetchCompany', null, async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
      if (error) { logNetworkWarningOnce('fetchCompany'); return null; }
      if (!data) return null;
      return mapCompanyFromDB(data as Record<string, unknown>);
    });
  },

  async upsertCompany(company: Company): Promise<Company> {
    return safeMutate('upsertCompany', async () => {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      const payload = mapCompanyToDB(company);
      if (userId) {
        payload.owner_id = userId;
      }
      const { data, error } = await supabase.from('companies').upsert(payload).select().single();
      if (error) throw new Error(`[DB] upsertCompany: ${error.message}`);
      return mapCompanyFromDB(data as Record<string, unknown>);
    });
  },

  async updateCompany(companyId: string, updates: Partial<Company>): Promise<void> {
    return safeMutate('updateCompany', async () => {
      const { error } = await supabase.from('companies').update(mapCompanyToDB(updates)).eq('id', companyId);
      if (error) throw new Error(`[DB] updateCompany: ${error.message}`);
    });
  },

  // --- Clients ---
  async fetchClients(companyId: string): Promise<Client[]> {
    return safeFetch('fetchClients', [], async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchClients'); return []; }
      return (data as Record<string, unknown>[]).map(mapClientFromDB);
    });
  },

  async insertClient(client: Client): Promise<Client> {
    return safeMutate('insertClient', async () => {
      const { data, error } = await supabase.from('clients').insert(mapClientToDB(client)).select().single();
      if (error) throw new Error(`[DB] insertClient: ${error.message}`);
      return mapClientFromDB(data as Record<string, unknown>);
    });
  },

  async updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
    return safeMutate('updateClient', async () => {
      const { error } = await supabase.from('clients').update(mapClientToDB(updates)).eq('id', clientId);
      if (error) throw new Error(`[DB] updateClient: ${error.message}`);
    });
  },

  // --- Products ---
  async fetchProducts(companyId: string): Promise<Product[]> {
    return safeFetch('fetchProducts', [], async () => {
      const { data, error } = await supabase.from('products').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchProducts'); return []; }
      return (data as Record<string, unknown>[]).map(mapProductFromDB);
    });
  },

  async insertProduct(product: Product): Promise<Product> {
    return safeMutate('insertProduct', async () => {
      const { data, error } = await supabase.from('products').insert(mapProductToDB(product)).select().single();
      if (error) throw new Error(`[DB] insertProduct: ${error.message}`);
      return mapProductFromDB(data as Record<string, unknown>);
    });
  },

  async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    return safeMutate('updateProduct', async () => {
      const { error } = await supabase.from('products').update(mapProductToDB(updates)).eq('id', productId);
      if (error) throw new Error(`[DB] updateProduct: ${error.message}`);
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    return safeMutate('deleteProduct', async () => {
      const { error: varError } = await supabase.from('product_variants').delete().eq('product_id', productId);

      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw new Error(`[DB] deleteProduct: ${error.message}`);
    });
  },

  // --- Invoices ---
  async fetchInvoices(companyId: string): Promise<Invoice[]> {
    return safeFetch('fetchInvoices', [], async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchInvoices'); return []; }
      return (data as Record<string, unknown>[]).map(mapInvoiceFromDB);
    });
  },

  async insertInvoice(invoice: Invoice): Promise<Invoice> {
    return safeMutate('insertInvoice', async () => {
      const { data, error } = await supabase.from('invoices').insert(mapInvoiceToDB(invoice)).select().single();
      if (error) throw new Error(`[DB] insertInvoice: ${error.message}`);
      return mapInvoiceFromDB(data as Record<string, unknown>);
    });
  },

  async updateInvoice(invoiceId: string, updates: Partial<Invoice>): Promise<void> {
    return safeMutate('updateInvoice', async () => {
      const { error } = await supabase.from('invoices').update(mapInvoiceToDB(updates)).eq('id', invoiceId);
      if (error) throw new Error(`[DB] updateInvoice: ${error.message}`);
    });
  },

  // --- Quotes ---
  async fetchQuotes(companyId: string): Promise<Quote[]> {
    return safeFetch('fetchQuotes', [], async () => {
      const { data, error } = await supabase.from('quotes').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchQuotes'); return []; }
      return (data as Record<string, unknown>[]).map(mapQuoteFromDB);
    });
  },

  async insertQuote(quote: Quote): Promise<Quote> {
    return safeMutate('insertQuote', async () => {
      const { data, error } = await supabase.from('quotes').insert(mapQuoteToDB(quote)).select().single();
      if (error) throw new Error(`[DB] insertQuote: ${error.message}`);
      return mapQuoteFromDB(data as Record<string, unknown>);
    });
  },

  async updateQuote(quoteId: string, updates: Partial<Quote>): Promise<void> {
    return safeMutate('updateQuote', async () => {
      const { error } = await supabase.from('quotes').update(mapQuoteToDB(updates)).eq('id', quoteId);
      if (error) throw new Error(`[DB] updateQuote: ${error.message}`);
    });
  },

  // --- Sales ---
  async fetchSales(companyId: string): Promise<Sale[]> {
    return safeFetch('fetchSales', [], async () => {
      const { data, error } = await supabase.from('sales').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchSales'); return []; }
      return (data as Record<string, unknown>[]).map(mapSaleFromDB);
    });
  },

  async insertSale(sale: Sale): Promise<Sale> {
    return safeMutate('insertSale', async () => {
      const { data, error } = await supabase.from('sales').insert(mapSaleToDB(sale)).select().single();
      if (error) throw new Error(`[DB] insertSale: ${error.message}`);
      return mapSaleFromDB(data as Record<string, unknown>);
    });
  },

  async updateSale(saleId: string, updates: Partial<Sale>): Promise<void> {
    return safeMutate('updateSale', async () => {
      const { error } = await supabase.from('sales').update(mapSaleToDB(updates)).eq('id', saleId);
      if (error) throw new Error(`[DB] updateSale: ${error.message}`);
    });
  },

  // --- Cash Movements ---
  async fetchCashMovements(companyId: string): Promise<CashMovement[]> {
    return safeFetch('fetchCashMovements', [], async () => {
      const { data, error } = await supabase.from('cash_movements').select('*').eq('company_id', companyId).order('date', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchCashMovements'); return []; }
      return (data as Record<string, unknown>[]).map(mapCashMovementFromDB);
    });
  },

  async insertCashMovement(cm: CashMovement): Promise<CashMovement> {
    return safeMutate('insertCashMovement', async () => {
      const { data, error } = await supabase.from('cash_movements').insert(mapCashMovementToDB(cm)).select().single();
      if (error) throw new Error(`[DB] insertCashMovement: ${error.message}`);
      return mapCashMovementFromDB(data as Record<string, unknown>);
    });
  },

  // --- Audit Logs ---
  async fetchAuditLogs(companyId: string): Promise<AuditLog[]> {
    return safeFetch('fetchAuditLogs', [], async () => {
      const { data, error } = await supabase.from('audit_logs').select('*').eq('company_id', companyId).order('timestamp', { ascending: false }).limit(200);
      if (error) { logNetworkWarningOnce('fetchAuditLogs'); return []; }
      return (data as Record<string, unknown>[]).map(mapAuditLogFromDB);
    });
  },

  async insertAuditLog(log: AuditLog): Promise<void> {
    try {
      const { error: _error } = await supabase.from('audit_logs').insert(mapAuditLogToDB(log));
    } catch {
    }
  },

  // --- Suppliers ---
  async fetchSuppliers(companyId: string): Promise<Supplier[]> {
    return safeFetch('fetchSuppliers', [], async () => {
      const { data, error } = await supabase.from('suppliers').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchSuppliers'); return []; }
      return (data as Record<string, unknown>[]).map(mapSupplierFromDB);
    });
  },

  async insertSupplier(supplier: Supplier): Promise<Supplier> {
    return safeMutate('insertSupplier', async () => {
      const { data, error } = await supabase.from('suppliers').insert(mapSupplierToDB(supplier)).select().single();
      if (error) throw new Error(`[DB] insertSupplier: ${error.message}`);
      return mapSupplierFromDB(data as Record<string, unknown>);
    });
  },

  async updateSupplier(supplierId: string, updates: Partial<Supplier>): Promise<void> {
    return safeMutate('updateSupplier', async () => {
      const { error } = await supabase.from('suppliers').update(mapSupplierToDB(updates)).eq('id', supplierId);
      if (error) throw new Error(`[DB] updateSupplier: ${error.message}`);
    });
  },

  // --- Purchase Orders ---
  async fetchPurchaseOrders(companyId: string): Promise<PurchaseOrder[]> {
    return safeFetch('fetchPurchaseOrders', [], async () => {
      const { data, error } = await supabase.from('purchase_orders').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchPurchaseOrders'); return []; }
      return (data as Record<string, unknown>[]).map(mapPurchaseOrderFromDB);
    });
  },

  async insertPurchaseOrder(po: PurchaseOrder): Promise<PurchaseOrder> {
    return safeMutate('insertPurchaseOrder', async () => {
      const { data, error } = await supabase.from('purchase_orders').insert(mapPurchaseOrderToDB(po)).select().single();
      if (error) throw new Error(`[DB] insertPurchaseOrder: ${error.message}`);
      return mapPurchaseOrderFromDB(data as Record<string, unknown>);
    });
  },

  async updatePurchaseOrder(poId: string, updates: Partial<PurchaseOrder>): Promise<void> {
    return safeMutate('updatePurchaseOrder', async () => {
      const { error } = await supabase.from('purchase_orders').update(mapPurchaseOrderToDB(updates)).eq('id', poId);
      if (error) throw new Error(`[DB] updatePurchaseOrder: ${error.message}`);
    });
  },

  // --- Supplier Invoices ---
  async fetchSupplierInvoices(companyId: string): Promise<SupplierInvoice[]> {
    return safeFetch('fetchSupplierInvoices', [], async () => {
      const { data, error } = await supabase.from('supplier_invoices').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchSupplierInvoices'); return []; }
      return (data as Record<string, unknown>[]).map(mapSupplierInvoiceFromDB);
    });
  },

  async insertSupplierInvoice(si: SupplierInvoice): Promise<SupplierInvoice> {
    return safeMutate('insertSupplierInvoice', async () => {
      const { data, error } = await supabase.from('supplier_invoices').insert(mapSupplierInvoiceToDB(si)).select().single();
      if (error) throw new Error(`[DB] insertSupplierInvoice: ${error.message}`);
      return mapSupplierInvoiceFromDB(data as Record<string, unknown>);
    });
  },

  async updateSupplierInvoice(siId: string, updates: Partial<SupplierInvoice>): Promise<void> {
    return safeMutate('updateSupplierInvoice', async () => {
      const { error } = await supabase.from('supplier_invoices').update(mapSupplierInvoiceToDB(updates)).eq('id', siId);
      if (error) throw new Error(`[DB] updateSupplierInvoice: ${error.message}`);
    });
  },

  // --- Stock Movements ---
  async fetchStockMovements(companyId: string): Promise<StockMovementRecord[]> {
    return safeFetch('fetchStockMovements', [], async () => {
      const { data, error } = await supabase.from('stock_movements').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchStockMovements'); return []; }
      return (data as Record<string, unknown>[]).map(mapStockMovementFromDB);
    });
  },

  async insertStockMovement(sm: StockMovementRecord): Promise<StockMovementRecord> {
    return safeMutate('insertStockMovement', async () => {
      const { data, error } = await supabase.from('stock_movements').insert(mapStockMovementToDB(sm)).select().single();
      if (error) throw new Error(`[DB] insertStockMovement: ${error.message}`);
      return mapStockMovementFromDB(data as Record<string, unknown>);
    });
  },

  // --- Reminder Logs ---
  async fetchReminderLogs(companyId: string): Promise<ReminderLogRecord[]> {
    return safeFetch('fetchReminderLogs', [], async () => {
      const { data, error } = await supabase.from('reminder_logs').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchReminderLogs'); return []; }
      return (data as Record<string, unknown>[]).map(mapReminderLogFromDB);
    });
  },

  async insertReminderLog(rl: ReminderLogRecord): Promise<ReminderLogRecord> {
    return safeMutate('insertReminderLog', async () => {
      const { data, error } = await supabase.from('reminder_logs').insert(mapReminderLogToDB(rl)).select().single();
      if (error) throw new Error(`[DB] insertReminderLog: ${error.message}`);
      return mapReminderLogFromDB(data as Record<string, unknown>);
    });
  },

  // --- Product Variants ---
  async fetchVariants(companyId: string): Promise<ProductVariant[]> {
    return safeFetch('fetchVariants', [], async () => {
      const { data, error } = await supabase.from('product_variants').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchVariants'); return []; }
      return (data as Record<string, unknown>[]).map(mapVariantFromDB);
    });
  },

  async insertVariant(v: ProductVariant): Promise<ProductVariant> {
    return safeMutate('insertVariant', async () => {
      const { data, error } = await supabase.from('product_variants').insert(mapVariantToDB(v)).select().single();
      if (error) throw new Error(`[DB] insertVariant: ${error.message}`);
      return mapVariantFromDB(data as Record<string, unknown>);
    });
  },

  async updateVariant(variantId: string, updates: Partial<ProductVariant>): Promise<void> {
    return safeMutate('updateVariant', async () => {
      const { error } = await supabase.from('product_variants').update(mapVariantToDB(updates)).eq('id', variantId);
      if (error) throw new Error(`[DB] updateVariant: ${error.message}`);
    });
  },

  async deleteVariant(variantId: string): Promise<void> {
    return safeMutate('deleteVariant', async () => {
      const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
      if (error) throw new Error(`[DB] deleteVariant: ${error.message}`);
    });
  },

  async updateProductStock(productId: string, newStockQuantity: number): Promise<void> {
    return safeMutate('updateProductStock', async () => {
      const { error } = await supabase.from('products').update({ stock_quantity: newStockQuantity, updated_at: new Date().toISOString() }).eq('id', productId);
      if (error) throw new Error(`[DB] updateProductStock: ${error.message}`);

    });
  },

  // --- Recipes ---
  async fetchRecipes(companyId: string): Promise<{ id: string; productId: string; variantId?: string; companyId: string; items: unknown[]; createdAt: string; updatedAt: string }[]> {
    return safeFetch('fetchRecipes', [], async () => {
      const { data, error } = await supabase.from('product_recipes').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (error) { logNetworkWarningOnce('fetchRecipes'); return []; }
      return (data as Record<string, unknown>[]).map(mapRecipeFromDB);
    });
  },

  async upsertRecipe(recipe: { id: string; productId: string; variantId?: string; companyId: string; items: unknown[]; updatedAt: string }): Promise<void> {
    return safeMutate('upsertRecipe', async () => {
      const payload = mapRecipeToDB(recipe);
      payload.created_at = payload.created_at || new Date().toISOString();
      payload.updated_at = recipe.updatedAt;
      const { error } = await supabase.from('product_recipes').upsert(payload);
      if (error) throw new Error(`[DB] upsertRecipe: ${error.message}`);
    });
  },

  async deleteRecipe(recipeId: string): Promise<void> {
    return safeMutate('deleteRecipe', async () => {
      const { error } = await supabase.from('product_recipes').delete().eq('id', recipeId);
      if (error) throw new Error(`[DB] deleteRecipe: ${error.message}`);
    });
  },

  async deleteRecipesForProduct(productId: string): Promise<void> {
    return safeMutate('deleteRecipesForProduct', async () => {
      const { error } = await supabase.from('product_recipes').delete().eq('product_id', productId);
      if (error) throw new Error(`[DB] deleteRecipesForProduct: ${error.message}`);
    });
  },

  // --- Seed check ---
  async hasData(companyId: string): Promise<boolean> {
    return safeFetch('hasData', false, async () => {
      const { count, error } = await supabase.from('companies').select('id', { count: 'exact', head: true }).eq('id', companyId);
      if (error) { logNetworkWarningOnce('hasData'); return false; }
      return (count ?? 0) > 0;
    });
  },

  async ensureCompanyExists(userId: string, userEmail?: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!isSupabaseConfigured) return;
    const exists = await db.hasData(userId);
    if (exists) {
      return;
    }
    const companyName = (metadata?.company_name as string)?.trim() || (metadata?.full_name as string)?.trim() || 'Mon entreprise';
    const payload: Record<string, unknown> = {
      id: userId,
      owner_id: userId,
      name: companyName,
      email: userEmail || '',
      siret: (metadata?.siret as string) || '',
      address: (metadata?.address as string) || '',
      postal_code: (metadata?.postal_code as string) || '',
      city: (metadata?.city as string) || '',
      country: (metadata?.country as string) || 'France',
      phone: (metadata?.phone as string) || '',
    };

    const { error } = await supabase.from('companies').upsert(payload).select().single();
    if (error) {
      throw new Error(`[DB] ensureCompanyExists: ${error.message}`);
    }
  },
};
