import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import fr from '@/i18n/fr';
import en from '@/i18n/en';
import km from '@/i18n/km';

export type AppLocale = 'fr' | 'en' | 'km';

const LOCALE_KEY = '@gestio_locale';

const translations: Record<AppLocale, Record<string, string>> = { fr, en, km };

function getDeviceLocale(): AppLocale {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const lang = navigator.language?.slice(0, 2);
      if (lang === 'en') return 'en';
      if (lang === 'km') return 'km';
      return 'fr';
    }
    const locale =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
      NativeModules.I18nManager?.localeIdentifier ||
      'fr';
    if (typeof locale === 'string' && locale.startsWith('en')) return 'en';
    if (typeof locale === 'string' && locale.startsWith('km')) return 'km';
    return 'fr';
  } catch {
    return 'fr';
  }
}

export const [I18nProvider, useI18n] = createContextHook(() => {
  const [locale, setLocaleState] = useState<AppLocale>('fr');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY)
      .then((stored) => {
        if (stored === 'fr' || stored === 'en' || stored === 'km') {
          setLocaleState(stored);
        } else {
          const detected = getDeviceLocale();
          setLocaleState(detected);
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  const setLocale = useCallback((newLocale: AppLocale) => {
    setLocaleState(newLocale);
    void AsyncStorage.setItem(LOCALE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = translations[locale]?.[key] ?? translations.fr[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          const strVal = String(v);
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), strVal);
          const pluralMatch = text.match(/^(.+)\|(.+)$/);
          if (pluralMatch && k === 'count') {
            const num = typeof v === 'number' ? v : parseInt(strVal, 10);
            text = num <= 1 ? pluralMatch[1] : pluralMatch[2];
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), strVal);
          }
        });
        const pluralMatch = text.match(/^(.+)\|(.+)$/);
        if (pluralMatch && params.count !== undefined) {
          const num = typeof params.count === 'number' ? params.count : parseInt(String(params.count), 10);
          text = num <= 1 ? pluralMatch[1] : pluralMatch[2];
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }
      }
      return text;
    },
    [locale],
  );

  return useMemo(() => ({ locale, setLocale, t, isLoaded }), [locale, setLocale, t, isLoaded]);
});