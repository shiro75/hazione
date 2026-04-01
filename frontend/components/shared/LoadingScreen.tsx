/**
 * @fileoverview Full-screen loading indicator with optional message.
 * Used when data is being fetched or heavy operations are in progress.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for LoadingScreen.
 * @property message - Optional loading message
 * @property size - ActivityIndicator size
 */
interface LoadingScreenProps {
  message?: string;
  size?: 'small' | 'large';
}

/**
 * Centered loading spinner that fills its parent container.
 *
 * @example
 * if (isLoading) return <LoadingScreen message="Chargement des données..." />;
 */
export default React.memo(function LoadingScreen({
  message,
  size = 'large',
}: LoadingScreenProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size={size} color={colors.primary} />
      {message ? (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
    padding: 24,
  },
  message: {
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
});
