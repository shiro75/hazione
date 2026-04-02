/**
 * @fileoverview KPI card displaying a metric value with icon, trend badge,
 * and optional press handler. Used on dashboard and overview screens.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPercent } from '@/utils/format';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  accentColor?: string;
  onPress?: () => void;
}

export default React.memo(function KPICard({ title, value, change, icon, accentColor, onPress }: KPICardProps) {
  const { colors } = useTheme();
  const isPositive = (change ?? 0) >= 0;
  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper {...wrapperProps} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: accentColor ? `${accentColor}18` : colors.primaryLight }]}>
          {icon as React.ReactNode}
        </View>
        {change !== undefined && (
          <View style={[styles.badge, { backgroundColor: isPositive ? colors.successLight : colors.dangerLight }]}>
            {isPositive ? (
              <TrendingUp size={12} color={colors.success} />
            ) : (
              <TrendingDown size={12} color={colors.danger} />
            )}
            <Text style={[styles.badgeText, { color: isPositive ? colors.success : colors.danger }]}>
              {formatPercent(change)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
    </Wrapper>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
    flex: 0.1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  top: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 16,
    gap: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  value: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
});
