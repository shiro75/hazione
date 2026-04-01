/**
 * @fileoverview Colored status badge for invoices, quotes, orders, etc.
 * Maps status codes to filled color badges (green=paid, red=late, orange=pending).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getStatusLabel } from '@/utils/format';

interface StatusBadgeProps {
  status: string;
}

export default React.memo(function StatusBadge({ status }: StatusBadgeProps) {
  const { colors } = useTheme();

  const getColors = () => {
    switch (status) {
      case 'paid':
      case 'validated':
      case 'active':
      case 'accepted':
        return { bg: '#059669', text: '#FFFFFF' };
      case 'sent':
      case 'trialing':
        return { bg: colors.primary, text: '#FFFFFF' };
      case 'draft':
        return { bg: colors.textTertiary, text: '#FFFFFF' };
      case 'late':
      case 'cancelled':
      case 'refused':
      case 'past_due':
        return { bg: '#DC2626', text: '#FFFFFF' };
      case 'expired':
        return { bg: '#D97706', text: '#FFFFFF' };
      case 'received':
      case 'to_pay':
        return { bg: '#D97706', text: '#FFFFFF' };
      case 'partial':
      case 'partially_paid':
        return { bg: '#2563EB', text: '#FFFFFF' };
      default:
        return { bg: '#D97706', text: '#FFFFFF' };
    }
  };

  const badgeColors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
      <Text style={[styles.text, { color: badgeColors.text }]}>
        {getStatusLabel(status)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
});
