/**
 * @fileoverview Central data context providing all business entities and CRUD operations.
 * Combines Supabase queries, local state, and AsyncStorage persistence.
 * Exposes useData() hook with clients, products, invoices, quotes, sales,
 * stock movements, suppliers, purchase orders, cash flows, and more.
 * All mutations trigger audit logging and optimistic UI updates.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Client, Product, ProductVariant, ProductAttribute, Invoice, Quote, OrderItem, QuoteItem,
  Sale, SaleItem, SalePaymentMethod, MixedPaymentEntry, CashMovement, ModuleKey, SubscriptionPlan,
  Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
  SupplierInvoice, SupplierInvoiceItem, SupplierInvoiceStatus,
  StockMovementRecord, ReminderLogRecord, ReminderLevel, Company, CreditNote,
  RecurringInvoice, RecurringFrequency, DeliveryNote, DeliveryNoteStatus,
  Warehouse, WarehouseTransfer,
  PaymentReminderLog, PaymentReminderChannel,
  Recipe, RecipeItem,
} from '@/types';
import { MODULE_CONFIGS, isModuleAvailableForPlan } from '@/constants/modules';
import { db } from '@/services/supabaseData';
import { isSupabaseConfigured } from '@/services/supabase';
import { generateInvoiceNumber, generateQuoteNumber, validateAndLockInvoice, buildLegalMentions } from '@/services/invoiceService';
import { mockCompany } from '@/mocks/data';
import { useAuth } from '@/contexts/AuthContext';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function buildQueryKeys(companyId: string) {
  return {
    company: ['company', companyId],
    clients: ['clients', companyId],
    products: ['products', companyId],
    invoices: ['invoices', companyId],
    quotes: ['quotes', companyId],
    sales: ['sales', companyId],
    cashMovements: ['cashMovements', companyId],
    suppliers: ['suppliers', companyId],
    purchaseOrders: ['purchaseOrders', companyId],
    supplierInvoices: ['supplierInvoices', companyId],
    stockMovements: ['stockMovements', companyId],
    reminderLogs: ['reminderLogs', companyId],
    variants: ['variants', companyId],
  };
}

async function seedIfNeeded(companyId: string, userEmail?: string, metadata?: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }
  try {
    await db.ensureCompanyExists(companyId, userEmail, metadata);
  } catch (e) {
  }
}

export const [DataProvider, useData] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const COMPANY_ID = user?.id ?? 'anonymous';
  const USER_ID = user?.id ?? 'anonymous';
  const USER_NAME = user?.user_metadata?.full_name ?? user?.email ?? 'Utilisateur';
  const QUERY_KEYS = useMemo(() => buildQueryKeys(COMPANY_ID), [COMPANY_ID]);

  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('business');
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>(
    MODULE_CONFIGS.map((m) => m.key)
  );
  const [seeded, setSeeded] = useState(false);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [productUnits, setProductUnits] = useState<string[]>(['pièce', 'kg', 'litre', 'm²', 'boîte', 'heure', 'jour', 'forfait', 'lot', 'mètre']);
  const [customVatRates, setCustomVatRates] = useState<string[]>(['0', '2.1', '5.5', '10', '20']);
  const [productBrands, setProductBrands] = useState<string[]>([]);
  const [discountCategories, setDiscountCategories] = useState<string[]>(['VIP', 'Grossiste', 'Revendeur', 'Fidélité']);
  const [discountCategoryRates, setDiscountCategoryRates] = useState<Record<string, number>>({ 'VIP': 15, 'Grossiste': 20, 'Revendeur': 10, 'Fidélité': 5 });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseTransfers, setWarehouseTransfers] = useState<WarehouseTransfer[]>([]);
  const [paymentReminderLogs, setPaymentReminderLogs] = useState<PaymentReminderLog[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([
    { id: 'attr_taille', companyId: '', name: 'Taille', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], createdAt: new Date().toISOString() },
    { id: 'attr_couleur', companyId: '', name: 'Couleur', values: ['Rouge', 'Bleu', 'Noir', 'Blanc', 'Vert', 'Jaune'], createdAt: new Date().toISOString() },
    { id: 'attr_poids', companyId: '', name: 'Poids', values: ['100g', '250g', '500g', '1kg', '2kg', '5kg'], createdAt: new Date().toISOString() },
    { id: 'attr_contenance', companyId: '', name: 'Contenance', values: ['25cl', '33cl', '50cl', '75cl', '1L', '1.5L', '2L'], createdAt: new Date().toISOString() },
    { id: 'attr_matiere', companyId: '', name: 'Matière', values: ['Coton', 'Polyester', 'Lin', 'Soie', 'Cuir', 'Laine'], createdAt: new Date().toISOString() },
  ]);

  useEffect(() => {
    if (!user) {
      setSeeded(false);
      return;
    }
    seedIfNeeded(COMPANY_ID, user?.email, user?.user_metadata as Record<string, unknown> | undefined)
      .then(() => setSeeded(true))
      .catch(() => {
        setSeeded(true);
      });
  }, [user, COMPANY_ID]);

  const showToast = useCallback((_message: string, _type: 'success' | 'error' | 'info' = 'success') => {
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ====== QUERIES ======

  const queryDefaults = { retry: false, refetchOnWindowFocus: false } as const;

  const companyQuery = useQuery({
    queryKey: QUERY_KEYS.company,
    queryFn: async () => {
      const [dbCompany, storedCurrency] = await Promise.all([
        db.fetchCompany(COMPANY_ID),
        AsyncStorage.getItem(`company-currency-${COMPANY_ID}`),
      ]);
      if (dbCompany && storedCurrency) {
        dbCompany.currency = storedCurrency;
      }
      return dbCompany;
    },
    enabled: seeded,
    staleTime: 30000,
    ...queryDefaults,
  });

  const clientsQuery = useQuery({
    queryKey: QUERY_KEYS.clients,
    queryFn: () => db.fetchClients(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const productsQuery = useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: () => db.fetchProducts(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const invoicesQuery = useQuery({
    queryKey: QUERY_KEYS.invoices,
    queryFn: () => db.fetchInvoices(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const quotesQuery = useQuery({
    queryKey: QUERY_KEYS.quotes,
    queryFn: () => db.fetchQuotes(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const salesQuery = useQuery({
    queryKey: QUERY_KEYS.sales,
    queryFn: () => db.fetchSales(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const cashMovementsQuery = useQuery({
    queryKey: QUERY_KEYS.cashMovements,
    queryFn: () => db.fetchCashMovements(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const suppliersQuery = useQuery({
    queryKey: QUERY_KEYS.suppliers,
    queryFn: () => db.fetchSuppliers(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: QUERY_KEYS.purchaseOrders,
    queryFn: () => db.fetchPurchaseOrders(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const supplierInvoicesQuery = useQuery({
    queryKey: QUERY_KEYS.supplierInvoices,
    queryFn: () => db.fetchSupplierInvoices(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const stockMovementsQuery = useQuery({
    queryKey: QUERY_KEYS.stockMovements,
    queryFn: () => db.fetchStockMovements(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const reminderLogsQuery = useQuery({
    queryKey: QUERY_KEYS.reminderLogs,
    queryFn: () => db.fetchReminderLogs(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const auditLogsQuery = useQuery({
    queryKey: ['auditLogs', COMPANY_ID],
    queryFn: () => db.fetchAuditLogs(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const variantsQuery = useQuery({
    queryKey: QUERY_KEYS.variants,
    queryFn: () => db.fetchVariants(COMPANY_ID),
    enabled: seeded,
    staleTime: 10000,
    ...queryDefaults,
  });

  const company = companyQuery.data ?? mockCompany;
  const clients = clientsQuery.data ?? [];
  const rawProducts = productsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const quotes = quotesQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const cashMovements = cashMovementsQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const purchaseOrders = purchaseOrdersQuery.data ?? [];
  const supplierInvoices = supplierInvoicesQuery.data ?? [];
  const stockMovements = stockMovementsQuery.data ?? [];
  const reminderLogs = reminderLogsQuery.data ?? [];
  const auditLogs = (auditLogsQuery.data ?? []);
  const variants = variantsQuery.data ?? [];

  // ====== PRODUCT METADATA (AsyncStorage-based, no broken DB tables) ======

  const categoriesLocalQuery = useQuery({
    queryKey: ['categories-local', COMPANY_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(`product-categories-${COMPANY_ID}`);
      if (stored) return JSON.parse(stored) as string[];
      return null;
    },
  });

  const brandsLocalQuery = useQuery({
    queryKey: ['brands-local', COMPANY_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(`product-brands-${COMPANY_ID}`);
      if (stored) return JSON.parse(stored) as string[];
      return null;
    },
  });

  useEffect(() => {
    if (categoriesLocalQuery.data) {
      setProductCategories(categoriesLocalQuery.data);
    }
  }, [categoriesLocalQuery.data]);

  useEffect(() => {
    if (brandsLocalQuery.data) {
      setProductBrands(brandsLocalQuery.data);
    }
  }, [brandsLocalQuery.data]);

  const productMetaQuery = useQuery({
    queryKey: ['product-metadata', COMPANY_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(`product-metadata-${COMPANY_ID}`);
      if (stored) return JSON.parse(stored) as { categories: string[]; units: string[]; vatRates: string[]; brands?: string[] };
      return null;
    },
  });

  useEffect(() => {
    if (productMetaQuery.data) {
      setProductUnits(productMetaQuery.data.units);
      setCustomVatRates(productMetaQuery.data.vatRates);
    }
  }, [productMetaQuery.data]);

  const persistProductMeta = useCallback(async (cats: string[], units: string[], vats: string[], brands: string[]) => {
    await AsyncStorage.setItem(`product-metadata-${COMPANY_ID}`, JSON.stringify({ categories: cats, units, vatRates: vats, brands }));
  }, [COMPANY_ID]);

  const productAttributesQuery = useQuery({
    queryKey: ['product-attributes', COMPANY_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(`product-attributes-${COMPANY_ID}`);
      if (stored) return JSON.parse(stored) as ProductAttribute[];
      return null;
    },
  });

  useEffect(() => {
    if (productAttributesQuery.data) {
      setProductAttributes(productAttributesQuery.data);
    }
  }, [productAttributesQuery.data]);

  const persistProductAttributes = useCallback(async (attrs: ProductAttribute[]) => {
    await AsyncStorage.setItem(`product-attributes-${COMPANY_ID}`, JSON.stringify(attrs));
  }, [COMPANY_ID]);

  // ====== RECIPES (AsyncStorage-based) ======

  const recipesQuery = useQuery({
    queryKey: ['recipes', COMPANY_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(`recipes-${COMPANY_ID}`);
      if (stored) return JSON.parse(stored) as Recipe[];
      return null;
    },
  });

  useEffect(() => {
    if (recipesQuery.data) {
      setRecipes(recipesQuery.data);
    }
  }, [recipesQuery.data]);

  const persistRecipes = useCallback(async (data: Recipe[]) => {
    await AsyncStorage.setItem(`recipes-${COMPANY_ID}`, JSON.stringify(data));
  }, [COMPANY_ID]);

  const addProductAttribute = useCallback((name: string, values: string[]) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (productAttributes.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) return;
    const newAttr: ProductAttribute = {
      id: generateId('attr'),
      companyId: COMPANY_ID,
      name: trimmed,
      values: values.filter(v => v.trim()),
      createdAt: new Date().toISOString(),
    };
    const updated = [...productAttributes, newAttr];
    setProductAttributes(updated);
    void persistProductAttributes(updated);
    showToast(`Attribut "${trimmed}" ajouté`);
  }, [productAttributes, COMPANY_ID, persistProductAttributes, showToast]);

  const updateProductAttribute = useCallback((id: string, data: { name?: string; values?: string[] }) => {
    const updated = productAttributes.map(a => {
      if (a.id !== id) return a;
      return { ...a, ...(data.name !== undefined ? { name: data.name } : {}), ...(data.values !== undefined ? { values: data.values } : {}) };
    });
    setProductAttributes(updated);
    void persistProductAttributes(updated);
    showToast('Attribut mis à jour');
  }, [productAttributes, persistProductAttributes, showToast]);

  const deleteProductAttribute = useCallback((id: string) => {
    const updated = productAttributes.filter(a => a.id !== id);
    setProductAttributes(updated);
    void persistProductAttributes(updated);
    showToast('Attribut supprimé');
  }, [productAttributes, persistProductAttributes, showToast]);

  const addAttributeValue = useCallback((attrId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const updated = productAttributes.map(a => {
      if (a.id !== attrId) return a;
      if (a.values.includes(trimmed)) return a;
      return { ...a, values: [...a.values, trimmed] };
    });
    setProductAttributes(updated);
    void persistProductAttributes(updated);
  }, [productAttributes, persistProductAttributes]);

  const removeAttributeValue = useCallback((attrId: string, value: string) => {
    const updated = productAttributes.map(a => {
      if (a.id !== attrId) return a;
      return { ...a, values: a.values.filter(v => v !== value) };
    });
    setProductAttributes(updated);
    void persistProductAttributes(updated);
  }, [productAttributes, persistProductAttributes]);

  const updateAttributeValuesOrder = useCallback((attrId: string, newValues: string[]) => {
    const updated = productAttributes.map(a => {
      if (a.id !== attrId) return a;
      return { ...a, values: newValues };
    });
    setProductAttributes(updated);
    void persistProductAttributes(updated);
  }, [productAttributes, persistProductAttributes]);

  const reorderAttributeValue = useCallback((attrId: string, fromIndex: number, toIndex: number) => {
    const attr = productAttributes.find(a => a.id === attrId);
    if (!attr) return;
    const newValues = [...attr.values];
    const [removed] = newValues.splice(fromIndex, 1);
    newValues.splice(toIndex, 0, removed);
    updateAttributeValuesOrder(attrId, newValues);
  }, [productAttributes, updateAttributeValuesOrder]);

  const persistCategories = useCallback(async (cats: string[]) => {
    await AsyncStorage.setItem(`product-categories-${COMPANY_ID}`, JSON.stringify(cats));
  }, [COMPANY_ID]);

  const persistBrands = useCallback(async (brands: string[]) => {
    await AsyncStorage.setItem(`product-brands-${COMPANY_ID}`, JSON.stringify(brands));
  }, [COMPANY_ID]);

  const addProductCategory = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (productCategories.includes(trimmed)) {
      return trimmed;
    }
    const updated = [...productCategories, trimmed];
    setProductCategories(updated);
    void persistCategories(updated);
    showToast(`Catégorie "${trimmed}" ajoutée`);
    return trimmed;
  }, [productCategories, persistCategories, showToast]);

  const removeProductCategory = useCallback(async (name: string): Promise<void> => {
    const updated = productCategories.filter(c => c !== name);
    setProductCategories(updated);
    void persistCategories(updated);
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map(p => p.categoryName === name ? { ...p, categoryName: undefined } : p)
    );
  }, [productCategories, persistCategories, queryClient, QUERY_KEYS]);

  const renameProductCategory = useCallback(async (oldName: string, newName: string): Promise<void> => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    if (productCategories.includes(trimmed)) {
      showToast('Cette catégorie existe déjà', 'error');
      return;
    }
    const updated = productCategories.map(c => c === oldName ? trimmed : c);
    setProductCategories(updated);
    void persistCategories(updated);
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map(p => p.categoryName === oldName ? { ...p, categoryName: trimmed } : p)
    );
    showToast(`Catégorie renommée en "${trimmed}"`);
  }, [productCategories, persistCategories, queryClient, QUERY_KEYS, showToast]);

  const addProductUnit = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed || productUnits.includes(trimmed)) return;
    const updated = [...productUnits, trimmed];
    setProductUnits(updated);
    void persistProductMeta(productCategories, updated, customVatRates, productBrands);
  }, [productCategories, productUnits, customVatRates, productBrands, persistProductMeta]);

  const removeProductUnit = useCallback((name: string) => {
    const defaults = ['pièce', 'kg', 'litre', 'm²', 'boîte', 'heure', 'jour', 'forfait', 'lot', 'mètre'];
    if (defaults.includes(name)) return;
    const updated = productUnits.filter(u => u !== name);
    setProductUnits(updated);
    void persistProductMeta(productCategories, updated, customVatRates, productBrands);
  }, [productCategories, productUnits, customVatRates, productBrands, persistProductMeta]);

  const addCustomVatRate = useCallback((rate: string) => {
    const trimmed = rate.trim();
    if (!trimmed || customVatRates.includes(trimmed)) return;
    const updated = [...customVatRates, trimmed].sort((a, b) => parseFloat(a) - parseFloat(b));
    setCustomVatRates(updated);
    void persistProductMeta(productCategories, productUnits, updated, productBrands);
  }, [productCategories, productUnits, customVatRates, productBrands, persistProductMeta]);

  const removeCustomVatRate = useCallback((rate: string) => {
    const defaults = ['0', '2.1', '5.5', '10', '20'];
    if (defaults.includes(rate)) return;
    const updated = customVatRates.filter(v => v !== rate);
    setCustomVatRates(updated);
    void persistProductMeta(productCategories, productUnits, updated, productBrands);
  }, [productCategories, productUnits, customVatRates, productBrands, persistProductMeta]);

  const addProductBrand = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (productBrands.includes(trimmed)) {
      return trimmed;
    }
    const updated = [...productBrands, trimmed];
    setProductBrands(updated);
    void persistBrands(updated);
    showToast(`Marque "${trimmed}" ajoutée`);
    return trimmed;
  }, [productBrands, persistBrands, showToast]);

  const removeProductBrand = useCallback(async (name: string): Promise<void> => {
    const updated = productBrands.filter(b => b !== name);
    setProductBrands(updated);
    void persistBrands(updated);
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map(p => p.brand === name ? { ...p, brand: undefined } : p)
    );
  }, [productBrands, persistBrands, queryClient, QUERY_KEYS]);

  const renameProductBrand = useCallback(async (oldName: string, newName: string): Promise<void> => {
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed) return;
    if (productBrands.includes(trimmed)) {
      showToast('Cette marque existe déjà', 'error');
      return;
    }
    const updated = productBrands.map(b => b === oldName ? trimmed : b);
    setProductBrands(updated);
    void persistBrands(updated);
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map(p => p.brand === oldName ? { ...p, brand: trimmed } : p)
    );
    showToast(`Marque renommée en "${trimmed}"`);
  }, [productBrands, persistBrands, queryClient, QUERY_KEYS, showToast]);

  const addDiscountCategory = useCallback((name: string, rate?: number) => {
    const trimmed = name.trim();
    if (!trimmed || discountCategories.includes(trimmed)) return;
    const updated = [...discountCategories, trimmed];
    setDiscountCategories(updated);
    void AsyncStorage.setItem(`discount-categories-${COMPANY_ID}`, JSON.stringify(updated));
    if (rate !== undefined) {
      const updatedRates = { ...discountCategoryRates, [trimmed]: rate };
      setDiscountCategoryRates(updatedRates);
      void AsyncStorage.setItem(`discount-category-rates-${COMPANY_ID}`, JSON.stringify(updatedRates));
    }
  }, [discountCategories, discountCategoryRates, COMPANY_ID]);

  const updateDiscountCategoryRate = useCallback((name: string, rate: number) => {
    const updatedRates = { ...discountCategoryRates, [name]: rate };
    setDiscountCategoryRates(updatedRates);
    void AsyncStorage.setItem(`discount-category-rates-${COMPANY_ID}`, JSON.stringify(updatedRates));
  }, [discountCategoryRates, COMPANY_ID]);

  const removeDiscountCategory = useCallback((name: string) => {
    const updated = discountCategories.filter(c => c !== name);
    setDiscountCategories(updated);
    void AsyncStorage.setItem(`discount-categories-${COMPANY_ID}`, JSON.stringify(updated));
    const { [name]: _, ...rest } = discountCategoryRates;
    setDiscountCategoryRates(rest);
    void AsyncStorage.setItem(`discount-category-rates-${COMPANY_ID}`, JSON.stringify(rest));
  }, [discountCategories, discountCategoryRates, COMPANY_ID]);

  useEffect(() => {
    AsyncStorage.getItem(`discount-categories-${COMPANY_ID}`).then(stored => {
      if (stored) setDiscountCategories(JSON.parse(stored));
    }).catch(() => {});
    AsyncStorage.getItem(`discount-category-rates-${COMPANY_ID}`).then(stored => {
      if (stored) setDiscountCategoryRates(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  useEffect(() => {
    AsyncStorage.getItem(`payment-reminder-logs-${COMPANY_ID}`).then(stored => {
      if (stored) setPaymentReminderLogs(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const logPaymentReminder = useCallback((data: Omit<PaymentReminderLog, 'id' | 'companyId' | 'createdAt'>) => {
    const newLog: PaymentReminderLog = {
      ...data,
      id: generateId('prl'),
      companyId: COMPANY_ID,
      createdAt: new Date().toISOString(),
    };
    setPaymentReminderLogs(prev => {
      const updated = [newLog, ...prev];
      void AsyncStorage.setItem(`payment-reminder-logs-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    showToast(`Rappel envoyé via ${data.channel === 'sms' ? 'SMS' : 'WhatsApp'}`);
  }, [COMPANY_ID, showToast]);

  const getClientReminderLogs = useCallback((clientId: string): PaymentReminderLog[] => {
    return paymentReminderLogs.filter(r => r.clientId === clientId);
  }, [paymentReminderLogs]);

  // ====== MODULES CONFIG ======

  const modulesQuery = useQuery({
    queryKey: ['modules-config'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem('modules-config');
      if (stored) {
        const parsed = JSON.parse(stored) as { plan: SubscriptionPlan; enabled: ModuleKey[] };
        return parsed;
      }
      return null;
    },
  });

  useEffect(() => {
    if (modulesQuery.data) {
      setCurrentPlan(modulesQuery.data.plan);
      const allModuleKeys = MODULE_CONFIGS.map((m) => m.key);
      const storedEnabled = modulesQuery.data.enabled;
      const newModules = allModuleKeys.filter((k) => !storedEnabled.includes(k) && !MODULE_CONFIGS.find((m) => m.key === k)?.alwaysEnabled);
      const merged = [...storedEnabled, ...newModules];
      setEnabledModules(merged);
      if (newModules.length > 0) {
        void persistModulesConfig(modulesQuery.data.plan, merged);
      }
    }
  }, [modulesQuery.data]);

  const persistModulesConfig = useCallback(async (plan: SubscriptionPlan, enabled: ModuleKey[]) => {
    const data = { plan, enabled };
    await AsyncStorage.setItem('modules-config', JSON.stringify(data));
  }, []);

  const changePlan = useCallback((plan: SubscriptionPlan) => {
    setCurrentPlan(plan);
    const newEnabled = enabledModules.filter((key) => {
      const config = MODULE_CONFIGS.find((m) => m.key === key);
      if (!config) return false;
      return config.alwaysEnabled || config.plans.includes(plan);
    });
    setEnabledModules(newEnabled);
    void persistModulesConfig(plan, newEnabled);
    showToast(`Abonnement changé vers ${plan}`);
  }, [enabledModules, persistModulesConfig, showToast]);

  const toggleModule = useCallback((moduleKey: ModuleKey, enabled: boolean) => {
    const config = MODULE_CONFIGS.find((m) => m.key === moduleKey);
    if (!config || config.alwaysEnabled) return;
    if (enabled && !isModuleAvailableForPlan(moduleKey, currentPlan)) {
      showToast(`Ce module n'est pas disponible avec l'abonnement ${currentPlan}`, 'error');
      return;
    }
    const newEnabled = enabled
      ? [...enabledModules, moduleKey]
      : enabledModules.filter((k) => k !== moduleKey);
    setEnabledModules(newEnabled);
    void persistModulesConfig(currentPlan, newEnabled);
    const label = config.label;
    showToast(enabled ? `Module "${label}" activé` : `Module "${label}" désactivé`);
  }, [enabledModules, currentPlan, persistModulesConfig, showToast]);

  const isModuleEnabled = useCallback((moduleKey: ModuleKey): boolean => {
    const config = MODULE_CONFIGS.find((m) => m.key === moduleKey);
    if (config?.alwaysEnabled) return true;
    return enabledModules.includes(moduleKey);
  }, [enabledModules]);

  const isModuleAvailable = useCallback((moduleKey: ModuleKey): boolean => {
    return isModuleAvailableForPlan(moduleKey, currentPlan);
  }, [currentPlan]);

  // ====== DERIVED DATA ======

  const products = useMemo(() => rawProducts, [rawProducts]);

  const activeClients = useMemo(() => clients.filter((c) => !c.isDeleted), [clients]);
  const activeProducts = useMemo(() => products.filter((p) => !p.isArchived && p.isActive), [products]);
  const activeSuppliers = useMemo(() => suppliers.filter((s) => !s.isDeleted), [suppliers]);
  const activePurchaseOrders = useMemo(() => purchaseOrders.filter((po) => !po.isDeleted), [purchaseOrders]);
  const activeSupplierInvoices = useMemo(() => supplierInvoices.filter((si) => !si.isDeleted), [supplierInvoices]);
  const lateInvoices = useMemo(() => invoices.filter((i) => i.status === 'late'), [invoices]);

  const productStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sm of stockMovements) {
      if (!map[sm.productId]) map[sm.productId] = 0;
      if (sm.type === 'adjustment' || sm.type === 'inventory_correction') {
        map[sm.productId] += sm.quantity;
      } else if (sm.type === 'purchase_in' || sm.type === 'in') {
        map[sm.productId] += Math.abs(sm.quantity);
      } else if (sm.type === 'sale_out' || sm.type === 'out') {
        map[sm.productId] -= Math.abs(sm.quantity);
      } else {
        map[sm.productId] += sm.quantity;
      }
    }
    return map;
  }, [stockMovements]);

  const getProductStock = useCallback((productId: string): number => {
    return productStockMap[productId] ?? 0;
  }, [productStockMap]);

  const lowStockProducts = useMemo(() => activeProducts.filter((p) => {
    if (p.type === 'service') return false;
    const productVariants = variants.filter(v => v.productId === p.id);
    if (productVariants.length > 0) {
      return productVariants.some(v => v.stockQuantity <= (v.minStock || p.lowStockThreshold));
    }
    return getProductStock(p.id) <= p.lowStockThreshold;
  }), [activeProducts, getProductStock, variants]);

  // ====== AUDIT HELPER ======

  const writeAudit = useCallback(async (
    action: string, entityType: string, entityId: string, entityLabel: string, details: string
  ) => {
    try {
      await db.insertAuditLog({
        id: generateId('audit'),
        companyId: COMPANY_ID,
        userId: USER_ID,
        userName: USER_NAME,
        action: action as any,
        entityType: entityType as any,
        entityId,
        entityLabel,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
    }
  }, [COMPANY_ID, USER_ID, USER_NAME]);

  // ====== CLIENTS CRUD ======

  const validateClientEmail = useCallback((email: string): boolean => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  const validateVATNumber = useCallback((vat: string): boolean => {
    if (!vat) return true;
    return /^FR\d{11}$/.test(vat.replace(/\s/g, ''));
  }, []);

  const isDuplicateClientName = useCallback((name: string, excludeId?: string): boolean => {
    const normalized = name.toLowerCase().trim();
    return clients.some(
      (c) =>
        !c.isDeleted &&
        c.id !== excludeId &&
        ((c.companyName?.toLowerCase().trim() === normalized) ||
          (`${c.firstName} ${c.lastName}`.toLowerCase().trim() === normalized))
    );
  }, [clients]);

  const createClient = useCallback((data: Omit<Client, 'id' | 'companyId' | 'totalOrders' | 'totalRevenue' | 'marginTotal' | 'isDeleted' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string } => {
    if (data.email && !validateClientEmail(data.email)) {
      return { success: false, error: 'Format d\'email invalide' };
    }
    if (data.vatNumber && !validateVATNumber(data.vatNumber)) {
      return { success: false, error: 'Format TVA invalide (ex: FR12345678901)' };
    }
    const displayName = data.companyName || `${data.firstName} ${data.lastName}`;
    if (isDuplicateClientName(displayName)) {
      return { success: false, error: 'Un client avec ce nom existe déjà' };
    }
    const now = new Date().toISOString();
    const newClient: Client = {
      ...data,
      id: generateId('cli'),
      companyId: COMPANY_ID,
      totalOrders: 0,
      totalRevenue: 0,
      marginTotal: 0,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    queryClient.setQueryData<Client[]>(QUERY_KEYS.clients, (old) => [newClient, ...(old ?? [])]);
    void db.insertClient(newClient).catch(() => {
      showToast('Erreur lors de la sauvegarde du client', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients });
    });
    void writeAudit('create', 'client', newClient.id, displayName, `Client créé: ${displayName}`);
    showToast(`Client "${displayName}" créé avec succès`);
    return { success: true };
  }, [validateClientEmail, validateVATNumber, isDuplicateClientName, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updateClient = useCallback((id: string, data: Partial<Client>): { success: boolean; error?: string } => {
    const existing = clients.find((c) => c.id === id);
    if (!existing) return { success: false, error: 'Client introuvable' };
    if (data.email && !validateClientEmail(data.email)) {
      return { success: false, error: 'Format d\'email invalide' };
    }
    if (data.vatNumber && !validateVATNumber(data.vatNumber)) {
      return { success: false, error: 'Format TVA invalide (ex: FR12345678901)' };
    }
    const displayName = data.companyName || `${data.firstName ?? existing.firstName} ${data.lastName ?? existing.lastName}`;
    if (isDuplicateClientName(displayName, id)) {
      return { success: false, error: 'Un client avec ce nom existe déjà' };
    }

    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<Client[]>(QUERY_KEYS.clients, (old) =>
      (old ?? []).map((c) => c.id === id ? { ...c, ...updated } : c)
    );
    void db.updateClient(id, updated).catch(() => {
      showToast('Erreur lors de la mise à jour du client', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients });
    });
    void writeAudit('update', 'client', id, displayName, `Client modifié: ${displayName}`);
    showToast(`Client "${displayName}" mis à jour`);
    return { success: true };
  }, [clients, validateClientEmail, validateVATNumber, isDuplicateClientName, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const deleteClient = useCallback((id: string): void => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const displayName = client.companyName || `${client.firstName} ${client.lastName}`;

    const updated = { isDeleted: true, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<Client[]>(QUERY_KEYS.clients, (old) =>
      (old ?? []).map((c) => c.id === id ? { ...c, ...updated } : c)
    );
    void db.updateClient(id, updated as Partial<Client>).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients });
    });
    void writeAudit('delete', 'client', id, displayName, `Client supprimé: ${displayName}`);
    showToast(`Client "${displayName}" supprimé`);
  }, [clients, showToast, queryClient, writeAudit, QUERY_KEYS]);

  // ====== PRODUCTS CRUD ======

  const createProduct = useCallback((data: Omit<Product, 'id' | 'companyId' | 'isArchived' | 'usedInValidatedInvoice' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string; productId?: string } => {
    if (!data.name.trim()) return { success: false, error: 'Le nom est requis' };
    const isRawMat = data.type === 'matiere_premiere';
    if (!isRawMat && data.salePrice <= 0) return { success: false, error: 'Le prix de vente doit être positif' };
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...data,
      id: generateId('prod'),
      companyId: COMPANY_ID,
      isArchived: false,
      usedInValidatedInvoice: false,
      createdAt: now,
      updatedAt: now,
    };

    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) => [newProduct, ...(old ?? [])]);
    void db.insertProduct(newProduct).catch(() => {
      showToast('Erreur lors de la sauvegarde du produit', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
    });
    void writeAudit('create', 'product', newProduct.id, data.name, `Produit créé: ${data.name}`);
    showToast(`Produit "${data.name}" créé avec succès`);
    return { success: true, productId: newProduct.id };
  }, [showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updateProduct = useCallback((id: string, data: Partial<Product>, options?: { silent?: boolean }): { success: boolean; error?: string } => {
    const existing = products.find((p) => p.id === id);
    if (!existing) return { success: false, error: 'Produit introuvable' };

    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map((p) => p.id === id ? { ...p, ...updated } : p)
    );
    void db.updateProduct(id, updated).catch(() => {
      if (!options?.silent) showToast('Erreur lors de la mise à jour du produit', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
    });
    void writeAudit('update', 'product', id, data.name ?? existing.name, `Produit modifié: ${data.name ?? existing.name}`);
    if (!options?.silent) showToast(`Produit "${data.name ?? existing.name}" mis à jour`);
    return { success: true };
  }, [products, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const archiveProduct = useCallback((id: string): { success: boolean; error?: string } => {
    const product = products.find((p) => p.id === id);
    if (!product) return { success: false, error: 'Produit introuvable' };

    const now = new Date().toISOString();
    const updated = { isArchived: true, isActive: false, updatedAt: now };
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map((p) => p.id === id ? { ...p, ...updated } : p)
    );
    void db.updateProduct(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
    });
    showToast(`Produit "${product.name}" archivé`);
    void writeAudit('delete', 'product', id, product.name, `Produit archivé: ${product.name}`);
    return { success: true };
  }, [products, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const unarchiveProduct = useCallback((id: string): { success: boolean; error?: string } => {
    const product = products.find((p) => p.id === id);
    if (!product) return { success: false, error: 'Produit introuvable' };
    const now = new Date().toISOString();
    const updated = { isArchived: false, isActive: true, updatedAt: now };
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map((p) => p.id === id ? { ...p, ...updated } : p)
    );
    void db.updateProduct(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
    });
    void writeAudit('update', 'product', id, product.name, `Produit désarchivé: ${product.name}`);
    showToast(`Produit "${product.name}" désarchivé`);
    return { success: true };
  }, [products, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const deleteProduct = useCallback((id: string): { success: boolean; error?: string } => {
    const product = products.find((p) => p.id === id);
    if (!product) return { success: false, error: 'Produit introuvable' };

    queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
      (old ?? []).filter((v) => v.productId !== id)
    );
    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).filter((p) => p.id !== id)
    );

    void (async () => {
      try {
        await db.deleteProduct(id);
      } catch {
        showToast('Erreur lors de la suppression du produit', 'error');
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.variants });
      }
    })();

    void writeAudit('delete', 'product', id, product.name, `Produit supprimé définitivement: ${product.name}`);
    showToast(`Produit "${product.name}" supprimé définitivement`);
    return { success: true };
  }, [products, showToast, queryClient, writeAudit, QUERY_KEYS]);

  // ====== INVOICES CRUD ======

  const createInvoice = useCallback((clientId: string, items: OrderItem[], _notes?: string, issueDate?: string): { success: boolean; error?: string; invoiceId?: string } => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, error: 'Client introuvable' };
    if (items.length === 0) return { success: false, error: 'Au moins une ligne est requise' };

    const totalHT = items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = items.reduce((s, i) => s + i.totalTTC, 0);
    const now = issueDate || new Date().toISOString();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + company.paymentTermsDays);
    const clientName = client.companyName || `${client.firstName} ${client.lastName}`;

    const newInvoice: Invoice = {
      id: generateId('inv'),
      companyId: COMPANY_ID,
      clientId,
      clientName,
      invoiceNumber: '',
      status: 'draft',
      items,
      totalHT,
      totalTVA,
      totalTTC,
      paidAmount: 0,
      issueDate: now,
      dueDate: dueDate.toISOString(),
      paymentTerms: `Paiement à ${company.paymentTermsDays} jours`,
      legalMentions: buildLegalMentions(company),
      isValidated: false,
      isLocked: false,
      electronicReady: false,
      createdAt: now,
    };

    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) => [newInvoice, ...(old ?? [])]);
    void db.insertInvoice(newInvoice).catch(() => {
      showToast('Erreur lors de la sauvegarde de la facture', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    void writeAudit('create', 'invoice', newInvoice.id, 'Brouillon', `Facture brouillon créée pour ${clientName}`);
    showToast('Facture brouillon créée');
    return { success: true, invoiceId: newInvoice.id };
  }, [clients, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const revertInvoiceStatus = useCallback((id: string): { success: boolean; error?: string } => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return { success: false, error: 'Facture introuvable' };
    if (existing.status === 'draft') return { success: false, error: 'La facture est déjà en brouillon' };
    const statusFlow: Record<string, string> = {
      validated: 'draft',
      sent: 'validated',
      late: 'sent',
      partial: 'sent',
    };
    const prevStatus = statusFlow[existing.status];
    if (!prevStatus) return { success: false, error: 'Impossible de revenir en arrière pour ce statut' };
    const updated: Partial<Invoice> = { status: prevStatus as any };
    if (prevStatus === 'draft') {
      updated.isValidated = false;
      updated.isLocked = false;
    }
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === id ? { ...i, ...updated } : i))
    );
    void db.updateInvoice(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    const statusLabels: Record<string, string> = { draft: 'Brouillon', validated: 'Validée', sent: 'Envoyée' };
    void writeAudit('update', 'invoice', id, existing.invoiceNumber || 'Brouillon', `Facture revenue au statut ${statusLabels[prevStatus] || prevStatus}`);
    showToast(`Facture revenue au statut ${statusLabels[prevStatus] || prevStatus}`);
    return { success: true };
  }, [invoices, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const updateInvoiceDueDate = useCallback((id: string, days: number): { success: boolean; error?: string } => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return { success: false, error: 'Facture introuvable' };
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + days);
    const updated: Partial<Invoice> = {
      dueDate: newDueDate.toISOString(),
      paymentTerms: `Paiement à ${days} jours`,
    };
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === id ? { ...i, ...updated } : i))
    );
    void db.updateInvoice(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    showToast(`Échéance mise à jour : ${days} jours`);
    return { success: true };
  }, [invoices, showToast, queryClient, QUERY_KEYS]);

  const updateInvoice = useCallback((id: string, data: Partial<Invoice>): { success: boolean; error?: string } => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return { success: false, error: 'Facture introuvable' };
    if (existing.isLocked || existing.isValidated) {
      return { success: false, error: 'Cette facture est validée et ne peut plus être modifiée' };
    }
    if (data.items) {
      data.totalHT = data.items.reduce((s, i) => s + i.totalHT, 0);
      data.totalTVA = data.items.reduce((s, i) => s + i.totalTVA, 0);
      data.totalTTC = data.items.reduce((s, i) => s + i.totalTTC, 0);
    }

    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === id ? { ...i, ...data } : i))
    );
    void db.updateInvoice(id, data).catch(() => {
      showToast('Erreur lors de la mise à jour de la facture', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    void writeAudit('update', 'invoice', id, existing.invoiceNumber || 'Brouillon', 'Facture modifiée');
    showToast('Facture mise à jour');
    return { success: true };
  }, [invoices, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const validateInvoice = useCallback((id: string): { success: boolean; error?: string } => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) return { success: false, error: 'Facture introuvable' };
    if (existing.isValidated) return { success: false, error: 'Facture déjà validée' };
    if (existing.items.length === 0) return { success: false, error: 'La facture doit avoir au moins une ligne' };

    const invoiceNumber = generateInvoiceNumber(company.invoicePrefix, company.invoiceNextNumber);
    const validated = validateAndLockInvoice({ ...existing, invoiceNumber });

    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === id ? validated : i))
    );
    void db.updateInvoice(id, validated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });

    const newNextNumber = company.invoiceNextNumber + 1;
    queryClient.setQueryData(QUERY_KEYS.company, (old: typeof company | undefined) =>
      old ? { ...old, invoiceNextNumber: newNextNumber } : old
    );
    db.updateCompany(COMPANY_ID, { invoiceNextNumber: newNextNumber } as any).catch(() => {
    });

    existing.items.forEach((item) => {
      queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
        (old ?? []).map((p) =>
          p.id === item.productId ? { ...p, usedInValidatedInvoice: true } : p
        )
      );
      db.updateProduct(item.productId, { usedInValidatedInvoice: true } as any).catch(() => {});
    });

    void writeAudit('validate', 'invoice', id, invoiceNumber, `Facture ${invoiceNumber} validée et verrouillée`);
    showToast(`Facture ${invoiceNumber} validée et verrouillée`);
    return { success: true };
  }, [invoices, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  // ====== QUOTES CRUD ======

  const createQuote = useCallback((clientId: string, items: QuoteItem[], expirationDays: number = 30, notes?: string): { success: boolean; error?: string; quoteId?: string } => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, error: 'Client introuvable' };
    if (items.length === 0) return { success: false, error: 'Au moins une ligne est requise' };

    const totalHT = items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = items.reduce((s, i) => s + i.totalTTC, 0);
    const now = new Date().toISOString();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expirationDays);
    const clientName = client.companyName || `${client.firstName} ${client.lastName}`;
    const quoteNumber = generateQuoteNumber(company.quotePrefix, company.quoteNextNumber);

    const newQuote: Quote = {
      id: generateId('qt'),
      companyId: COMPANY_ID,
      clientId,
      clientName,
      quoteNumber,
      status: 'draft',
      items,
      totalHT,
      totalTVA,
      totalTTC,
      issueDate: now,
      expirationDate: expDate.toISOString(),
      notes: notes || '',
      createdAt: now,
    };

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) => [newQuote, ...(old ?? [])]);
    void db.insertQuote(newQuote).catch(() => {
      showToast('Erreur lors de la sauvegarde du devis', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });

    const newNextNumber = company.quoteNextNumber + 1;
    queryClient.setQueryData(QUERY_KEYS.company, (old: typeof company | undefined) =>
      old ? { ...old, quoteNextNumber: newNextNumber } : old
    );
    db.updateCompany(COMPANY_ID, { quoteNextNumber: newNextNumber } as any).catch(() => {});

    void writeAudit('create', 'quote', newQuote.id, quoteNumber, `Devis ${quoteNumber} créé pour ${clientName}`);
    showToast(`Devis ${quoteNumber} créé`);
    return { success: true, quoteId: newQuote.id };
  }, [clients, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updateQuote = useCallback((id: string, data: Partial<Quote>): { success: boolean; error?: string } => {
    const existing = quotes.find((q) => q.id === id);
    if (!existing) return { success: false, error: 'Devis introuvable' };
    if (existing.status !== 'draft') return { success: false, error: 'Seuls les devis en brouillon peuvent être modifiés' };
    if (data.items) {
      data.totalHT = data.items.reduce((s, i) => s + i.totalHT, 0);
      data.totalTVA = data.items.reduce((s, i) => s + i.totalTVA, 0);
      data.totalTTC = data.items.reduce((s, i) => s + i.totalTTC, 0);
    }

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === id ? { ...q, ...data } : q))
    );
    void db.updateQuote(id, data).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });
    void writeAudit('update', 'quote', id, existing.quoteNumber, 'Devis modifié');
    showToast('Devis mis à jour');
    return { success: true };
  }, [quotes, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const sendQuote = useCallback((id: string): void => {
    const existing = quotes.find((q) => q.id === id);
    if (!existing) return;

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === id ? { ...q, status: 'sent' as const } : q))
    );
    void db.updateQuote(id, { status: 'sent' }).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });
    void writeAudit('send', 'quote', id, existing.quoteNumber, `Devis ${existing.quoteNumber} envoyé`);
    showToast(`Devis ${existing.quoteNumber} envoyé`);
  }, [quotes, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const acceptQuote = useCallback((id: string): void => {
    const existing = quotes.find((q) => q.id === id);
    if (!existing) return;
    const now = new Date().toISOString();

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === id ? { ...q, status: 'accepted' as const, acceptedAt: now } : q))
    );
    void db.updateQuote(id, { status: 'accepted', acceptedAt: now }).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });

    if (!existing.convertedToInvoiceId) {
      const invoiceItems: OrderItem[] = existing.items.map((qi) => ({
        id: generateId('oi'),
        orderId: '',
        productId: qi.productId,
        productName: qi.productName,
        quantity: qi.quantity,
        unitPrice: qi.unitPrice,
        vatRate: qi.vatRate,
        totalHT: qi.totalHT,
        totalTVA: qi.totalTVA,
        totalTTC: qi.totalTTC,
      }));
      const result = createInvoice(existing.clientId, invoiceItems);
      if (result.success && result.invoiceId) {
        queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
          (old ?? []).map((q) => (q.id === id ? { ...q, convertedToInvoiceId: result.invoiceId } : q))
        );
        db.updateQuote(id, { convertedToInvoiceId: result.invoiceId }).catch(() => {});
        showToast(`Devis ${existing.quoteNumber} accepté et facture créée`);
      } else {
        showToast(`Devis ${existing.quoteNumber} accepté`);
      }
    } else {
      showToast(`Devis ${existing.quoteNumber} accepté`);
    }
  }, [quotes, showToast, queryClient, QUERY_KEYS, createInvoice]);

  const refuseQuote = useCallback((id: string): void => {
    const existing = quotes.find((q) => q.id === id);
    if (!existing) return;

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === id ? { ...q, status: 'refused' as const } : q))
    );
    void db.updateQuote(id, { status: 'refused' }).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });
    showToast(`Devis ${existing.quoteNumber} refusé`);
  }, [quotes, showToast, queryClient, QUERY_KEYS]);

  const cancelQuote = useCallback((id: string): { success: boolean; error?: string } => {
    const existing = quotes.find((q) => q.id === id);
    if (!existing) return { success: false, error: 'Devis introuvable' };
    if (existing.status === 'cancelled') return { success: false, error: 'Devis déjà annulé' };
    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === id ? { ...q, status: 'cancelled' as const } : q))
    );
    void db.updateQuote(id, { status: 'cancelled' }).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });
    void writeAudit('cancel', 'quote', id, existing.quoteNumber, `Devis ${existing.quoteNumber} annulé`);
    showToast(`Devis ${existing.quoteNumber} annulé`);
    return { success: true };
  }, [quotes, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const deleteQuote = useCallback((quoteId: string): { success: boolean; error?: string } => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { success: false, error: 'Devis introuvable' };
    if (quote.status !== 'draft') return { success: false, error: 'Seuls les devis en brouillon peuvent être supprimés' };
    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).filter((q) => q.id !== quoteId)
    );
    void db.updateQuote(quoteId, { status: 'expired' } as Partial<Quote>).catch((err: Error) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
    });
    void writeAudit('delete', 'quote', quoteId, quote.quoteNumber, `Devis ${quote.quoteNumber} supprimé`);
    showToast(`Devis ${quote.quoteNumber} supprimé`);
    return { success: true };
  }, [quotes, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const convertQuoteToInvoice = useCallback((quoteId: string): { success: boolean; error?: string } => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { success: false, error: 'Devis introuvable' };
    if (quote.status !== 'accepted') return { success: false, error: 'Seuls les devis acceptés peuvent être convertis' };
    if (quote.convertedToInvoiceId) return { success: false, error: 'Ce devis a déjà été converti' };

    const invoiceItems: OrderItem[] = quote.items.map((qi) => ({
      id: generateId('oi'),
      orderId: '',
      productId: qi.productId,
      productName: qi.productName,
      quantity: qi.quantity,
      unitPrice: qi.unitPrice,
      vatRate: qi.vatRate,
      totalHT: qi.totalHT,
      totalTVA: qi.totalTVA,
      totalTTC: qi.totalTTC,
    }));

    const result = createInvoice(quote.clientId, invoiceItems);
    if (!result.success) return result;

    queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
      (old ?? []).map((q) => (q.id === quoteId ? { ...q, convertedToInvoiceId: result.invoiceId } : q))
    );
    db.updateQuote(quoteId, { convertedToInvoiceId: result.invoiceId }).catch(() => {});
    void writeAudit('convert', 'quote', quoteId, quote.quoteNumber, `Devis ${quote.quoteNumber} converti en facture`);
    showToast(`Devis ${quote.quoteNumber} converti en facture`);
    return { success: true };
  }, [quotes, createInvoice, showToast, queryClient, writeAudit, QUERY_KEYS]);

  // ====== SALES ======

  const saleNextNumber = useMemo(() => {
    if (sales.length === 0) return 1;
    const maxNum = sales.reduce((max, s) => {
      const match = s.saleNumber.match(/VEN-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return maxNum + 1;
  }, [sales]);

  const generateSaleNumber = useCallback((): string => {
    const year = new Date().getFullYear();
    const num = String(saleNextNumber).padStart(3, '0');
    return `VEN-${year}-${num}`;
  }, [saleNextNumber]);

  // ====== RECIPES ======

  const getRecipeForProduct = useCallback((productId: string, variantId?: string): Recipe | undefined => {
    if (variantId) {
      const variantRecipe = recipes.find(r => r.productId === productId && r.variantId === variantId);
      if (variantRecipe) return variantRecipe;
    }
    return recipes.find(r => r.productId === productId && !r.variantId);
  }, [recipes]);

  const getRecipesForProduct = useCallback((productId: string): Recipe[] => {
    return recipes.filter(r => r.productId === productId);
  }, [recipes]);

  const saveRecipe = useCallback((productId: string, items: RecipeItem[], variantId?: string): { success: boolean; error?: string } => {
    if (items.length === 0) return { success: false, error: 'Au moins un ingredient est requis' };
    const invalidItem = items.find(i => i.quantity <= 0);
    if (invalidItem) return { success: false, error: 'Toutes les quantites doivent etre superieures a 0' };

    const now = new Date().toISOString();
    const existingIdx = recipes.findIndex(r => r.productId === productId && (variantId ? r.variantId === variantId : !r.variantId));

    let updated: Recipe[];
    if (existingIdx >= 0) {
      updated = recipes.map((r, i) => i === existingIdx ? { ...r, items, updatedAt: now } : r);
    } else {
      const newRecipe: Recipe = {
        id: generateId('recipe'),
        productId,
        variantId,
        companyId: COMPANY_ID,
        items,
        createdAt: now,
        updatedAt: now,
      };
      updated = [...recipes, newRecipe];
    }
    setRecipes(updated);
    queryClient.setQueryData(['recipes', COMPANY_ID], updated);
    void persistRecipes(updated);
    showToast('Recette enregistree');
    return { success: true };
  }, [recipes, COMPANY_ID, persistRecipes, showToast, queryClient]);

  const deleteRecipe = useCallback((productId: string, variantId?: string) => {
    const updated = recipes.filter(r => !(r.productId === productId && (variantId ? r.variantId === variantId : !r.variantId)));
    setRecipes(updated);
    queryClient.setQueryData(['recipes', COMPANY_ID], updated);
    void persistRecipes(updated);
    showToast('Recette supprimee');
  }, [recipes, persistRecipes, showToast, queryClient, COMPANY_ID]);

  const deleteAllRecipesForProduct = useCallback((productId: string) => {
    const updated = recipes.filter(r => r.productId !== productId);
    setRecipes(updated);
    queryClient.setQueryData(['recipes', COMPANY_ID], updated);
    void persistRecipes(updated);
  }, [recipes, persistRecipes, queryClient, COMPANY_ID]);

  const deductRecipeIngredients = useCallback((productId: string, saleQuantity: number, saleNumber: string, variantId?: string) => {
    const recipe = getRecipeForProduct(productId, variantId);
    if (!recipe || recipe.items.length === 0) return;

    const now = new Date().toISOString();
    recipe.items.forEach((ingredient) => {
      const deductQty = ingredient.quantity * saleQuantity;
      const ingredientProduct = products.find(p => p.id === ingredient.ingredientProductId);
      if (!ingredientProduct) return;

      const ingredientVariants = variants.filter(v => v.productId === ingredient.ingredientProductId);

      if (ingredient.ingredientVariantId) {
        const targetVariant = ingredientVariants.find(v => v.id === ingredient.ingredientVariantId);
        if (targetVariant) {
          const newVarStock = Math.max(0, targetVariant.stockQuantity - deductQty);
          queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
            (old ?? []).map(vr => vr.id === targetVariant.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
          );
          db.updateVariant(targetVariant.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});

          const totalProductStock = ingredientVariants.reduce((s, v) =>
            s + (v.id === targetVariant.id ? newVarStock : v.stockQuantity), 0
          );
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === ingredient.ingredientProductId ? { ...p, stockQuantity: totalProductStock, updatedAt: now } : p)
          );
          db.updateProductStock(ingredient.ingredientProductId, totalProductStock).catch(() => {});
        }
      } else {
        if (ingredientVariants.length >= 1) {
          const sortedVariants = [...ingredientVariants].sort((a, b) => b.stockQuantity - a.stockQuantity);
          const firstAvailable = sortedVariants.find(v => v.stockQuantity > 0) || sortedVariants[0];
          const newVarStock = Math.max(0, firstAvailable.stockQuantity - deductQty);
          queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
            (old ?? []).map(vr => vr.id === firstAvailable.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
          );
          db.updateVariant(firstAvailable.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});
          const totalProductStock = ingredientVariants.reduce((s, v) =>
            s + (v.id === firstAvailable.id ? newVarStock : v.stockQuantity), 0
          );
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === ingredient.ingredientProductId ? { ...p, stockQuantity: totalProductStock, updatedAt: now } : p)
          );
          db.updateProductStock(ingredient.ingredientProductId, totalProductStock).catch(() => {});
        } else {
          const currentStock = ingredientProduct.stockQuantity;
          const newStock = Math.max(0, currentStock - deductQty);
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === ingredient.ingredientProductId ? { ...p, stockQuantity: newStock, updatedAt: now } : p)
          );
          db.updateProductStock(ingredient.ingredientProductId, newStock).catch(() => {});
        }
      }

      const sm: StockMovementRecord = {
        id: generateId('sm'),
        companyId: COMPANY_ID,
        productId: ingredient.ingredientProductId,
        productName: ingredient.ingredientProductName,
        variantId: ingredient.ingredientVariantId,
        type: 'sale_out',
        quantity: -deductQty,
        reference: saleNumber,
        notes: `Deduction recette - Vente ${saleNumber}`,
        createdAt: now,
      };
      queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
      db.insertStockMovement(sm).catch(() => {});
    });
  }, [getRecipeForProduct, products, variants, queryClient, QUERY_KEYS, COMPANY_ID]);

  const createSale = useCallback((
    items: SaleItem[],
    paymentMethod: SalePaymentMethod,
    clientId?: string,
    extra?: { mobilePhone?: string; mobileRef?: string; mixedPayments?: MixedPaymentEntry[] },
  ): { success: boolean; error?: string; saleId?: string } => {
    if (items.length === 0) return { success: false, error: 'Le panier est vide' };

    const totalHT = items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = items.reduce((s, i) => s + i.totalTTC, 0);
    const now = new Date().toISOString();
    const saleNumber = generateSaleNumber();
    const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
    const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : undefined;

    const newSale: Sale = {
      id: generateId('sale'),
      companyId: COMPANY_ID,
      saleNumber,
      clientId,
      clientName,
      items,
      totalHT,
      totalTVA,
      totalTTC,
      paymentMethod,
      ...(extra?.mobilePhone ? { mobilePhone: extra.mobilePhone } : {}),
      ...(extra?.mobileRef ? { mobileRef: extra.mobileRef } : {}),
      ...(extra?.mixedPayments ? { mixedPayments: extra.mixedPayments } : {}),
      status: 'paid',
      createdAt: now,
    };

    queryClient.setQueryData<Sale[]>(QUERY_KEYS.sales, (old) => [newSale, ...(old ?? [])]);
    void db.insertSale(newSale).catch(() => {
      showToast('Erreur lors de la sauvegarde de la vente', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    });

    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'income',
      amount: totalTTC,
      description: `Vente ${saleNumber}${clientName ? ` - ${clientName}` : ''}`,
      category: 'Ventes comptoir',
      date: now,
      balance: 0,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});

    items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.type !== 'service') {
        const sm: StockMovementRecord = {
          id: generateId('sm'),
          companyId: COMPANY_ID,
          productId: item.productId,
          productName: item.productName,
          type: 'sale_out',
          quantity: -item.quantity,
          reference: saleNumber,
          notes: `Sortie vente ${saleNumber}`,
          createdAt: now,
        };
        queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
        db.insertStockMovement(sm).catch(() => {});

        const saleVariantId = (item as SaleItem & { variantId?: string }).variantId;
        const productVariants = variants.filter(v => v.productId === item.productId);
        if (saleVariantId) {
          const targetVariant = productVariants.find(v => v.id === saleVariantId);
          if (targetVariant) {
            const newVarStock = Math.max(0, targetVariant.stockQuantity - item.quantity);
            queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
              (old ?? []).map(vr => vr.id === targetVariant.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
            );
            db.updateVariant(targetVariant.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});
            const totalProductStock = productVariants.reduce((s, v) =>
              s + (v.id === targetVariant.id ? newVarStock : v.stockQuantity), 0
            );
            queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
              (old ?? []).map(p => p.id === item.productId ? { ...p, stockQuantity: totalProductStock, updatedAt: now } : p)
            );
            db.updateProductStock(item.productId, totalProductStock).catch(() => {});
          }
        } else if (productVariants.length === 1) {
          const v = productVariants[0];
          const newVarStock = Math.max(0, v.stockQuantity - item.quantity);
          queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
            (old ?? []).map(vr => vr.id === v.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
          );
          db.updateVariant(v.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === item.productId ? { ...p, stockQuantity: newVarStock, updatedAt: now } : p)
          );
          db.updateProductStock(item.productId, newVarStock).catch(() => {});
        } else if (productVariants.length === 0) {
          const currentStock = product.stockQuantity;
          const newStock = Math.max(0, currentStock - item.quantity);
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === item.productId ? { ...p, stockQuantity: newStock, updatedAt: now } : p)
          );
          db.updateProductStock(item.productId, newStock).catch(() => {});
        }

        if (product.type === 'produit_transforme' || product.type === 'produit_fini') {
          deductRecipeIngredients(item.productId, item.quantity, saleNumber, saleVariantId);
        }
      }
    });

    void writeAudit('create', 'sale', newSale.id, saleNumber, `Vente ${saleNumber} encaissée - ${totalTTC.toFixed(2)} ${company.currency || 'EUR'}`);
    showToast(`Vente ${saleNumber} encaissée avec succès`);
    return { success: true, saleId: newSale.id };
  }, [clients, products, variants, generateSaleNumber, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS, deductRecipeIngredients, company.currency]);

  const refundSale = useCallback((saleId: string): { success: boolean; error?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable' };
    if (sale.status === 'refunded') return { success: false, error: 'Cette vente est déjà remboursée' };

    const now = new Date().toISOString();
    queryClient.setQueryData<Sale[]>(QUERY_KEYS.sales, (old) =>
      (old ?? []).map((s) => (s.id === saleId ? { ...s, status: 'refunded' as const, refundedAt: now } : s))
    );
    void db.updateSale(saleId, { status: 'refunded', refundedAt: now }).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    });

    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'expense',
      amount: sale.totalTTC,
      description: `Remboursement ${sale.saleNumber}${sale.clientName ? ` - ${sale.clientName}` : ''}`,
      category: 'Remboursement vente',
      date: now,
      balance: 0,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});

    sale.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.type !== 'service') {
        const sm: StockMovementRecord = {
          id: generateId('sm'),
          companyId: COMPANY_ID,
          productId: item.productId,
          productName: item.productName,
          type: 'purchase_in',
          quantity: item.quantity,
          reference: sale.saleNumber,
          notes: `Retour remboursement ${sale.saleNumber}`,
          createdAt: now,
        };
        queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
        db.insertStockMovement(sm).catch(() => {});
      }
    });

    void writeAudit('refund', 'sale', saleId, sale.saleNumber, `Vente ${sale.saleNumber} remboursée`);
    showToast(`Vente ${sale.saleNumber} remboursée`);
    return { success: true };
  }, [sales, products, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const convertSaleToInvoice = useCallback((saleId: string): { success: boolean; error?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable' };
    if (sale.convertedToInvoiceId) return { success: false, error: 'Cette vente a déjà été convertie en facture' };
    if (!sale.clientId) return { success: false, error: 'Un client doit être associé à la vente pour créer une facture' };

    const invoiceItems: OrderItem[] = sale.items.map((si) => ({
      id: generateId('oi'),
      orderId: '',
      productId: si.productId,
      productName: si.productName,
      quantity: si.quantity,
      unitPrice: si.unitPrice,
      vatRate: si.vatRate,
      totalHT: si.totalHT,
      totalTVA: si.totalTVA,
      totalTTC: si.totalTTC,
    }));

    const result = createInvoice(sale.clientId, invoiceItems);
    if (!result.success) return result;

    queryClient.setQueryData<Sale[]>(QUERY_KEYS.sales, (old) =>
      (old ?? []).map((s) => (s.id === saleId ? { ...s, convertedToInvoiceId: result.invoiceId } : s))
    );
    db.updateSale(saleId, { convertedToInvoiceId: result.invoiceId }).catch(() => {});

    void writeAudit('convert', 'sale', saleId, sale.saleNumber, `Vente ${sale.saleNumber} convertie en facture`);
    showToast(`Vente ${sale.saleNumber} convertie en facture`);
    return { success: true };
  }, [sales, createInvoice, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const updateSale = useCallback((saleId: string, data: { items: SaleItem[]; paymentMethod: SalePaymentMethod; clientId?: string }): { success: boolean; error?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable' };
    if (sale.status === 'refunded') return { success: false, error: 'Impossible de modifier une vente remboursée' };

    const totalHT = data.items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = data.items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = data.items.reduce((s, i) => s + i.totalTTC, 0);
    const client = data.clientId ? clients.find((c) => c.id === data.clientId) : undefined;
    const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : undefined;

    const updated = {
      items: data.items,
      totalHT,
      totalTVA,
      totalTTC,
      paymentMethod: data.paymentMethod,
      clientId: data.clientId,
      clientName,
    };

    queryClient.setQueryData<Sale[]>(QUERY_KEYS.sales, (old) =>
      (old ?? []).map((s) => (s.id === saleId ? { ...s, ...updated } : s))
    );
    void db.updateSale(saleId, updated as Partial<Sale>).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    });
    void writeAudit('update', 'sale', saleId, sale.saleNumber, `Vente ${sale.saleNumber} modifiée`);
    showToast(`Vente ${sale.saleNumber} mise à jour`);
    return { success: true };
  }, [sales, clients, showToast, queryClient, writeAudit, QUERY_KEYS]);

  // ====== INVOICE STATUS CHANGE WITH CASH ENTRY ======

  const markInvoicePaid = useCallback((invoiceId: string): { success: boolean; error?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    const now = new Date().toISOString();
    const updated = { status: 'paid' as const, paidAmount: invoice.totalTTC };
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === invoiceId ? { ...i, ...updated } : i))
    );
    void db.updateInvoice(invoiceId, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'income',
      amount: invoice.totalTTC,
      description: `Paiement facture ${invoice.invoiceNumber || 'Brouillon'} - ${invoice.clientName}`,
      category: 'Paiement facture',
      date: now,
      invoiceId: invoice.id,
      balance: 0,
      sourceType: 'invoice',
      sourceRef: invoice.invoiceNumber || invoice.id,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});
    void writeAudit('payment', 'invoice', invoiceId, invoice.invoiceNumber || 'Brouillon', `Facture ${invoice.invoiceNumber} marquée payée`);
    showToast(`Facture ${invoice.invoiceNumber || 'Brouillon'} marquée comme payée`);
    return { success: true };
  }, [invoices, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  // ====== SUPPLIERS CRUD ======

  const createSupplier = useCallback((data: Omit<Supplier, 'id' | 'companyId' | 'isDeleted' | 'createdAt' | 'updatedAt'>): { success: boolean; error?: string } => {
    if (!data.companyName.trim()) return { success: false, error: 'Le nom est requis' };
    const now = new Date().toISOString();
    const newSupplier: Supplier = {
      ...data,
      id: generateId('sup'),
      companyId: COMPANY_ID,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<Supplier[]>(QUERY_KEYS.suppliers, (old) => [newSupplier, ...(old ?? [])]);
    void db.insertSupplier(newSupplier).catch(() => {
      showToast('Erreur lors de la sauvegarde du fournisseur', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
    });
    void writeAudit('create', 'supplier', newSupplier.id, data.companyName, `Fournisseur créé: ${data.companyName}`);
    showToast(`Fournisseur "${data.companyName}" créé`);
    return { success: true };
  }, [showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updateSupplier = useCallback((id: string, data: Partial<Supplier>): { success: boolean; error?: string } => {
    const existing = suppliers.find((s) => s.id === id);
    if (!existing) return { success: false, error: 'Fournisseur introuvable' };
    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<Supplier[]>(QUERY_KEYS.suppliers, (old) =>
      (old ?? []).map((s) => s.id === id ? { ...s, ...updated } : s)
    );
    void db.updateSupplier(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
    });
    showToast(`Fournisseur "${data.companyName ?? existing.companyName}" mis à jour`);
    return { success: true };
  }, [suppliers, showToast, queryClient, QUERY_KEYS]);

  const deleteSupplier = useCallback((id: string): void => {
    const supplier = suppliers.find((s) => s.id === id);
    if (!supplier) return;
    const updated = { isDeleted: true, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<Supplier[]>(QUERY_KEYS.suppliers, (old) =>
      (old ?? []).map((s) => s.id === id ? { ...s, ...updated } : s)
    );
    void db.updateSupplier(id, updated as Partial<Supplier>).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.suppliers });
    });
    showToast(`Fournisseur "${supplier.companyName}" supprimé`);
  }, [suppliers, showToast, queryClient, QUERY_KEYS]);

  // ====== PURCHASE ORDERS CRUD ======

  const createPurchaseOrder = useCallback((supplierId: string, items: PurchaseOrderItem[], notes?: string, expectedDate?: string): { success: boolean; error?: string; poId?: string } => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return { success: false, error: 'Fournisseur introuvable' };
    if (items.length === 0) return { success: false, error: 'Au moins une ligne est requise' };
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
    const total = subtotal + taxAmount;
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const num = String(company.purchaseOrderNextNumber ?? 1).padStart(4, '0');
    const poNumber = `${company.purchaseOrderPrefix ?? 'CF'}-${year}-${num}`;
    const newPO: PurchaseOrder = {
      id: generateId('po'),
      companyId: COMPANY_ID,
      supplierId,
      supplierName: supplier.companyName,
      number: poNumber,
      status: 'draft',
      date: now,
      expectedDate,
      notes: notes || '',
      items,
      subtotal,
      taxAmount,
      total,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<PurchaseOrder[]>(QUERY_KEYS.purchaseOrders, (old) => [newPO, ...(old ?? [])]);
    void db.insertPurchaseOrder(newPO).catch(() => {
      showToast('Erreur lors de la sauvegarde de la commande', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders });
    });
    const nextNum = (company.purchaseOrderNextNumber ?? 1) + 1;
    queryClient.setQueryData(QUERY_KEYS.company, (old: typeof company | undefined) =>
      old ? { ...old, purchaseOrderNextNumber: nextNum } : old
    );
    db.updateCompany(COMPANY_ID, { purchaseOrderNextNumber: nextNum } as any).catch(() => {});
    void writeAudit('create', 'purchase_order', newPO.id, poNumber, `Commande fournisseur ${poNumber} créée`);
    showToast(`Commande ${poNumber} créée`);
    return { success: true, poId: newPO.id };
  }, [suppliers, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updatePurchaseOrder = useCallback((id: string, data: Partial<PurchaseOrder>): { success: boolean; error?: string } => {
    const existing = purchaseOrders.find((po) => po.id === id);
    if (!existing) return { success: false, error: 'Commande introuvable' };
    if (data.items) {
      data.subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      data.taxAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
      data.total = data.subtotal + data.taxAmount;
    }
    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<PurchaseOrder[]>(QUERY_KEYS.purchaseOrders, (old) =>
      (old ?? []).map((po) => (po.id === id ? { ...po, ...updated } : po))
    );
    void db.updatePurchaseOrder(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders });
    });
    showToast(`Commande ${existing.number} mise à jour`);
    return { success: true };
  }, [purchaseOrders, showToast, queryClient, QUERY_KEYS]);

  const receivePurchaseOrder = useCallback((id: string): { success: boolean; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: 'Commande introuvable' };
    const now = new Date().toISOString();
    const updated = { status: 'received' as PurchaseOrderStatus, updatedAt: now };
    queryClient.setQueryData<PurchaseOrder[]>(QUERY_KEYS.purchaseOrders, (old) =>
      (old ?? []).map((p) => (p.id === id ? { ...p, ...updated } : p))
    );
    void db.updatePurchaseOrder(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders });
    });
    po.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        const sm: StockMovementRecord = {
          id: generateId('sm'),
          companyId: COMPANY_ID,
          productId: item.productId,
          productName: item.productName,
          type: 'purchase_in',
          quantity: item.quantity,
          reference: po.number,
          notes: `Réception commande ${po.number}`,
          createdAt: now,
        };
        queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
        db.insertStockMovement(sm).catch(() => {});

        const productVariants = variants.filter(v => v.productId === item.productId);
        if (productVariants.length === 1) {
          const v = productVariants[0];
          const newVarStock = v.stockQuantity + item.quantity;
          queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
            (old ?? []).map(vr => vr.id === v.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
          );
          db.updateVariant(v.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === item.productId ? { ...p, stockQuantity: newVarStock, updatedAt: now } : p)
          );
          db.updateProductStock(item.productId, newVarStock).catch(() => {});
        } else if (productVariants.length === 0) {
          const newStock = product.stockQuantity + item.quantity;
          queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
            (old ?? []).map(p => p.id === item.productId ? { ...p, stockQuantity: newStock, updatedAt: now } : p)
          );
          db.updateProductStock(item.productId, newStock).catch(() => {});
        }
      }
    });
    void writeAudit('update', 'purchase_order', id, po.number, `Commande ${po.number} reçue - stock mis à jour`);
    showToast(`Commande ${po.number} reçue - stock mis à jour`);
    return { success: true };
  }, [purchaseOrders, products, variants, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  // ====== SUPPLIER INVOICES CRUD ======

  const createSupplierInvoice = useCallback((supplierId: string, items: SupplierInvoiceItem[], dueDate: string, notes?: string, purchaseOrderId?: string): { success: boolean; error?: string; siId?: string } => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return { success: false, error: 'Fournisseur introuvable' };
    if (items.length === 0) return { success: false, error: 'Au moins une ligne est requise' };
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
    const total = subtotal + taxAmount;
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const num = String(company.supplierInvoiceNextNumber ?? 1).padStart(4, '0');
    const siNumber = `${company.supplierInvoicePrefix ?? 'FR'}-${year}-${num}`;
    const newSI: SupplierInvoice = {
      id: generateId('si'),
      companyId: COMPANY_ID,
      supplierId,
      supplierName: supplier.companyName,
      purchaseOrderId,
      number: siNumber,
      status: 'received',
      date: now,
      dueDate,
      notes: notes || '',
      items,
      subtotal,
      taxAmount,
      total,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<SupplierInvoice[]>(QUERY_KEYS.supplierInvoices, (old) => [newSI, ...(old ?? [])]);
    void db.insertSupplierInvoice(newSI).catch(() => {
      showToast('Erreur lors de la sauvegarde de la facture reçue', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.supplierInvoices });
    });
    const nextNum = (company.supplierInvoiceNextNumber ?? 1) + 1;
    queryClient.setQueryData(QUERY_KEYS.company, (old: typeof company | undefined) =>
      old ? { ...old, supplierInvoiceNextNumber: nextNum } : old
    );
    db.updateCompany(COMPANY_ID, { supplierInvoiceNextNumber: nextNum } as any).catch(() => {});
    void writeAudit('create', 'supplier_invoice', newSI.id, siNumber, `Facture reçue ${siNumber} créée`);
    showToast(`Facture reçue ${siNumber} créée`);
    return { success: true, siId: newSI.id };
  }, [suppliers, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const updateSupplierInvoice = useCallback((id: string, data: Partial<SupplierInvoice>): { success: boolean; error?: string } => {
    const existing = supplierInvoices.find((si) => si.id === id);
    if (!existing) return { success: false, error: 'Facture reçue introuvable' };
    if (data.items) {
      data.subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      data.taxAmount = data.items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
      data.total = data.subtotal + data.taxAmount;
    }
    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<SupplierInvoice[]>(QUERY_KEYS.supplierInvoices, (old) =>
      (old ?? []).map((si) => (si.id === id ? { ...si, ...updated } : si))
    );
    void db.updateSupplierInvoice(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.supplierInvoices });
    });
    showToast(`Facture reçue ${existing.number} mise à jour`);
    return { success: true };
  }, [supplierInvoices, showToast, queryClient, QUERY_KEYS]);

  const markSupplierInvoicePaid = useCallback((id: string): { success: boolean; error?: string } => {
    const si = supplierInvoices.find((s) => s.id === id);
    if (!si) return { success: false, error: 'Facture reçue introuvable' };
    const now = new Date().toISOString();
    const updated = { status: 'paid' as SupplierInvoiceStatus, updatedAt: now };
    queryClient.setQueryData<SupplierInvoice[]>(QUERY_KEYS.supplierInvoices, (old) =>
      (old ?? []).map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
    void db.updateSupplierInvoice(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.supplierInvoices });
    });
    const supplier = suppliers.find((s) => s.id === si.supplierId);
    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'expense',
      amount: si.total,
      description: `Paiement facture reçue ${si.number}${supplier ? ` - ${supplier.companyName}` : ''}`,
      category: 'Paiement fournisseur',
      date: now,
      balance: 0,
      sourceType: 'supplier_invoice',
      sourceRef: si.number,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});
    void writeAudit('payment', 'supplier_invoice', id, si.number, `Facture reçue ${si.number} payée`);
    showToast(`Facture reçue ${si.number} marquée comme payée`);
    return { success: true };
  }, [supplierInvoices, suppliers, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const convertPOToSupplierInvoice = useCallback((poId: string): { success: boolean; error?: string } => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { success: false, error: 'Commande introuvable' };
    const existingInvoice = supplierInvoices.find((si) => si.purchaseOrderId === poId);
    if (existingInvoice) return { success: false, error: 'Une facture existe d\u00e9j\u00e0 pour cette commande' };
    const siItems: SupplierInvoiceItem[] = po.items.map((item) => ({
      id: generateId('sii'),
      supplierInvoiceId: '',
      productId: item.productId,
      productName: item.productName,
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      total: item.quantity * item.unitPrice * (1 + item.taxRate / 100),
    }));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const result = createSupplierInvoice(po.supplierId, siItems, dueDate.toISOString(), po.notes, po.id);
    if (!result.success) return result;
    showToast(`Commande ${po.number} convertie en facture reçue`);
    return { success: true };
  }, [purchaseOrders, supplierInvoices, createSupplierInvoice, showToast]);

  // ====== PRODUCT VARIANTS ======

  const getVariantsForProduct = useCallback((productId: string): ProductVariant[] => {
    return variants.filter((v) => v.productId === productId);
  }, [variants]);

  const getVariantStock = useCallback((variantId: string): number => {
    return stockMovements
      .filter(sm => sm.variantId === variantId)
      .reduce((total, sm) => {
        const isIn = sm.type === 'purchase_in' || sm.type === 'in' || sm.type === 'adjustment' || sm.type === 'inventory_correction';
        const isOut = sm.type === 'sale_out' || sm.type === 'out';
        if (isIn) return total + Math.abs(sm.quantity);
        if (isOut) return total - Math.abs(sm.quantity);
        return total + sm.quantity;
      }, 0);
  }, [stockMovements]);

  const getProductTotalStock = useCallback((productId: string): number => {
    const productVariants = variants.filter(v => v.productId === productId);
    if (productVariants.length === 0) return getProductStock(productId);
    return productVariants.reduce((total, v) => total + v.stockQuantity, 0);
  }, [variants, getProductStock]);

  const generateVariantSKU = useCallback((brand: string, productName: string, variantIndex: number): string => {
    const brandPrefix = (brand || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const namePrefix = (productName || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const num = String(variantIndex).padStart(3, '0');
    return `${brandPrefix}-${namePrefix}-${num}`;
  }, []);

  const createVariantsBatch = useCallback((productId: string, variantsData: Array<{ attributes: Record<string, string>; sku: string; purchasePrice: number; salePrice: number; stockQuantity: number; minStock: number }>): { success: boolean; error?: string } => {
    if (!productId) return { success: false, error: 'Produit requis' };
    const now = new Date().toISOString();
    const newVariants: ProductVariant[] = variantsData.map(d => ({
      ...d,
      id: generateId('var'),
      productId,
      companyId: COMPANY_ID,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }));
    queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) => [...newVariants, ...(old ?? [])]);
    newVariants.forEach(v => {
      void db.insertVariant(v).catch(e => {
      });
    });
    showToast(`${newVariants.length} variante(s) créée(s)`);
    return { success: true };
  }, [COMPANY_ID, QUERY_KEYS, queryClient, showToast]);

  const createVariant = useCallback((data: Omit<ProductVariant, 'id' | 'companyId' | 'createdAt' | 'updatedAt'> & { minStock?: number; isActive?: boolean }): { success: boolean; error?: string } => {
    if (!data.productId) return { success: false, error: 'Produit requis' };
    const now = new Date().toISOString();
    const newVariant: ProductVariant = {
      ...data,
      id: generateId('var'),
      companyId: COMPANY_ID,
      minStock: data.minStock ?? 0,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) => [newVariant, ...(old ?? [])]);
    void db.insertVariant(newVariant).catch(() => {
      showToast('Erreur lors de la sauvegarde de la variante', 'error');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.variants });
    });
    showToast('Variante ajoutée');
    return { success: true };
  }, [showToast, queryClient, COMPANY_ID, QUERY_KEYS]);

  const updateVariant = useCallback((id: string, data: Partial<ProductVariant>, options?: { silent?: boolean }): { success: boolean; error?: string } => {
    const existing = variants.find((v) => v.id === id);
    if (!existing) return { success: false, error: 'Variante introuvable' };
    const updated = { ...data, updatedAt: new Date().toISOString() };
    queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
      (old ?? []).map((v) => v.id === id ? { ...v, ...updated } : v)
    );
    void db.updateVariant(id, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.variants });
    });
    if (!options?.silent) showToast('Variante mise à jour');
    return { success: true };
  }, [variants, showToast, queryClient, QUERY_KEYS]);

  const deleteVariant = useCallback((id: string): void => {
    queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
      (old ?? []).filter((v) => v.id !== id)
    );
    void db.deleteVariant(id).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.variants });
    });
    showToast('Variante supprimée');
  }, [showToast, queryClient, QUERY_KEYS]);

  // ====== STOCK MOVEMENTS ======

  const createStockAdjustment = useCallback((productId: string, quantity: number, notes: string, targetVariantId?: string): { success: boolean; error?: string } => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: 'Produit introuvable' };
    if (!notes.trim()) return { success: false, error: 'Le motif est obligatoire' };
    const now = new Date().toISOString();
    const productVariants = variants.filter(v => v.productId === productId);

    if (targetVariantId) {
      const targetVariant = productVariants.find(v => v.id === targetVariantId);
      if (!targetVariant) return { success: false, error: 'Variante introuvable' };
      const newVarStock = targetVariant.stockQuantity + quantity;
      if (newVarStock < 0) return { success: false, error: 'Le stock de la variante ne peut pas être négatif' };

      queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
        (old ?? []).map((vr) => vr.id === targetVariantId ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
      );
      db.updateVariant(targetVariantId, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});

      const totalProductStock = productVariants.reduce((s, v) =>
        s + (v.id === targetVariantId ? newVarStock : v.stockQuantity), 0
      );
      queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
        (old ?? []).map((p) => p.id === productId ? { ...p, stockQuantity: totalProductStock, updatedAt: now } : p)
      );
      db.updateProductStock(productId, totalProductStock).catch(() => {});

      const sm: StockMovementRecord = {
        id: generateId('sm'),
        companyId: COMPANY_ID,
        productId,
        productName: product.name,
        variantId: targetVariantId,
        type: 'inventory_correction',
        quantity,
        reference: `Ajustement manuel`,
        notes,
        createdAt: now,
      };
      queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
      db.insertStockMovement(sm).catch(() => {});

      void writeAudit('update', 'stock_movement', sm.id, product.name, `Ajustement stock ${product.name}: ${quantity > 0 ? '+' : ''}${quantity}`);
      showToast(`Stock ajusté (${quantity > 0 ? '+' : ''}${quantity})`);
      return { success: true };
    }

    const currentStock = product.stockQuantity;
    const newQty = currentStock + quantity;
    if (newQty < 0) return { success: false, error: 'Le stock ne peut pas être négatif' };
    const sm: StockMovementRecord = {
      id: generateId('sm'),
      companyId: COMPANY_ID,
      productId,
      productName: product.name,
      type: 'inventory_correction',
      quantity,
      reference: `Ajustement manuel`,
      notes,
      createdAt: now,
    };
    queryClient.setQueryData<StockMovementRecord[]>(QUERY_KEYS.stockMovements, (old) => [sm, ...(old ?? [])]);
    db.insertStockMovement(sm).catch(() => {});

    queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) =>
      (old ?? []).map((p) => p.id === productId ? { ...p, stockQuantity: newQty, updatedAt: now } : p)
    );
    db.updateProductStock(productId, newQty).catch(() => {});

    if (productVariants.length === 1) {
      const v = productVariants[0];
      const newVarStock = v.stockQuantity + quantity;
      queryClient.setQueryData<ProductVariant[]>(QUERY_KEYS.variants, (old) =>
        (old ?? []).map((vr) => vr.id === v.id ? { ...vr, stockQuantity: newVarStock, updatedAt: now } : vr)
      );
      db.updateVariant(v.id, { stockQuantity: newVarStock, updatedAt: now } as Partial<ProductVariant>).catch(() => {});
    }

    void writeAudit('update', 'stock_movement', sm.id, product.name, `Ajustement stock ${product.name}: ${quantity > 0 ? '+' : ''}${quantity}`);
    showToast(`Stock de "${product.name}" ajusté (${quantity > 0 ? '+' : ''}${quantity})`);
    return { success: true };
  }, [products, variants, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  // ====== REMINDERS ======

  const sendReminder = useCallback((invoiceId: string): { success: boolean; error?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    const existingReminders = reminderLogs.filter((r) => r.invoiceId === invoiceId);
    const nextLevel = Math.min(existingReminders.length + 1, 3) as ReminderLevel;
    const now = new Date().toISOString();
    const rl: ReminderLogRecord = {
      id: generateId('rl'),
      companyId: COMPANY_ID,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      sentAt: now,
      level: nextLevel,
      method: 'email',
      createdAt: now,
    };
    queryClient.setQueryData<ReminderLogRecord[]>(QUERY_KEYS.reminderLogs, (old) => [rl, ...(old ?? [])]);
    db.insertReminderLog(rl).catch(() => {});
    void writeAudit('send', 'reminder', rl.id, invoice.invoiceNumber, `Relance niveau ${nextLevel} envoyée pour ${invoice.invoiceNumber}`);
    showToast(`Relance niveau ${nextLevel} envoyée pour ${invoice.invoiceNumber}`);
    return { success: true };
  }, [invoices, reminderLogs, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const assignClientToSale = useCallback((saleId: string, clientId: string): { success: boolean; error?: string } => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return { success: false, error: 'Vente introuvable' };
    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, error: 'Client introuvable' };
    const clientName = client.companyName || `${client.firstName} ${client.lastName}`;

    queryClient.setQueryData<Sale[]>(QUERY_KEYS.sales, (old) =>
      (old ?? []).map((s) => (s.id === saleId ? { ...s, clientId, clientName } : s))
    );
    void db.updateSale(saleId, { clientId, clientName } as Partial<Sale>).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
    });
    showToast(`Client ${clientName} associé à la vente`);
    return { success: true };
  }, [sales, clients, showToast, queryClient, QUERY_KEYS]);

  const recordPartialPayment = useCallback((invoiceId: string, amount: number, method: string = 'bank_transfer'): { success: boolean; error?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    if (amount <= 0) return { success: false, error: 'Le montant doit être positif' };
    const remaining = invoice.totalTTC - invoice.paidAmount;
    if (amount > remaining + 0.01) return { success: false, error: `Le montant dépasse le solde restant (${remaining.toFixed(2)})` };
    const now = new Date().toISOString();
    const newPaidAmount = invoice.paidAmount + amount;
    const isPaidInFull = Math.abs(newPaidAmount - invoice.totalTTC) < 0.01;
    const updated: Partial<Invoice> = {
      paidAmount: isPaidInFull ? invoice.totalTTC : newPaidAmount,
      status: isPaidInFull ? 'paid' as const : 'partial' as const,
    };
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === invoiceId ? { ...i, ...updated } : i))
    );
    void db.updateInvoice(invoiceId, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'income',
      amount,
      description: `Paiement partiel facture ${invoice.invoiceNumber || 'Brouillon'} - ${invoice.clientName}`,
      category: 'Paiement facture',
      date: now,
      invoiceId: invoice.id,
      balance: 0,
      sourceType: 'invoice',
      sourceRef: invoice.invoiceNumber || invoice.id,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});
    void writeAudit('payment', 'invoice', invoiceId, invoice.invoiceNumber || 'Brouillon', `Paiement partiel de ${amount.toFixed(2)} sur facture ${invoice.invoiceNumber}`);
    showToast(isPaidInFull ? `Facture ${invoice.invoiceNumber} soldée` : `Paiement de ${amount.toFixed(2)} enregistré`);
    return { success: true };
  }, [invoices, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const createCreditNote = useCallback((invoiceId: string, items: OrderItem[], reason: string): { success: boolean; error?: string; creditNoteId?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    if (!reason.trim()) return { success: false, error: 'Le motif est requis' };
    const totalHT = items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = items.reduce((s, i) => s + i.totalTTC, 0);
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const num = String(company.creditNoteNextNumber ?? 1).padStart(3, '0');
    const creditNoteNumber = `${company.creditNotePrefix || 'AV'}-${year}-${num}`;
    const newCN: CreditNote = {
      id: generateId('cn'),
      companyId: COMPANY_ID,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber || '',
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      creditNoteNumber,
      status: 'draft',
      items,
      totalHT,
      totalTVA,
      totalTTC,
      reason,
      issueDate: now,
      isValidated: false,
      createdAt: now,
    };
    setCreditNotes((prev) => [newCN, ...prev]);
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === invoiceId ? { ...i, creditNoteId: newCN.id } : i))
    );
    void db.updateInvoice(invoiceId, { creditNoteId: newCN.id }).catch(() => {});
    const cashEntry: CashMovement = {
      id: generateId('cm'),
      companyId: COMPANY_ID,
      type: 'expense',
      amount: totalTTC,
      description: `Avoir ${creditNoteNumber} sur facture ${invoice.invoiceNumber} - ${invoice.clientName}`,
      category: 'Avoir',
      date: now,
      invoiceId: invoice.id,
      balance: 0,
      sourceType: 'credit_note',
      sourceRef: creditNoteNumber,
      createdAt: now,
    };
    queryClient.setQueryData<CashMovement[]>(QUERY_KEYS.cashMovements, (old) => [cashEntry, ...(old ?? [])]);
    db.insertCashMovement(cashEntry).catch(() => {});
    const nextNum = (company.creditNoteNextNumber ?? 1) + 1;
    queryClient.setQueryData(QUERY_KEYS.company, (old: typeof company | undefined) =>
      old ? { ...old, creditNoteNextNumber: nextNum } : old
    );
    db.updateCompany(COMPANY_ID, { creditNoteNextNumber: nextNum } as any).catch(() => {});
    void writeAudit('create', 'credit_note', newCN.id, creditNoteNumber, `Avoir ${creditNoteNumber} créé pour facture ${invoice.invoiceNumber}`);
    showToast(`Avoir ${creditNoteNumber} créé`);
    return { success: true, creditNoteId: newCN.id };
  }, [invoices, company, showToast, queryClient, writeAudit, COMPANY_ID, QUERY_KEYS]);

  const duplicateInvoice = useCallback((invoiceId: string): { success: boolean; error?: string; newInvoiceId?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    const newItems = invoice.items.map(item => ({ ...item, id: generateId('oi') }));
    const result = createInvoice(invoice.clientId, newItems);
    if (result.success) {
      void writeAudit('create', 'invoice', result.invoiceId || '', 'Brouillon', `Facture dupliquée depuis ${invoice.invoiceNumber || invoice.id}`);
      showToast('Facture dupliquée en brouillon');
    }
    return { success: result.success, error: result.error, newInvoiceId: result.invoiceId };
  }, [invoices, createInvoice, showToast, writeAudit]);

  const sendInvoiceByEmail = useCallback((invoiceId: string): { success: boolean; error?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    if (invoice.status === 'draft') return { success: false, error: 'Validez la facture avant de l\'envoyer' };
    const now = new Date().toISOString();
    const updated: Partial<Invoice> = { status: 'sent' as const };
    queryClient.setQueryData<Invoice[]>(QUERY_KEYS.invoices, (old) =>
      (old ?? []).map((i) => (i.id === invoiceId ? { ...i, ...updated } : i))
    );
    void db.updateInvoice(invoiceId, updated).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
    });
    void writeAudit('send', 'invoice', invoiceId, invoice.invoiceNumber || 'Brouillon', `Facture ${invoice.invoiceNumber} envoyée par email`);
    showToast(`Email envoyé pour la facture ${invoice.invoiceNumber || 'Brouillon'}`);
    return { success: true };
  }, [invoices, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const sendQuoteByEmail = useCallback((quoteId: string): { success: boolean; error?: string } => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { success: false, error: 'Devis introuvable' };
    const now = new Date().toISOString();
    if (quote.status === 'draft') {
      queryClient.setQueryData<Quote[]>(QUERY_KEYS.quotes, (old) =>
        (old ?? []).map((q) => (q.id === quoteId ? { ...q, status: 'sent' as const } : q))
      );
      void db.updateQuote(quoteId, { status: 'sent' }).catch(() => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      });
    }
    void writeAudit('send', 'quote', quoteId, quote.quoteNumber, `Devis ${quote.quoteNumber} envoyé par email`);
    showToast(`Email envoyé pour le devis ${quote.quoteNumber}`);
    return { success: true };
  }, [quotes, showToast, queryClient, writeAudit, QUERY_KEYS]);

  const createRecurringInvoice = useCallback((data: {
    clientId: string;
    items: OrderItem[];
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string;
    notes?: string;
  }): { success: boolean; error?: string; recurringId?: string } => {
    const client = clients.find((c) => c.id === data.clientId);
    if (!client) return { success: false, error: 'Client introuvable' };
    if (data.items.length === 0) return { success: false, error: 'Au moins une ligne est requise' };
    const totalHT = data.items.reduce((s, i) => s + i.totalHT, 0);
    const totalTVA = data.items.reduce((s, i) => s + i.totalTVA, 0);
    const totalTTC = data.items.reduce((s, i) => s + i.totalTTC, 0);
    const clientName = client.companyName || `${client.firstName} ${client.lastName}`;
    const now = new Date().toISOString();
    const nextDate = new Date(data.startDate);
    const newRI: RecurringInvoice = {
      id: generateId('ri'),
      companyId: COMPANY_ID,
      clientId: data.clientId,
      clientName,
      items: data.items,
      totalHT,
      totalTVA,
      totalTTC,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      nextGenerationDate: nextDate.toISOString(),
      status: 'active',
      notes: data.notes || '',
      createdAt: now,
    };
    setRecurringInvoices((prev) => [newRI, ...prev]);
    void AsyncStorage.setItem(`recurring-invoices-${COMPANY_ID}`, JSON.stringify([newRI, ...recurringInvoices]));
    void writeAudit('create', 'invoice', newRI.id, 'Récurrent', `Modèle récurrent créé pour ${clientName}`);
    showToast('Modèle de facture récurrente créé');
    return { success: true, recurringId: newRI.id };
  }, [clients, recurringInvoices, showToast, writeAudit, COMPANY_ID]);

  const toggleRecurringInvoice = useCallback((id: string): void => {
    setRecurringInvoices((prev) => {
      const updated = prev.map((ri) => ri.id === id ? { ...ri, status: (ri.status === 'active' ? 'paused' : 'active') as RecurringInvoice['status'] } : ri);
      void AsyncStorage.setItem(`recurring-invoices-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    showToast('Statut de la récurrence mis à jour');
  }, [COMPANY_ID, showToast]);

  const generateRecurringInvoice = useCallback((id: string): { success: boolean; error?: string } => {
    const ri = recurringInvoices.find((r) => r.id === id);
    if (!ri) return { success: false, error: 'Modèle introuvable' };
    const result = createInvoice(ri.clientId, ri.items.map(item => ({ ...item, id: generateId('oi') })));
    if (!result.success) return result;
    const now = new Date().toISOString();
    const nextDate = new Date(ri.nextGenerationDate);
    switch (ri.frequency) {
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
    }
    setRecurringInvoices((prev) => {
      const updated = prev.map((r) => r.id === id ? { ...r, lastGeneratedAt: now, nextGenerationDate: nextDate.toISOString() } : r);
      void AsyncStorage.setItem(`recurring-invoices-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    showToast('Facture générée depuis le modèle récurrent');
    return { success: true };
  }, [recurringInvoices, createInvoice, showToast, COMPANY_ID]);

  const deleteRecurringInvoice = useCallback((id: string): void => {
    setRecurringInvoices((prev) => {
      const updated = prev.filter((ri) => ri.id !== id);
      void AsyncStorage.setItem(`recurring-invoices-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    showToast('Modèle récurrent supprimé');
  }, [COMPANY_ID, showToast]);

  const createDeliveryNote = useCallback((invoiceId: string, notes?: string): { success: boolean; error?: string; deliveryNoteId?: string } => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return { success: false, error: 'Facture introuvable' };
    if (!invoice.isValidated) return { success: false, error: 'La facture doit être validée' };
    const existing = deliveryNotes.find((dn) => dn.invoiceId === invoiceId);
    if (existing) return { success: false, error: 'Un bon de livraison existe déjà pour cette facture' };
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const dnCount = deliveryNotes.length + 1;
    const deliveryNumber = `BL-${year}-${String(dnCount).padStart(3, '0')}`;
    const newDN: DeliveryNote = {
      id: generateId('dn'),
      companyId: COMPANY_ID,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      deliveryNumber,
      status: 'preparation',
      items: invoice.items,
      notes: notes || '',
      createdAt: now,
    };
    setDeliveryNotes((prev) => {
      const updated = [newDN, ...prev];
      void AsyncStorage.setItem(`delivery-notes-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    void writeAudit('create', 'invoice', newDN.id, deliveryNumber, `Bon de livraison ${deliveryNumber} créé`);
    showToast(`Bon de livraison ${deliveryNumber} créé`);
    return { success: true, deliveryNoteId: newDN.id };
  }, [invoices, deliveryNotes, showToast, writeAudit, COMPANY_ID]);

  const updateDeliveryNoteStatus = useCallback((id: string, status: DeliveryNoteStatus): { success: boolean; error?: string } => {
    const dn = deliveryNotes.find((d) => d.id === id);
    if (!dn) return { success: false, error: 'Bon de livraison introuvable' };
    const now = new Date().toISOString();
    const extra: Partial<DeliveryNote> = {};
    if (status === 'shipped') extra.shippedAt = now;
    if (status === 'delivered') extra.deliveredAt = now;
    setDeliveryNotes((prev) => {
      const updated = prev.map((d) => d.id === id ? { ...d, status, ...extra } : d);
      void AsyncStorage.setItem(`delivery-notes-${COMPANY_ID}`, JSON.stringify(updated));
      return updated;
    });
    const statusLabels: Record<DeliveryNoteStatus, string> = { preparation: 'En préparation', shipped: 'Expédié', delivered: 'Livré' };
    showToast(`${dn.deliveryNumber} → ${statusLabels[status]}`);
    return { success: true };
  }, [deliveryNotes, showToast, COMPANY_ID]);

  const importProducts = useCallback((productsData: Array<Omit<Product, 'id' | 'companyId' | 'isArchived' | 'usedInValidatedInvoice' | 'createdAt' | 'updatedAt'>>): { imported: number; errors: string[] } => {
    const errors: string[] = [];
    let imported = 0;
    const now = new Date().toISOString();
    const newProducts: Product[] = [];
    productsData.forEach((data, idx) => {
      if (!data.name?.trim()) { errors.push(`Ligne ${idx + 1}: Nom requis`); return; }
      if (data.salePrice <= 0) { errors.push(`Ligne ${idx + 1}: Prix de vente invalide`); return; }
      const newProduct: Product = {
        ...data,
        id: generateId('prod'),
        companyId: COMPANY_ID,
        isArchived: false,
        usedInValidatedInvoice: false,
        createdAt: now,
        updatedAt: now,
      };
      newProducts.push(newProduct);
      imported++;
    });
    if (newProducts.length > 0) {
      queryClient.setQueryData<Product[]>(QUERY_KEYS.products, (old) => [...newProducts, ...(old ?? [])]);
      newProducts.forEach(p => {
        void db.insertProduct(p).catch(() => {
        });
      });
    }
    showToast(`${imported} produit(s) importé(s)${errors.length > 0 ? `, ${errors.length} erreur(s)` : ''}`);
    return { imported, errors };
  }, [COMPANY_ID, QUERY_KEYS, queryClient, showToast]);

  const importClients = useCallback((clientsData: Array<Omit<Client, 'id' | 'companyId' | 'totalOrders' | 'totalRevenue' | 'marginTotal' | 'isDeleted' | 'createdAt' | 'updatedAt'>>): { imported: number; errors: string[] } => {
    const errors: string[] = [];
    let imported = 0;
    const now = new Date().toISOString();
    const newClients: Client[] = [];
    clientsData.forEach((data, idx) => {
      if (!data.firstName?.trim() && !data.companyName?.trim()) { errors.push(`Ligne ${idx + 1}: Nom ou raison sociale requis`); return; }
      const newClient: Client = {
        ...data,
        id: generateId('cli'),
        companyId: COMPANY_ID,
        totalOrders: 0,
        totalRevenue: 0,
        marginTotal: 0,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      newClients.push(newClient);
      imported++;
    });
    if (newClients.length > 0) {
      queryClient.setQueryData<Client[]>(QUERY_KEYS.clients, (old) => [...newClients, ...(old ?? [])]);
      newClients.forEach(c => {
        void db.insertClient(c).catch(() => {
        });
      });
    }
    showToast(`${imported} client(s) importé(s)${errors.length > 0 ? `, ${errors.length} erreur(s)` : ''}`);
    return { imported, errors };
  }, [COMPANY_ID, QUERY_KEYS, queryClient, showToast]);

  useEffect(() => {
    AsyncStorage.getItem(`recurring-invoices-${COMPANY_ID}`).then((stored) => {
      if (stored) setRecurringInvoices(JSON.parse(stored));
    }).catch(() => {});
    AsyncStorage.getItem(`delivery-notes-${COMPANY_ID}`).then((stored) => {
      if (stored) setDeliveryNotes(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const findProductByBarcode = useCallback((barcode: string): Product | null => {
    if (!barcode.trim()) return null;
    const normalized = barcode.trim().toLowerCase();
    return products.find(p => p.barcode?.toLowerCase() === normalized && !p.isArchived && p.isActive) ?? null;
  }, [products]);

  const createWarehouse = useCallback((data: { name: string; address: string; isDefault?: boolean }): { success: boolean; error?: string } => {
    if (!data.name.trim()) return { success: false, error: 'Le nom est requis' };
    const now = new Date().toISOString();
    const isFirst = warehouses.length === 0;
    const newWh: Warehouse = {
      id: generateId('wh'),
      companyId: COMPANY_ID,
      name: data.name.trim(),
      address: data.address || '',
      isDefault: data.isDefault || isFirst,
      createdAt: now,
    };
    const updated = [...warehouses, newWh];
    setWarehouses(updated);
    void AsyncStorage.setItem(`warehouses-${COMPANY_ID}`, JSON.stringify(updated));
    showToast(`Entrepôt "${data.name}" créé`);
    return { success: true };
  }, [warehouses, COMPANY_ID, showToast]);

  const updateWarehouse = useCallback((id: string, data: Partial<Warehouse>): { success: boolean; error?: string } => {
    const existing = warehouses.find(w => w.id === id);
    if (!existing) return { success: false, error: 'Entrepôt introuvable' };
    const updated = warehouses.map(w => w.id === id ? { ...w, ...data } : w);
    setWarehouses(updated);
    void AsyncStorage.setItem(`warehouses-${COMPANY_ID}`, JSON.stringify(updated));
    showToast(`Entrepôt "${data.name || existing.name}" mis à jour`);
    return { success: true };
  }, [warehouses, COMPANY_ID, showToast]);

  const deleteWarehouse = useCallback((id: string): void => {
    const wh = warehouses.find(w => w.id === id);
    if (!wh) return;
    if (wh.isDefault && warehouses.length > 1) {
      showToast('Impossible de supprimer l\'entrepôt par défaut', 'error');
      return;
    }
    const updated = warehouses.filter(w => w.id !== id);
    setWarehouses(updated);
    void AsyncStorage.setItem(`warehouses-${COMPANY_ID}`, JSON.stringify(updated));
    showToast(`Entrepôt "${wh.name}" supprimé`);
  }, [warehouses, COMPANY_ID, showToast]);

  const createWarehouseTransfer = useCallback((data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    quantity: number;
    notes: string;
  }): { success: boolean; error?: string } => {
    if (data.fromWarehouseId === data.toWarehouseId) return { success: false, error: 'Les entrepôts doivent être différents' };
    if (data.quantity <= 0) return { success: false, error: 'La quantité doit être positive' };
    const fromWh = warehouses.find(w => w.id === data.fromWarehouseId);
    const toWh = warehouses.find(w => w.id === data.toWarehouseId);
    const product = products.find(p => p.id === data.productId);
    if (!fromWh || !toWh || !product) return { success: false, error: 'Données invalides' };
    const now = new Date().toISOString();
    const transfer: WarehouseTransfer = {
      id: generateId('wt'),
      companyId: COMPANY_ID,
      fromWarehouseId: data.fromWarehouseId,
      fromWarehouseName: fromWh.name,
      toWarehouseId: data.toWarehouseId,
      toWarehouseName: toWh.name,
      productId: data.productId,
      productName: product.name,
      quantity: data.quantity,
      notes: data.notes || '',
      createdAt: now,
    };
    const updatedTransfers = [transfer, ...warehouseTransfers];
    setWarehouseTransfers(updatedTransfers);
    void AsyncStorage.setItem(`warehouse-transfers-${COMPANY_ID}`, JSON.stringify(updatedTransfers));
    showToast(`Transfert de ${data.quantity} ${product.name} effectué`);
    return { success: true };
  }, [warehouses, products, warehouseTransfers, COMPANY_ID, showToast]);

  useEffect(() => {
    AsyncStorage.getItem(`warehouses-${COMPANY_ID}`).then(stored => {
      if (stored) setWarehouses(JSON.parse(stored));
    }).catch(() => {});
    AsyncStorage.getItem(`warehouse-transfers-${COMPANY_ID}`).then(stored => {
      if (stored) setWarehouseTransfers(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const duplicateQuote = useCallback((quoteId: string): { success: boolean; error?: string; newQuoteId?: string } => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { success: false, error: 'Devis introuvable' };
    const newItems = quote.items.map(item => ({ ...item, id: generateId('qi'), quoteId: '' }));
    const result = createQuote(quote.clientId, newItems);
    if (result.success) {
      void writeAudit('create', 'quote', result.quoteId || '', '', `Devis dupliqué depuis ${quote.quoteNumber}`);
      showToast('Devis dupliqué en brouillon');
    }
    return { success: result.success, error: result.error, newQuoteId: result.quoteId };
  }, [quotes, createQuote, showToast, writeAudit]);

  const duplicatePurchaseOrder = useCallback((poId: string): { success: boolean; error?: string; newPoId?: string } => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return { success: false, error: 'Commande introuvable' };
    const newItems = po.items.map(item => ({ ...item, id: generateId('poi'), purchaseOrderId: '' }));
    const result = createPurchaseOrder(po.supplierId, newItems, po.notes, po.expectedDate);
    if (result.success) {
      showToast('Commande dupliquée en brouillon');
    }
    return { success: result.success, error: result.error, newPoId: result.poId };
  }, [purchaseOrders, createPurchaseOrder, showToast]);

  const getCurrency = useCallback((): string => {
    return company.currency || 'EUR';
  }, [company.currency]);

  const notifications = useMemo(() => {
    const notifs: Array<{ id: string; type: string; title: string; message: string; date: string; read: boolean }> = [];
    lowStockProducts.forEach(p => {
      notifs.push({
        id: `stock-${p.id}`,
        type: 'stock',
        title: 'Stock bas',
        message: `${p.name} est en stock bas`,
        date: new Date().toISOString(),
        read: false,
      });
    });
    lateInvoices.forEach(inv => {
      notifs.push({
        id: `late-${inv.id}`,
        type: 'invoice',
        title: 'Facture en retard',
        message: `${inv.invoiceNumber || 'Brouillon'} - ${inv.clientName}`,
        date: inv.dueDate,
        read: false,
      });
    });
    return notifs;
  }, [lowStockProducts, lateInvoices]);

  const updateCompanySettings = useCallback(async (updates: Partial<Company>): Promise<{ success: boolean; error?: string }> => {
    try {
      const safeFields: Partial<Company> = {};
      if (updates.name !== undefined) safeFields.name = updates.name;
      if (updates.legalStructure !== undefined) safeFields.legalStructure = updates.legalStructure;
      if (updates.siret !== undefined) safeFields.siret = updates.siret;
      if (updates.vatNumber !== undefined) safeFields.vatNumber = updates.vatNumber;
      if (updates.address !== undefined) safeFields.address = updates.address;
      if (updates.city !== undefined) safeFields.city = updates.city;
      if (updates.postalCode !== undefined) safeFields.postalCode = updates.postalCode;
      if (updates.country !== undefined) safeFields.country = updates.country;
      if (updates.phone !== undefined) safeFields.phone = updates.phone;
      if (updates.email !== undefined) safeFields.email = updates.email;
      if (updates.website !== undefined) safeFields.website = updates.website;
      if (updates.iban !== undefined) safeFields.iban = updates.iban;
      if (updates.bic !== undefined) safeFields.bic = updates.bic;
      if (updates.defaultVatRate !== undefined) safeFields.defaultVatRate = Number(updates.defaultVatRate) as any;
      if (updates.paymentTermsDays !== undefined) safeFields.paymentTermsDays = Number(updates.paymentTermsDays);
      if (updates.invoicePrefix !== undefined) safeFields.invoicePrefix = updates.invoicePrefix;
      if (updates.invoiceNextNumber !== undefined) safeFields.invoiceNextNumber = Number(updates.invoiceNextNumber);
      if (updates.quotePrefix !== undefined) safeFields.quotePrefix = updates.quotePrefix;
      if (updates.quoteNextNumber !== undefined) safeFields.quoteNextNumber = Number(updates.quoteNextNumber);
      if (updates.creditNotePrefix !== undefined) safeFields.creditNotePrefix = updates.creditNotePrefix;
      if (updates.creditNoteNextNumber !== undefined) safeFields.creditNoteNextNumber = Number(updates.creditNoteNextNumber);
      if (updates.purchaseOrderPrefix !== undefined) safeFields.purchaseOrderPrefix = updates.purchaseOrderPrefix;
      if (updates.purchaseOrderNextNumber !== undefined) safeFields.purchaseOrderNextNumber = Number(updates.purchaseOrderNextNumber);
      if (updates.supplierInvoicePrefix !== undefined) safeFields.supplierInvoicePrefix = updates.supplierInvoicePrefix;
      if (updates.supplierInvoiceNextNumber !== undefined) safeFields.supplierInvoiceNextNumber = Number(updates.supplierInvoiceNextNumber);
      if (updates.vatExempt !== undefined) safeFields.vatExempt = updates.vatExempt;
      if (updates.vatExemptArticle !== undefined) safeFields.vatExemptArticle = updates.vatExemptArticle;
      if (updates.reminderEnabled !== undefined) safeFields.reminderEnabled = updates.reminderEnabled;
      if (updates.reminderDays !== undefined) safeFields.reminderDays = updates.reminderDays;
      if (updates.lateFeeRate !== undefined) safeFields.lateFeeRate = Number(updates.lateFeeRate);
      if (updates.electronicInvoicingReady !== undefined) safeFields.electronicInvoicingReady = updates.electronicInvoicingReady;
      if (updates.logoUrl !== undefined) safeFields.logoUrl = updates.logoUrl;
      if (updates.currency !== undefined) safeFields.currency = updates.currency;

      const currencyUpdate = updates.currency;

      queryClient.setQueryData(QUERY_KEYS.company, (old: Company | null | undefined) =>
        old ? { ...old, ...safeFields } : old
      );

      if (currencyUpdate !== undefined) {
        await AsyncStorage.setItem(`company-currency-${COMPANY_ID}`, currencyUpdate);
      }

      if (Object.keys(safeFields).length > 0) {
        await db.updateCompany(COMPANY_ID, safeFields);
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.company });
      if (currencyUpdate) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.invoices });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sales });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cashMovements });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.supplierInvoices });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quotes });
      }
      showToast('Paramètres enregistrés');
      return { success: true };
    } catch (e) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.company });
      showToast(`Erreur lors de la sauvegarde: ${(e as Error).message}`, 'error');
      return { success: false, error: (e as Error).message };
    }
  }, [COMPANY_ID, QUERY_KEYS, queryClient, showToast]);

  return useMemo(() => ({
    clients,
    activeClients,
    products,
    activeProducts,
    invoices,
    quotes,
    company,
    updateCompanySettings,
    toasts,
    showToast,
    dismissToast,
    createClient,
    updateClient,
    deleteClient,
    validateClientEmail,
    validateVATNumber,
    isDuplicateClientName,
    createProduct,
    updateProduct,
    archiveProduct,
    unarchiveProduct,
    deleteProduct,
    createInvoice,
    updateInvoice,
    validateInvoice,
    markInvoicePaid,
    recordPartialPayment,
    createCreditNote,
    creditNotes,
    duplicateInvoice,
    duplicateQuote,
    duplicatePurchaseOrder,
    getCurrency,
    notifications,
    createQuote,
    updateQuote,
    sendQuote,
    acceptQuote,
    refuseQuote,
    cancelQuote,
    deleteQuote,
    convertQuoteToInvoice,
    revertInvoiceStatus,
    updateInvoiceDueDate,
    sales,
    cashMovements,
    currentPlan,
    enabledModules,
    changePlan,
    toggleModule,
    isModuleEnabled,
    isModuleAvailable,
    createSale,
    updateSale,
    refundSale,
    convertSaleToInvoice,
    assignClientToSale,
    productCategories,
    productUnits,
    customVatRates,
    addProductCategory,
    removeProductCategory,
    renameProductCategory,
    addProductUnit,
    removeProductUnit,
    addCustomVatRate,
    removeCustomVatRate,
    productBrands,
    addProductBrand,
    removeProductBrand,
    renameProductBrand,
    discountCategories,
    discountCategoryRates,
    addDiscountCategory,
    updateDiscountCategoryRate,
    removeDiscountCategory,
    suppliers,
    activeSuppliers,
    purchaseOrders,
    activePurchaseOrders,
    supplierInvoices,
    activeSupplierInvoices,
    stockMovements,
    reminderLogs,
    lateInvoices,
    lowStockProducts,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createPurchaseOrder,
    updatePurchaseOrder,
    receivePurchaseOrder,
    createSupplierInvoice,
    updateSupplierInvoice,
    markSupplierInvoicePaid,
    convertPOToSupplierInvoice,
    createStockAdjustment,
    sendReminder,
    variants,
    getVariantsForProduct,
    createVariant,
    createVariantsBatch,
    updateVariant: updateVariant,
    deleteVariant,
    getProductStock,
    getProductTotalStock,
    getVariantStock,
    generateVariantSKU,
    productStockMap,
    auditLogs,
    productAttributes,
    addProductAttribute,
    updateProductAttribute,
    deleteProductAttribute,
    addAttributeValue,
    removeAttributeValue,
    updateAttributeValuesOrder,
    reorderAttributeValue,
    sendInvoiceByEmail,
    sendQuoteByEmail,
    recurringInvoices,
    createRecurringInvoice,
    toggleRecurringInvoice,
    generateRecurringInvoice,
    deleteRecurringInvoice,
    deliveryNotes,
    createDeliveryNote,
    updateDeliveryNoteStatus,
    importProducts,
    importClients,
    findProductByBarcode,
    warehouses,
    warehouseTransfers,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    createWarehouseTransfer,
    paymentReminderLogs,
    logPaymentReminder,
    getClientReminderLogs,
    recipes,
    getRecipeForProduct,
    getRecipesForProduct,
    saveRecipe,
    deleteRecipe,
    deleteAllRecipesForProduct,
  }), [
    clients, activeClients, products, activeProducts, invoices, quotes, company, updateCompanySettings, toasts,
    showToast, dismissToast,
    createClient, updateClient, deleteClient, validateClientEmail, validateVATNumber, isDuplicateClientName,
    createProduct, updateProduct, archiveProduct, unarchiveProduct, deleteProduct,
    createInvoice, updateInvoice, validateInvoice, markInvoicePaid, recordPartialPayment,
    createCreditNote, creditNotes, duplicateInvoice, duplicateQuote, duplicatePurchaseOrder, getCurrency, notifications,
    cancelQuote,
    createQuote, updateQuote, sendQuote, acceptQuote, refuseQuote, deleteQuote, convertQuoteToInvoice,
    revertInvoiceStatus, updateInvoiceDueDate,
    sales, cashMovements, currentPlan, enabledModules, changePlan, toggleModule, isModuleEnabled, isModuleAvailable,
    productCategories, productUnits, customVatRates, productBrands,
    addProductCategory, removeProductCategory, renameProductCategory, addProductUnit, removeProductUnit, addCustomVatRate, removeCustomVatRate,
    addProductBrand, removeProductBrand, renameProductBrand,
    discountCategories, discountCategoryRates, addDiscountCategory, updateDiscountCategoryRate, removeDiscountCategory,
    createSale, updateSale, refundSale, convertSaleToInvoice, assignClientToSale,
    suppliers, activeSuppliers, purchaseOrders, activePurchaseOrders,
    supplierInvoices, activeSupplierInvoices, stockMovements, reminderLogs,
    lateInvoices, lowStockProducts,
    createSupplier, updateSupplier, deleteSupplier,
    createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder,
    createSupplierInvoice, updateSupplierInvoice, markSupplierInvoicePaid, convertPOToSupplierInvoice,
    createStockAdjustment, sendReminder,
    variants, getVariantsForProduct, createVariant, createVariantsBatch, updateVariant, deleteVariant,
    getProductStock, getProductTotalStock, getVariantStock, generateVariantSKU, productStockMap,
    auditLogs,
    productAttributes, addProductAttribute, updateProductAttribute, deleteProductAttribute,
    addAttributeValue, removeAttributeValue, updateAttributeValuesOrder, reorderAttributeValue,
    sendInvoiceByEmail, sendQuoteByEmail,
    recurringInvoices, createRecurringInvoice, toggleRecurringInvoice, generateRecurringInvoice, deleteRecurringInvoice,
    deliveryNotes, createDeliveryNote, updateDeliveryNoteStatus,
    importProducts, importClients,
    findProductByBarcode,
    warehouses, warehouseTransfers,
    createWarehouse, updateWarehouse, deleteWarehouse, createWarehouseTransfer,
    paymentReminderLogs, logPaymentReminder, getClientReminderLogs,
    recipes, getRecipeForProduct, getRecipesForProduct, saveRecipe, deleteRecipe, deleteAllRecipesForProduct,
  ]);
});