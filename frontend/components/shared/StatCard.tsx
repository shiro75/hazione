/**
 * @fileoverview StatCard displays a KPI metric with icon, value, label,
 * and optional trend indicator. Used in dashboard and trésorerie.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPercent } from '@/utils/format';

/**
 * Props for StatCard.
 * @property title - Metric label
 * @property value - Formatted metric value string
 * @property change - Optional percentage change for trend badge
 * @property icon - Icon element rendered in a colored background
 * @property accentColor - Override the icon background tint
 * @property onPress - Optional press handler
 * @property subtitle - Optional subtitle below the value
 */
interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  accentColor?: string;
  onPress?: () => void;
  subtitle?: string;
}

/**
 * A card displaying a key metric with icon, trend, and label.
 * Wraps in a TouchableOpacity if onPress is provided.
 *
 * @example
 * <StatCard
 *   title="CA du mois"
 *   value="12 500 €"
 *   change={15.4}
 *   icon={<Euro size={20} color={colors.primary} />}
 *   onPress={() => router.push('/ventes')}
 * />
 */
export default React.memo(function StatCard({
  title,
  value,
  change,
  icon,
  accentColor,
  onPress,
  subtitle,
}: StatCardProps) {
  const { colors } = useTheme();
  const isPositive = (change ?? 0) >= 0;
  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: accentColor ? `${accentColor}18` : colors.primaryLight },
          ]}
        >
          {icon as React.ReactNode}
        </View>
        {change !== undefined && (
          <View
            style={[
              styles.badge,
              { backgroundColor: isPositive ? colors.successLight : colors.dangerLight },
            ]}
          >
            {isPositive ? (
              <TrendingUp size={12} color={colors.success} />
            ) : (
              <TrendingDown size={12} color={colors.danger} />
            )}
            <Text
              style={[
                styles.badgeText,
                { color: isPositive ? colors.success : colors.danger },
              ]}
            >
              {formatPercent(change)}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
      ) : null}
    </Wrapper>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    minWidth: 200,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  top: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  value: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
