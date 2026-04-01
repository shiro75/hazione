/**
 * @fileoverview Shopping cart context for the public storefront.
 * Manages cart items (add, update quantity, remove, clear) with AsyncStorage persistence.
 * Each shop slug has its own isolated cart stored under key `shop-cart-{slug}`.
 * Provides computed totals (totalItems, subtotal) via useMemo.
 */
import React, { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem } from '@/types';

export const [ShopCartProvider, useShopCart] = createContextHook(() => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [shopSlug, setShopSlug] = useState<string>('');

  const loadCart = useCallback(async (slug: string) => {
    setShopSlug(slug);
    try {
      const stored = await AsyncStorage.getItem(`shop-cart-${slug}`);
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }, []);

  const persistCart = useCallback(async (newItems: CartItem[], slug: string) => {
    try {
      await AsyncStorage.setItem(`shop-cart-${slug}`, JSON.stringify(newItems));
    } catch {}
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const variantKey = JSON.stringify(item.variantInfo);
      const existing = prev.find(
        i => i.productId === item.productId && JSON.stringify(i.variantInfo) === variantKey
      );
      let updated: CartItem[];
      if (existing) {
        const newQty = Math.min(existing.quantity + item.quantity, item.maxStock || 999);
        updated = prev.map(i =>
          i.productId === item.productId && JSON.stringify(i.variantInfo) === variantKey
            ? { ...i, quantity: newQty }
            : i
        );
      } else {
        updated = [...prev, item];
      }
      void persistCart(updated, shopSlug);
      return updated;
    });
  }, [shopSlug, persistCart]);

  const updateQuantity = useCallback((productId: string, variantInfo: Record<string, string>, quantity: number) => {
    setItems(prev => {
      const variantKey = JSON.stringify(variantInfo);
      const updated = quantity <= 0
        ? prev.filter(i => !(i.productId === productId && JSON.stringify(i.variantInfo) === variantKey))
        : prev.map(i =>
            i.productId === productId && JSON.stringify(i.variantInfo) === variantKey
              ? { ...i, quantity }
              : i
          );
      void persistCart(updated, shopSlug);
      return updated;
    });
  }, [shopSlug, persistCart]);

  const removeItem = useCallback((productId: string, variantInfo: Record<string, string>) => {
    setItems(prev => {
      const variantKey = JSON.stringify(variantInfo);
      const updated = prev.filter(
        i => !(i.productId === productId && JSON.stringify(i.variantInfo) === variantKey)
      );
      void persistCart(updated, shopSlug);
      return updated;
    });
  }, [shopSlug, persistCart]);

  const clearCart = useCallback(() => {
    setItems([]);
    void persistCart([], shopSlug);
  }, [shopSlug, persistCart]);

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items]);

  return useMemo(() => ({
    items,
    totalItems,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    loadCart,
    shopSlug,
  }), [items, totalItems, subtotal, addItem, updateQuantity, removeItem, clearCart, loadCart, shopSlug]);
});
