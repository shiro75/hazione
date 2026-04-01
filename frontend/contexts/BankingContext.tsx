import React, { useState, useCallback, useEffect, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentProviderType = 'stripe' | 'cinetpay' | null;

export interface BankingConfig {
  isConnected: boolean;
  provider: PaymentProviderType;
  connectedAccountId: string;
  connectedAt: string | null;
}

const STORAGE_KEY = '@banking_config';

const DEFAULT_CONFIG: BankingConfig = {
  isConnected: false,
  provider: null,
  connectedAccountId: '',
  connectedAt: null,
};

export const [BankingProvider, useBanking] = createContextHook(() => {
  const [config, setConfig] = useState<BankingConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as BankingConfig;
            setConfig(parsed);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (newConfig: BankingConfig) => {
    setConfig(newConfig);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch {}
  }, []);

  const connectAccount = useCallback(async (provider: PaymentProviderType, accountId: string) => {
    const newConfig: BankingConfig = {
      isConnected: true,
      provider,
      connectedAccountId: accountId,
      connectedAt: new Date().toISOString(),
    };
    await persist(newConfig);
  }, [persist]);

  const disconnectAccount = useCallback(async () => {
    await persist(DEFAULT_CONFIG);
  }, [persist]);

  const isCardPaymentAvailable = config.isConnected && config.provider === 'stripe';
  const isMobilePaymentAvailable = config.isConnected && config.provider === 'cinetpay';
  const isDigitalPaymentAvailable = config.isConnected;

  return useMemo(() => ({
    config,
    loading,
    connectAccount,
    disconnectAccount,
    isCardPaymentAvailable,
    isMobilePaymentAvailable,
    isDigitalPaymentAvailable,
  }), [config, loading, connectAccount, disconnectAccount, isCardPaymentAvailable, isMobilePaymentAvailable, isDigitalPaymentAvailable]);
});
