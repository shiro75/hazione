/**
 * offlineService.ts
 * Local caching and offline queue management using AsyncStorage.
 * Caches products, clients, and company settings for offline access.
 * Queues sales made offline for later synchronization.
 *
 * Usage:
 *   import { cacheProducts, addPendingSale, checkConnectivity } from '@/services/offlineService';
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Product, Client, Sale, Company } from '@/types';

const KEYS = {
  PRODUCTS_CACHE: 'offline-products-cache',
  CLIENTS_CACHE: 'offline-clients-cache',
  COMPANY_CACHE: 'offline-company-cache',
  PENDING_SALES: 'offline-pending-sales',
  LAST_SYNC: 'offline-last-sync',
  SYNC_NOTIFICATIONS: 'offline-sync-notifications',
} as const;

export interface SyncNotification {
  id: string;
  message: string;
  type: 'success' | 'error';
  timestamp: string;
}

export async function cacheProducts(products: Product[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.PRODUCTS_CACHE, JSON.stringify(products));
  } catch {}
}

export async function getCachedProducts(): Promise<Product[]> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.PRODUCTS_CACHE);
    if (stored) return JSON.parse(stored) as Product[];
  } catch {}
  return [];
}

export async function cacheClients(clients: Client[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.CLIENTS_CACHE, JSON.stringify(clients));
  } catch {}
}

export async function getCachedClients(): Promise<Client[]> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.CLIENTS_CACHE);
    if (stored) return JSON.parse(stored) as Client[];
  } catch {}
  return [];
}

export async function addPendingSale(sale: Sale): Promise<void> {
  try {
    const existing = await getPendingSales();
    existing.push(sale);
    await AsyncStorage.setItem(KEYS.PENDING_SALES, JSON.stringify(existing));
  } catch {}
}

export async function getPendingSales(): Promise<Sale[]> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.PENDING_SALES);
    if (stored) return JSON.parse(stored) as Sale[];
  } catch {}
  return [];
}

export async function removePendingSale(saleId: string): Promise<void> {
  try {
    const existing = await getPendingSales();
    const filtered = existing.filter(s => s.id !== saleId);
    await AsyncStorage.setItem(KEYS.PENDING_SALES, JSON.stringify(filtered));
  } catch {}
}

export async function clearPendingSales(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.PENDING_SALES);
  } catch {}
}

export async function setLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch {}
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export async function cacheCompany(company: Company): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.COMPANY_CACHE, JSON.stringify(company));
  } catch {}
}

export async function getCachedCompany(): Promise<Company | null> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.COMPANY_CACHE);
    if (stored) return JSON.parse(stored) as Company;
  } catch {}
  return null;
}

export async function addSyncNotification(notification: SyncNotification): Promise<void> {
  try {
    const existing = await getSyncNotifications();
    existing.push(notification);
    const trimmed = existing.slice(-20);
    await AsyncStorage.setItem(KEYS.SYNC_NOTIFICATIONS, JSON.stringify(trimmed));
  } catch {}
}

export async function getSyncNotifications(): Promise<SyncNotification[]> {
  try {
    const stored = await AsyncStorage.getItem(KEYS.SYNC_NOTIFICATIONS);
    if (stored) return JSON.parse(stored) as SyncNotification[];
  } catch {}
  return [];
}

export async function clearSyncNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.SYNC_NOTIFICATIONS);
  } catch {}
}

/**
 * Checks network connectivity by pinging Google's generate_204 endpoint.
 * On web, uses navigator.onLine as a fast check.
 */
export async function checkConnectivity(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}
