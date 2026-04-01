import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Platform, AppState } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import type { Sale, Product, Client, Company } from '@/types';
import {
  checkConnectivity,
  cacheProducts,
  cacheClients,
  cacheCompany,
  getCachedProducts,
  getCachedClients,
  getCachedCompany,
  addPendingSale,
  getPendingSales,
  removePendingSale,
  setLastSyncTime,
  addSyncNotification,
  type SyncNotification,
} from '@/services/offlineService';

export const [OfflineProvider, useOffline] = createContextHook(() => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSalesCount, setPendingSalesCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncNotification | null>(null);
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedClients, setCachedClients] = useState<Client[]>([]);
  const [cachedCompany, setCachedCompanyState] = useState<Company | null>(null);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncCallbackRef = useRef<((sale: Sale) => Promise<boolean>) | null>(null);
  const refreshCallbackRef = useRef<(() => void) | null>(null);
  const prevOnlineRef = useRef<boolean>(true);

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingSales();
    setPendingSalesCount(pending.length);
  }, []);

  const checkNetwork = useCallback(async () => {
    const online = await checkConnectivity();
    setIsOnline(online);
    return online;
  }, []);

  useEffect(() => {
    void checkNetwork();
    void refreshPendingCount();

    void (async () => {
      const [products, clients, company] = await Promise.all([
        getCachedProducts(),
        getCachedClients(),
        getCachedCompany(),
      ]);
      setCachedProducts(products);
      setCachedClients(clients);
      if (company) setCachedCompanyState(company);
    })();

    checkIntervalRef.current = setInterval(() => {
      void checkNetwork();
    }, 15000);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkNetwork();
      }
    });

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      subscription.remove();
    };
  }, [checkNetwork, refreshPendingCount]);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      prevOnlineRef.current = false;
    }
    if (isOnline && !prevOnlineRef.current) {
      prevOnlineRef.current = true;
      if (refreshCallbackRef.current) {
        refreshCallbackRef.current();
      }
    }
  }, [isOnline]);

  const updateProductsCache = useCallback(async (products: Product[]) => {
    await cacheProducts(products);
    setCachedProducts(products);
  }, []);

  const updateClientsCache = useCallback(async (clients: Client[]) => {
    await cacheClients(clients);
    setCachedClients(clients);
  }, []);

  const updateCompanyCache = useCallback(async (company: Company) => {
    await cacheCompany(company);
    setCachedCompanyState(company);
  }, []);

  const queueOfflineSale = useCallback(async (sale: Sale) => {
    await addPendingSale({ ...sale, _offline: true });
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const registerSyncCallback = useCallback((cb: (sale: Sale) => Promise<boolean>) => {
    syncCallbackRef.current = cb;
  }, []);

  const registerRefreshCallback = useCallback((cb: () => void) => {
    refreshCallbackRef.current = cb;
  }, []);

  const syncPendingSales = useCallback(async (): Promise<number> => {
    if (!syncCallbackRef.current) {
      return 0;
    }
    const online = await checkNetwork();
    if (!online) {
      return 0;
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;
    try {
      const pending = await getPendingSales();
      const total = pending.length;
      setSyncProgress({ current: 0, total });

      for (let i = 0; i < pending.length; i++) {
        const sale = pending[i];
        setSyncProgress({ current: i + 1, total });
        try {
          const success = await syncCallbackRef.current(sale);
          if (success) {
            await removePendingSale(sale.id);
            synced++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
      }

      if (synced > 0) {
        await setLastSyncTime();
        const notification: SyncNotification = {
          id: `sync_${Date.now()}`,
          message: `${synced} vente${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''} avec succès`,
          type: 'success',
          timestamp: new Date().toISOString(),
        };
        await addSyncNotification(notification);
        setLastSyncResult(notification);
      }
      if (failed > 0) {
        const notification: SyncNotification = {
          id: `sync_err_${Date.now()}`,
          message: `${failed} vente${failed > 1 ? 's' : ''} n'ont pas pu être synchronisée${failed > 1 ? 's' : ''}`,
          type: 'error',
          timestamp: new Date().toISOString(),
        };
        await addSyncNotification(notification);
        if (synced === 0) setLastSyncResult(notification);
      }
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
    return synced;
  }, [checkNetwork, refreshPendingCount]);

  useEffect(() => {
    if (isOnline && pendingSalesCount > 0 && !isSyncing) {
      void syncPendingSales();
    }
  }, [isOnline, pendingSalesCount, isSyncing, syncPendingSales]);

  const dismissSyncResult = useCallback(() => {
    setLastSyncResult(null);
  }, []);

  return useMemo(() => ({
    isOnline,
    pendingSalesCount,
    isSyncing,
    syncProgress,
    lastSyncResult,
    cachedProducts,
    cachedClients,
    cachedCompany,
    wasOffline,
    updateProductsCache,
    updateClientsCache,
    updateCompanyCache,
    queueOfflineSale,
    syncPendingSales,
    registerSyncCallback,
    registerRefreshCallback,
    checkNetwork,
    dismissSyncResult,
  }), [
    isOnline, pendingSalesCount, isSyncing, syncProgress, lastSyncResult,
    cachedProducts, cachedClients, cachedCompany, wasOffline,
    updateProductsCache, updateClientsCache, updateCompanyCache,
    queueOfflineSale, syncPendingSales, registerSyncCallback,
    registerRefreshCallback, checkNetwork, dismissSyncResult,
  ]);
});
