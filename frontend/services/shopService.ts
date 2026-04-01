/**
 * @fileoverview Shop/e-commerce database service.
 * Handles CRUD operations for shops, shop orders, and product publication status.
 * All queries use Supabase with text-based company_id foreign keys.
 *
 * IMPORTANT: DB columns use snake_case, but the app uses camelCase interfaces.
 * Every fetch method MUST map rows through a mapXxxFromDB function to avoid
 * "Cannot read properties of undefined" errors (e.g. product.salePrice when
 * the DB returns sale_price).
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { Shop, ShopOrder, ShopOrderItem, Product, ProductVariant, VATRate } from '@/types';
import { normalizeProductType } from '@/constants/productTypes';

/** Safely converts an unknown DB value to a number, defaulting to 0. */
function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

/** Coerces an unknown DB value into a valid French VAT rate. */
function toVATRate(val: unknown): VATRate {
  const n = toNumber(val);
  if (n === 20 || n === 10 || n === 5.5 || n === 2.1 || n === 0) return n;
  return 20;
}

/**
 * Maps a raw DB row (snake_case) to the Product interface (camelCase).
 * This is the shop-service-local version, identical in logic to supabaseData's mapper.
 */
function mapProductFromDB(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    companyId: (row.company_id as string) || '',
    name: (row.name as string) || '',
    description: (row.description as string) || '',
    sku: (row.sku as string) || '',
    categoryName: (row.category_name as string) || undefined,
    supplierId: (row.supplier_id as string) || undefined,
    supplierName: (row.supplier_name as string) || undefined,
    brand: (row.brand as string) || undefined,
    purchasePrice: toNumber(row.purchase_price),
    salePrice: toNumber(row.sale_price),
    vatRate: toVATRate(row.vat_rate),
    stockQuantity: toNumber(row.stock_quantity),
    lowStockThreshold: toNumber(row.low_stock_threshold),
    unit: (row.unit as string) || 'piece',
    type: normalizeProductType(row.type),
    photoUrl: (row.photo_url as string) || undefined,
    isActive: row.is_active !== false,
    isArchived: row.is_archived === true,
    usedInValidatedInvoice: row.used_in_validated_invoice === true,
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

/**
 * Maps a raw DB row (snake_case) to the ProductVariant interface (camelCase).
 */
function mapVariantFromDB(row: Record<string, unknown>): ProductVariant {
  let attrs: Record<string, string> = {};
  if (typeof row.attributes === 'string') {
    try { attrs = JSON.parse(row.attributes); } catch { attrs = {}; }
  } else if (row.attributes && typeof row.attributes === 'object') {
    attrs = row.attributes as Record<string, string>;
  }
  return {
    id: row.id as string,
    productId: (row.product_id as string) || '',
    companyId: (row.company_id as string) || '',
    attributes: attrs,
    sku: (row.sku as string) || '',
    purchasePrice: toNumber(row.purchase_price),
    salePrice: toNumber(row.sale_price),
    stockQuantity: toNumber(row.stock_quantity),
    minStock: toNumber(row.min_stock),
    isActive: row.is_active !== false,
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

function mapShopFromDB(row: Record<string, unknown>): Shop {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    slug: row.slug as string,
    name: (row.name as string) || '',
    description: (row.description as string) || '',
    logoUrl: (row.logo_url as string) || '',
    bannerUrl: (row.banner_url as string) || '',
    primaryColor: (row.primary_color as string) || '#2563EB',
    contactPhone: (row.contact_phone as string) || '',
    contactEmail: (row.contact_email as string) || '',
    contactAddress: (row.contact_address as string) || '',
    welcomeMessage: (row.welcome_message as string) || '',
    deliveryPickup: row.delivery_pickup as boolean,
    deliveryShipping: row.delivery_shipping as boolean,
    shippingPrice: toNumber(row.shipping_price),
    paymentInStore: row.payment_in_store as boolean,
    paymentBankTransfer: row.payment_bank_transfer as boolean,
    bankDetails: (row.bank_details as string) || '',
    paymentOnDelivery: row.payment_on_delivery as boolean,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapShopToDB(shop: Partial<Shop>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (shop.id !== undefined) m.id = shop.id;
  if (shop.companyId !== undefined) m.company_id = shop.companyId;
  if (shop.slug !== undefined) m.slug = shop.slug;
  if (shop.name !== undefined) m.name = shop.name;
  if (shop.description !== undefined) m.description = shop.description;
  if (shop.logoUrl !== undefined) m.logo_url = shop.logoUrl;
  if (shop.bannerUrl !== undefined) m.banner_url = shop.bannerUrl;
  if (shop.primaryColor !== undefined) m.primary_color = shop.primaryColor;
  if (shop.contactPhone !== undefined) m.contact_phone = shop.contactPhone;
  if (shop.contactEmail !== undefined) m.contact_email = shop.contactEmail;
  if (shop.contactAddress !== undefined) m.contact_address = shop.contactAddress;
  if (shop.welcomeMessage !== undefined) m.welcome_message = shop.welcomeMessage;
  if (shop.deliveryPickup !== undefined) m.delivery_pickup = shop.deliveryPickup;
  if (shop.deliveryShipping !== undefined) m.delivery_shipping = shop.deliveryShipping;
  if (shop.shippingPrice !== undefined) m.shipping_price = shop.shippingPrice;
  if (shop.paymentInStore !== undefined) m.payment_in_store = shop.paymentInStore;
  if (shop.paymentBankTransfer !== undefined) m.payment_bank_transfer = shop.paymentBankTransfer;
  if (shop.bankDetails !== undefined) m.bank_details = shop.bankDetails;
  if (shop.paymentOnDelivery !== undefined) m.payment_on_delivery = shop.paymentOnDelivery;
  if (shop.isActive !== undefined) m.is_active = shop.isActive;
  m.updated_at = new Date().toISOString();
  return m;
}

function mapShopOrderFromDB(row: Record<string, unknown>): ShopOrder {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    shopId: (row.shop_id as string) || '',
    orderNumber: (row.order_number as string) || '',
    status: (row.status as ShopOrder['status']) || 'nouvelle',
    customerFirstName: (row.customer_first_name as string) || '',
    customerLastName: (row.customer_last_name as string) || '',
    customerEmail: (row.customer_email as string) || '',
    customerPhone: (row.customer_phone as string) || '',
    customerAddress: (row.customer_address as string) || '',
    deliveryMode: (row.delivery_mode as ShopOrder['deliveryMode']) || 'pickup',
    paymentMethod: (row.payment_method as string) || '',
    subtotalHt: toNumber(row.subtotal_ht),
    tvaAmount: toNumber(row.tva_amount),
    shippingCost: toNumber(row.shipping_cost),
    totalTtc: toNumber(row.total_ttc),
    notes: (row.notes as string) || '',
    items: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapShopOrderItemFromDB(row: Record<string, unknown>): ShopOrderItem {
  let variantInfo: Record<string, string> = {};
  if (typeof row.variant_info === 'string') {
    try { variantInfo = JSON.parse(row.variant_info); } catch { variantInfo = {}; }
  } else if (row.variant_info && typeof row.variant_info === 'object') {
    variantInfo = row.variant_info as Record<string, string>;
  }
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    productId: (row.product_id as string) || '',
    variantInfo,
    productName: (row.product_name as string) || '',
    unitPrice: toNumber(row.unit_price),
    quantity: toNumber(row.quantity),
    totalPrice: toNumber(row.total_price),
  };
}

export const shopDb = {
  async fetchShop(companyId: string): Promise<Shop | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error || !data) return null;
      return mapShopFromDB(data as Record<string, unknown>);
    } catch {
      return null;
    }
  },

  async upsertShop(shop: Partial<Shop> & { companyId: string }): Promise<Shop | null> {
    if (!isSupabaseConfigured) return null;
    const payload = mapShopToDB(shop);
    const existing = await this.fetchShop(shop.companyId);
    if (existing) {
      const { data, error } = await supabase
        .from('shops')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`[ShopDB] upsertShop update: ${error.message}`);
      return mapShopFromDB(data as Record<string, unknown>);
    } else {
      const { data, error } = await supabase
        .from('shops')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`[ShopDB] upsertShop insert: ${error.message}`);
      return mapShopFromDB(data as Record<string, unknown>);
    }
  },

  async updateShop(shopId: string, updates: Partial<Shop>): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from('shops').update(mapShopToDB(updates)).eq('id', shopId);
    if (error) throw new Error(`[ShopDB] updateShop: ${error.message}`);
  },

  async checkSlugAvailable(slug: string, excludeShopId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return true;
    let query = supabase.from('shops').select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (excludeShopId) {
      query = query.neq('id', excludeShopId);
    }
    const { count } = await query;
    return (count ?? 0) === 0;
  },

  async fetchShopBySlug(slug: string): Promise<Shop | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      return mapShopFromDB(data as Record<string, unknown>);
    } catch {
      return null;
    }
  },

  /** Fetches products marked as published for the public storefront. Maps snake_case → camelCase. */
  async fetchPublishedProducts(companyId: string): Promise<Product[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('published_on_shop', true)
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('shop_sort_order', { ascending: true });
      if (error || !data) {
        return [];
      }
      return (data as Record<string, unknown>[]).map(mapProductFromDB);
    } catch (e) {
      return [];
    }
  },

  /** Fetches all product variants for a company. Maps snake_case → camelCase. */
  async fetchProductVariants(companyId: string): Promise<ProductVariant[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('company_id', companyId);
      if (error || !data) {
        return [];
      }
      return (data as Record<string, unknown>[]).map(mapVariantFromDB);
    } catch (e) {
      return [];
    }
  },

  async updateProductShopStatus(productId: string, published: boolean, sortOrder?: number): Promise<void> {
    if (!isSupabaseConfigured) return;
    const updates: Record<string, unknown> = { published_on_shop: published };
    if (sortOrder !== undefined) updates.shop_sort_order = sortOrder;
    const { error } = await supabase.from('products').update(updates).eq('id', productId);
    if (error) throw new Error(`[ShopDB] updateProductShopStatus: ${error.message}`);
  },

  async fetchShopOrders(companyId: string): Promise<ShopOrder[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (ordersError || !ordersData) return [];

      const orders = (ordersData as Record<string, unknown>[]).map(mapShopOrderFromDB);

      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: itemsData } = await supabase
          .from('shop_order_items')
          .select('*')
          .in('order_id', orderIds);

        if (itemsData) {
          const itemsByOrder: Record<string, ShopOrderItem[]> = {};
          (itemsData as Record<string, unknown>[]).forEach(row => {
            const item = mapShopOrderItemFromDB(row);
            if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
            itemsByOrder[item.orderId].push(item);
          });
          orders.forEach(order => {
            order.items = itemsByOrder[order.id] || [];
          });
        }
      }

      return orders;
    } catch {
      return [];
    }
  },

  async createShopOrder(
    order: {
      companyId: string;
      shopId: string;
      customerFirstName: string;
      customerLastName: string;
      customerEmail: string;
      customerPhone: string;
      customerAddress: string;
      deliveryMode: string;
      paymentMethod: string;
      subtotalHt: number;
      tvaAmount: number;
      shippingCost: number;
      totalTtc: number;
      notes: string;
    },
    items: Array<{
      productId: string;
      variantInfo: Record<string, string>;
      productName: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }>
  ): Promise<{ orderId: string; orderNumber: string } | null> {
    if (!isSupabaseConfigured) return null;

    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `CMD-${year}-${rand}`;

    const { data: orderData, error: orderError } = await supabase
      .from('shop_orders')
      .insert({
        company_id: order.companyId,
        shop_id: order.shopId,
        order_number: orderNumber,
        status: 'en_attente',
        customer_first_name: order.customerFirstName,
        customer_last_name: order.customerLastName,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        customer_address: order.customerAddress,
        delivery_mode: order.deliveryMode,
        payment_method: order.paymentMethod,
        subtotal_ht: order.subtotalHt,
        tva_amount: order.tvaAmount,
        shipping_cost: order.shippingCost,
        total_ttc: order.totalTtc,
        notes: order.notes,
      })
      .select()
      .single();

    if (orderError || !orderData) {
      return null;
    }

    const orderId = (orderData as Record<string, unknown>).id as string;

    if (items.length > 0) {
      const itemsPayload = items.map(item => ({
        order_id: orderId,
        product_id: item.productId,
        variant_info: item.variantInfo,
        product_name: item.productName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        total_price: item.totalPrice,
      }));

      const { error: itemsError } = await supabase
        .from('shop_order_items')
        .insert(itemsPayload);

      if (itemsError) {
      }
    }

    return { orderId, orderNumber };
  },

  async updateShopOrderStatus(orderId: string, status: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from('shop_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw new Error(`[ShopDB] updateShopOrderStatus: ${error.message}`);
  },

  async fetchOrderWithItems(orderId: string): Promise<ShopOrder | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (orderError || !orderData) return null;

      const order = mapShopOrderFromDB(orderData as Record<string, unknown>);

      const { data: itemsData } = await supabase
        .from('shop_order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsData) {
        order.items = (itemsData as Record<string, unknown>[]).map(mapShopOrderItemFromDB);
      }

      return order;
    } catch {
      return null;
    }
  },

  async decrementStock(productId: string, quantity: number): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();
      if (data) {
        const current = toNumber((data as Record<string, unknown>).stock_quantity);
        const newStock = Math.max(0, current - quantity);
        await supabase
          .from('products')
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq('id', productId);
      }
    } catch (e) {
    }
  },
};
