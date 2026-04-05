/**
 * components/dashboard/SimplifiedDashboard.tsx
 *
 * Vue simplifiée du tableau de bord pour les rôles avec accès restreint.
 * Affiche uniquement :
 *   - Bannière CA du jour
 *   - KPIs CA mensuel + nombre de ventes
 *   - Dernières ventes
 *
 * Pas de trésorerie, pas d'analyse, pas de données sensibles.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrencyInteger } from '@/utils/format';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';
import KPICard from '@/components/KPICard';
import { TrendingUp, ShoppingCart } from 'lucide-react-native';
import { TodayBanner } from './DashboardCards';
import RecentSalesList from './RecentSalesList';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimplifiedDashboardProps {
  todayRevenue: number;
  todaySalesCount: number;
  monthlyRevenue: number;
  revenueChange?: number;
  paidSalesCount: number;
  revenueSparkline: number[];
  salesSparkline: number[];
  recentSales: any[];
  recentSalesMax: number;
  recentSalesTotalCA: number;
  currency: string;
  clients: any[];
  now: Date;
  locale: string;
  getVariantLabel: (productId: string, variantId: string) => string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function SimplifiedDashboard({
  todayRevenue,
  todaySalesCount,
  monthlyRevenue,
  revenueChange,
  paidSalesCount,
  revenueSparkline,
  salesSparkline,
  recentSales,
  recentSalesMax,
  recentSalesTotalCA,
  currency,
  clients,
  now,
  locale,
  getVariantLabel,
}: SimplifiedDashboardProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <>
      {/* ══ Bannière CA du jour ══ */}
      <TodayBanner
        todayRevenue={todayRevenue}
        todaySalesCount={todaySalesCount}
        currency={currency}
        revenueLabel={t('dashboard.todayRevenue')}
        salesLabel={t('dashboard.salesCount', { count: todaySalesCount })}
      />

      {/* ══ KPIs CA mensuel + nombre de ventes ══ */}
      <View style={simplifiedStyles.kpiRow}>
        <KPICard
          title={t('dashboard.monthlyRevenue')}
          value={formatCurrencyInteger(monthlyRevenue, currency)}
          change={revenueChange !== undefined ? Math.round(revenueChange * 10) / 10 : undefined}
          icon={<TrendingUp size={16} color={colors.primary} />}
          sparklineData={revenueSparkline}
          sparklineColor={colors.primary}
        />
        <KPICard
          title={t('dashboard.salesNumber')}
          value={String(paidSalesCount)}
          icon={<ShoppingCart size={16} color="#7C3AED" />}
          accentColor="#7C3AED"
          sparklineData={salesSparkline}
          sparklineColor="#7C3AED"
        />
      </View>

      {/* ══ Dernières ventes ══ */}
      <View style={[simplifiedStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={simplifiedStyles.cardHeaderRow}>
          <Text style={[simplifiedStyles.cardTitle, { color: colors.text }]}>
            {t('dashboard.recentSales')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/ventes')} activeOpacity={0.7}>
            <Text style={[simplifiedStyles.viewAllLink, { color: colors.primary }]}>
              {t('dashboard.viewAll')} →
            </Text>
          </TouchableOpacity>
        </View>
        <RecentSalesList
          recentSales={recentSales}
          recentSalesMax={recentSalesMax}
          recentSalesTotalCA={recentSalesTotalCA}
          currency={currency}
          clients={clients}
          now={now}
          locale={locale}
          getVariantLabel={getVariantLabel}
        />
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const simplifiedStyles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    gap: SPACING.MD,
    flexWrap: 'wrap',
  },
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.XL,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.SIZE.BODY_LARGE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  viewAllLink: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});