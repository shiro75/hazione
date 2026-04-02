/**
 * @fileoverview Core type definitions for BizManage France SaaS.
 * Contains all interfaces, enums, and type aliases used across the application
 * including business entities (invoices, quotes, products), user management,
 * shop/e-commerce, and theme configuration.
 */

/** French legal business structure types */
export type LegalStructure = 'SAS' | 'SARL' | 'EI' | 'EURL' | 'SA' | 'SCI' | 'Auto-entrepreneur' | 'SASU';

/** User permission roles within a company */
export type UserRole = 'admin' | 'manager' | 'employee' | 'accountant';

/** French VAT rates: normal (20%), intermediate (10%), reduced (5.5%), super-reduced (2.1%), exempt (0%) */
export type VATRate = 20 | 10 | 5.5 | 2.1 | 0;

export type OrderStatus = 'draft' | 'sent' | 'paid' | 'late' | 'cancelled';

/** Invoice lifecycle states — validated invoices cannot be modified (anti-fraud compliance) */
export type InvoiceStatus = 'draft' | 'validated' | 'sent' | 'paid' | 'late' | 'cancelled' | 'partial';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired' | 'cancelled';

export type CreditNoteStatus = 'draft' | 'validated' | 'sent';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'purchase_in' | 'sale_out' | 'inventory_correction';

export type ExpenseCategory =
  | 'office'
  | 'travel'
  | 'marketing'
  | 'software'
  | 'salary'
  | 'rent'
  | 'insurance'
  | 'taxes'
  | 'other';

export type CashMovementType = 'income' | 'expense';

export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type SupplierInvoiceStatus = 'received' | 'to_pay' | 'paid' | 'late';

export type ReminderLevel = 1 | 2 | 3;

export type SaleStatus = 'paid' | 'refunded';

export type SalePaymentMethod = 'cash' | 'card' | 'transfer' | 'twint' | 'check' | 'mobile' | 'mobile_wave' | 'mobile_om' | 'mixed';

export interface MixedPaymentEntry {
  method: SalePaymentMethod;
  amount: number;
}

export interface Sale {
  id: string;
  companyId: string;
  saleNumber: string;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paymentMethod: SalePaymentMethod;
  mobilePhone?: string;
  mobileRef?: string;
  mixedPayments?: MixedPaymentEntry[];
  status: SaleStatus;
  refundedAt?: string;
  refundedSaleId?: string;
  convertedToInvoiceId?: string;
  createdAt: string;
  _offline?: boolean;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'validate'
  | 'cancel'
  | 'send'
  | 'payment'
  | 'convert'
  | 'lock'
  | 'refund';

export type AuditEntityType =
  | 'invoice'
  | 'order'
  | 'quote'
  | 'credit_note'
  | 'client'
  | 'product'
  | 'payment'
  | 'user'
  | 'company'
  | 'expense'
  | 'sale'
  | 'supplier'
  | 'purchase_order'
  | 'supplier_invoice'
  | 'stock_movement'
  | 'reminder';

export type ReminderType = 'payment_due' | 'payment_overdue_7' | 'payment_overdue_14' | 'payment_overdue_30';

export type SubscriptionPlan = 'starter' | 'pro' | 'business';

export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due';

/** Company profile and configuration — appears on invoices and legal documents */
export interface Company {
  id: string;
  name: string;
  legalStructure: LegalStructure;
  siret: string;
  vatNumber: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bic: string;
  defaultVatRate: VATRate;
  paymentTermsDays: number;
  invoicePrefix: string;
  invoiceNextNumber: number;
  quotePrefix: string;
  quoteNextNumber: number;
  creditNotePrefix: string;
  creditNoteNextNumber: number;
  purchaseOrderPrefix: string;
  purchaseOrderNextNumber: number;
  supplierInvoicePrefix: string;
  supplierInvoiceNextNumber: number;
  vatExempt: boolean;
  vatExemptArticle?: string;
  reminderEnabled: boolean;
  reminderDays: number[];
  lateFeeRate: number;
  electronicInvoicingReady: boolean;
  currency: string;
  logoUrl?: string;
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/** Product catalog entry with pricing, stock thresholds, and categorization */
export interface Product {
  id: string;
  companyId: string;
  name: string;
  description: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  categoryName?: string;
  supplierId?: string;
  supplierName?: string;
  brand?: string;
  purchasePrice: number;
  salePrice: number;
  vatRate: VATRate;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  type: ProductType;
  photoUrl?: string;
  imageUrls?: string[];
  isActive: boolean;
  isArchived: boolean;
  usedInValidatedInvoice: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  orderId?: string;
  createdAt: string;
  createdBy: string;
}

/** Client record — can be a company or individual, with billing and contact info */
export interface Client {
  id: string;
  companyId: string;
  type: 'company' | 'individual';
  companyName?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  vatNumber?: string;
  siret?: string;
  notes: string;
  discountPercent?: number;
  discountCategory?: string;
  totalOrders: number;
  totalRevenue: number;
  marginTotal: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductType = 'matiere_premiere' | 'consommable' | 'produit_transforme' | 'produit_revendu' | 'service';

export type ProductStatus = 'active' | 'inactive';

export type ProductUnit = 'piece' | 'kg' | 'litre' | 'm2' | 'boite' | 'heure' | 'jour' | 'forfait' | 'lot' | 'metre' | 'other';

export interface ProductCategory {
  id: string;
  companyId: string;
  name: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  companyId: string;
  attributes: Record<string, string>;
  sku: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  imageUrls?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAttribute {
  id: string;
  companyId: string;
  name: string;
  values: string[];
  createdAt: string;
}

export interface EmailSendLog {
  id: string;
  companyId: string;
  documentType: 'invoice' | 'quote';
  documentId: string;
  documentNumber: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

export interface Order {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paidAmount: number;
  issueDate: string;
  dueDate: string;
  notes: string;
  createdAt: string;
}

/** Sales invoice with line items, totals, and compliance fields (e-invoicing ready) */
export interface Invoice {
  id: string;
  companyId: string;
  orderId?: string;
  quoteId?: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  items: OrderItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paidAmount: number;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  legalMentions: string;
  isValidated: boolean;
  isLocked: boolean;
  validatedAt?: string;
  electronicReady: boolean;
  xmlStructure?: string;
  creditNoteId?: string;
  createdAt: string;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: VATRate;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

/** Quote/estimate that can be converted to an invoice upon acceptance */
export interface Quote {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  quoteNumber: string;
  status: QuoteStatus;
  items: QuoteItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  issueDate: string;
  expirationDate: string;
  acceptedAt?: string;
  acceptedBy?: string;
  convertedToInvoiceId?: string;
  notes: string;
  createdAt: string;
}

export interface CreditNote {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  creditNoteNumber: string;
  status: CreditNoteStatus;
  items: OrderItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  reason: string;
  issueDate: string;
  isValidated: boolean;
  validatedAt?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  companyId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  vatAmount: number;
  vatRate: VATRate;
  date: string;
  supplier: string;
  reference: string;
  isRecurring: boolean;
  createdAt: string;
}

export type TreasuryJournal = 'cash' | 'bank' | 'card' | 'other';

export interface CashMovement {
  id: string;
  companyId: string;
  type: CashMovementType;
  amount: number;
  description: string;
  category: string;
  date: string;
  invoiceId?: string;
  expenseId?: string;
  balance: number;
  sourceType?: string;
  sourceRef?: string;
  journal?: TreasuryJournal;
  createdAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  vatNumber?: string;
  siret?: string;
  notes: string;
  paymentConditions: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  quantityReceived?: number;
  unitPrice: number;
  taxRate: VATRate;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName?: string;
  number: string;
  status: PurchaseOrderStatus;
  date: string;
  expectedDate?: string;
  notes: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInvoiceItem {
  id: string;
  supplierInvoiceId: string;
  productId?: string;
  productName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: VATRate;
  total: number;
}

export interface SupplierInvoice {
  id: string;
  companyId: string;
  supplierId: string;
  supplierName?: string;
  purchaseOrderId?: string;
  number: string;
  supplierInvoiceNumber?: string;
  status: SupplierInvoiceStatus;
  date: string;
  dueDate: string;
  notes: string;
  items: SupplierInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  attachmentUrl?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementRecord {
  id: string;
  companyId: string;
  productId: string;
  productName?: string;
  variantId?: string;
  type: StockMovementType;
  quantity: number;
  reference: string;
  notes: string;
  createdAt: string;
}

export interface ReminderLogRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber?: string;
  clientName?: string;
  sentAt: string;
  level: ReminderLevel;
  method: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  companyId: string;
  orderId?: string;
  invoiceId?: string;
  amount: number;
  method: 'bank_transfer' | 'card' | 'check' | 'cash' | 'stripe';
  reference: string;
  paidAt: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  monthlyPrice: number;
  maxUsers: number;
  maxInvoicesPerMonth: number;
  maxStorageGb: number;
  features: string[];
}

export interface UsageMetric {
  id: string;
  companyId: string;
  metric: string;
  value: number;
  limit: number;
  period: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  action: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface ReminderLog {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  type: ReminderType;
  sentAt: string;
  sentBy: 'auto' | 'manual';
  emailTo: string;
  status: 'sent' | 'failed' | 'pending';
}

export type PaymentReminderChannel = 'sms' | 'whatsapp';

export interface PaymentReminderLog {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  channel: PaymentReminderChannel;
  amountDue: number;
  message: string;
  sentAt: string;
  createdAt: string;
}

export interface DashboardStats {
  revenue: number;
  revenueChange: number;
  revenuePreviousPeriod: number;
  ordersCount: number;
  ordersChange: number;
  clientsCount: number;
  clientsChange: number;
  outstandingAmount: number;
  outstandingChange: number;
  vatCollected: number;
  vatCollectedByRate: Record<string, number>;
  margin: number;
  marginPercent: number;
  marginPreviousPeriod: number;
  cashPosition: number;
  projectedEndOfMonth: number;
  projectedEndOfYear: number;
  growthRate: number;
  cashShortageRisk: boolean;
  topClients: { name: string; revenue: number; margin: number }[];
  stockTotalCost: number;
  quotesAccepted: number;
  quotesTotal: number;
  averagePaymentDays: number;
  monthlyExpenses: number;
  realMargin: number;
  lowStockAlerts: number;
  supplierInvoicesToPay: number;
  supplierInvoicesToPayAmount: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
  margin: number;
  cashflow: number;
}

export interface ForecastData {
  month: string;
  projected: number;
  actual?: number;
  confidence: number;
}

export type DeliveryNoteStatus = 'preparation' | 'shipped' | 'delivered';

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

export type RecurringInvoiceStatus = 'active' | 'paused';

export interface RecurringInvoice {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  items: OrderItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  lastGeneratedAt?: string;
  nextGenerationDate: string;
  status: RecurringInvoiceStatus;
  notes: string;
  createdAt: string;
}

export interface DeliveryNote {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  deliveryNumber: string;
  status: DeliveryNoteStatus;
  items: OrderItem[];
  shippedAt?: string;
  deliveredAt?: string;
  notes: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WarehouseTransfer {
  id: string;
  companyId: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  productId: string;
  productName: string;
  quantity: number;
  notes: string;
  createdAt: string;
}

export type ModuleKey = 'dashboard' | 'clients' | 'products' | 'sales' | 'quotes' | 'invoices' | 'cashflow' | 'settings' | 'admin' | 'ventes' | 'achats' | 'stock' | 'shop' | 'payments';

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  description: string;
  alwaysEnabled: boolean;
  plans: SubscriptionPlan[];
}

export type ShopOrderStatus = 'en_attente' | 'confirmee' | 'livree' | 'annulee';

export type ShopDeliveryMode = 'pickup' | 'shipping';

export type ShopPaymentMethod = 'in_store' | 'bank_transfer' | 'on_delivery';

/** Online shop configuration — each company has one shop with a unique slug */
export interface Shop {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  primaryColor: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  welcomeMessage: string;
  deliveryPickup: boolean;
  deliveryShipping: boolean;
  shippingPrice: number;
  paymentInStore: boolean;
  paymentBankTransfer: boolean;
  bankDetails: string;
  paymentOnDelivery: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Customer order placed through the online shop */
export interface ShopOrder {
  id: string;
  companyId: string;
  shopId: string;
  orderNumber: string;
  status: ShopOrderStatus;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  deliveryMode: ShopDeliveryMode;
  paymentMethod: string;
  subtotalHt: number;
  tvaAmount: number;
  shippingCost: number;
  totalTtc: number;
  notes: string;
  items: ShopOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ShopOrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantInfo: Record<string, string>;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  variantInfo: Record<string, string>;
  unitPrice: number;
  quantity: number;
  photoUrl?: string;
  maxStock: number;
}

export type CinetPayTransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export type CinetPayPaymentMethod = 'wave' | 'orange_money' | 'mtn' | 'card' | 'moov' | 'other';

export interface PaymentTransaction {
  id: string;
  companyId: string;
  saleId?: string;
  amount: number;
  currency: string;
  paymentMethod: CinetPayPaymentMethod;
  cinetpayPaymentId?: string;
  cinetpayPaymentUrl?: string;
  cinetpayToken?: string;
  status: CinetPayTransactionStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PaymentProvider = 'stripe' | 'cinetpay';

export type UnifiedPaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export type PaymentMethodType = 'card' | 'wave' | 'orange_money' | 'mtn' | 'moov' | 'bank_transfer' | 'other';

export interface UnifiedPayment {
  id: string;
  companyId: string;
  saleId?: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerTransactionId?: string;
  providerPaymentUrl?: string;
  providerClientSecret?: string;
  paymentMethodType: PaymentMethodType;
  status: UnifiedPaymentStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SavedPaymentMethod {
  id: string;
  userId: string;
  provider: PaymentProvider;
  type: PaymentMethodType;
  lastFour?: string;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Store {
  id: string;
  companyId: string;
  name: string;
  address: string;
  phone: string;
  warehouseId?: string;
  warehouseName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  companyId: string;
  key: string;
  name: string;
  isActive: boolean;
  callsThisMonth: number;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export type ThemeMode = 'light' | 'dark';

/** Complete color palette for light/dark theme — used via useTheme() hook */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  border: string;
  borderLight: string;
  sidebar: string;
  sidebarText: string;
  sidebarTextSecondary: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarBorder: string;
  inputBg: string;
  inputBorder: string;
  shadow: string;
  header: string;
  headerText: string;
  headerIcon: string;
  headerBorder: string;
  tabBar: string;
  tabBarText: string;
  tabBarActive: string;
  tabBarBorder: string;
}
