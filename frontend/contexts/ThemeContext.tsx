/**
 * @fileoverview Theme context for light/dark mode switching.
 * Persists theme preference in AsyncStorage. Exposes useTheme() hook
 * returning current colors palette, mode, and toggleTheme function.
 */

import React, { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { ThemeMode, ThemeColors } from '@/types';
import { lightTheme, darkTheme } from '@/constants/colors';

const THEME_KEY = '@gestion_theme';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light') {
        setMode(stored);
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors: ThemeColors = mode === 'light' ? lightTheme : darkTheme;

  return React.useMemo(() => ({ mode, colors, toggleTheme, isLoaded }), [mode, colors, toggleTheme, isLoaded]);
});
