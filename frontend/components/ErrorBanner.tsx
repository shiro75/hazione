/**
 * @fileoverview Inline error banner for displaying form/operation errors.
 * Shows a red-tinted banner with error message text.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ErrorBannerProps {
  message: string;
}

export default React.memo(function ErrorBanner({ message }: ErrorBannerProps) {
  const { colors } = useTheme();

  if (!message) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.dangerLight }]}>
      <Text style={[styles.text, { color: colors.danger }]}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
