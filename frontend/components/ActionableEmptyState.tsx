import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import {
  ShoppingCart, Wallet, Target, BarChart3, Clock,
  TrendingUp, Package, Users, FileText, PieChart,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

const ICON_MAP: Record<string, LucideIcon> = {
  cart: ShoppingCart,
  wallet: Wallet,
  target: Target,
  chart: BarChart3,
  clock: Clock,
  trending: TrendingUp,
  package: Package,
  users: Users,
  file: FileText,
  pie: PieChart,
};

interface ActionableEmptyStateProps {
  icon?: keyof typeof ICON_MAP;
  iconComponent?: LucideIcon;
  message: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export default React.memo(function ActionableEmptyState({
  icon = 'chart',
  iconComponent,
  message,
  ctaLabel,
  onCtaPress,
}: ActionableEmptyStateProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const IconComp = iconComponent ?? ICON_MAP[icon] ?? BarChart3;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}10` }]}>
        <IconComp size={22} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={onCtaPress}
          activeOpacity={0.7}
          testID="actionable-empty-cta"
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center' as const,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: SPACING.MD,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: SPACING.XS,
  },
  message: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    textAlign: 'center' as const,
    lineHeight: 19,
    maxWidth: 280,
  },
  ctaBtn: {
    paddingHorizontal: SPACING.XXXL,
    paddingVertical: SPACING.LG,
    borderRadius: RADIUS.MD,
    marginTop: SPACING.XS,
  },
  ctaText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});
