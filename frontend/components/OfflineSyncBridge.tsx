/**
 * @fileoverview Bridge component connecting the offline queue to the DataContext.
 * Registers sync and refresh callbacks so that pending offline sales are
 * automatically pushed to the server when connectivity is restored.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useData } from '@/contexts/DataContext';
import { useOffline } from '@/contexts/OfflineContext';
import type { Sale } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

export default function OfflineSyncBridge() {
  const { activeProducts, activeClients, createSale, company } = useData();
  const {
    updateProductsCache, updateClientsCache, updateCompanyCache,
    registerSyncCallback, registerRefreshCallback,
  } = useOffline();
  const queryClient = useQueryClient();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (activeProducts.length > 0) {
      void updateProductsCache(activeProducts);
    }
  }, [activeProducts, updateProductsCache]);

  useEffect(() => {
    if (activeClients.length > 0) {
      void updateClientsCache(activeClients);
    }
  }, [activeClients, updateClientsCache]);

  useEffect(() => {
    if (company && company.name) {
      void updateCompanyCache(company);
    }
  }, [company, updateCompanyCache]);

  const syncSale = useCallback(async (sale: Sale): Promise<boolean> => {
    try {
      const result = createSale(
        sale.items,
        sale.paymentMethod,
        sale.clientId,
        {
          mobilePhone: sale.mobilePhone,
          mobileRef: sale.mobileRef,
          mixedPayments: sale.mixedPayments,
        },
      );
      return result.success;
    } catch {
      return false;
    }
  }, [createSale]);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!hasRegistered.current) {
      registerSyncCallback(syncSale);
      registerRefreshCallback(handleRefresh);
      hasRegistered.current = true;
    }
  }, [syncSale, registerSyncCallback, registerRefreshCallback, handleRefresh]);

  return null;
}
