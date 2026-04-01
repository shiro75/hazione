/**
 * @fileoverview Full-screen error display with retry action.
 * Used when a critical data fetch or operation fails.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for ErrorScreen.
 * @property title - Error title
 * @property message - Detailed error description
 * @property onRetry - Retry callback; if provided, a retry button is shown
 */
interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Centered error state with icon, message, and optional retry button.
 *
 * @example
 * if (error) return <ErrorScreen message={error.message} onRetry={refetch} />;
 */
export default React.memo(function ErrorScreen({
  title = 'Une erreur est survenue',
  message = 'Impossible de charger les données. Veuillez réessayer.',
  onRetry,
}: ErrorScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
        <AlertTriangle size={32} color={colors.danger} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          activeOpacity={0.7}
        >
          <RefreshCw size={14} color="#FFF" />
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    padding: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    maxWidth: 320,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
