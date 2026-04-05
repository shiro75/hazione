import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, TrendingDown, Package, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface SmartAlert {
  id: string;
  title: string;
  description: string;
  impact: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'cashflow' | 'unpaid' | 'stock';
  onPress?: () => void;
  actionLabel?: string;
}

interface SmartAlertsProps {
  unpaidInvoices: Array<{
    clientId: string;
    clientName: string;
    totalTTC: number;
    paidAmount: number;
    dueDate: string;
  }>;
  lowStockProducts: Array<{
    name: string;
    stockQuantity: number;
  }>;

  totalEncaissements: number;
  totalDecaissements: number;
  expenseBreakdownSegments: Array<{ label: string; value: number }>;
  currency: string;
  formatCurrency: (amount: number, currency: string) => string;
  now: Date;
  onNavigateInvoices: () => void;
  onNavigateStock: () => void;
  onNavigateExpenses: () => void;
}

export default function SmartAlerts({
  unpaidInvoices,
  lowStockProducts,

  totalEncaissements,
  totalDecaissements,
  expenseBreakdownSegments,
  currency,
  formatCurrency,
  now,
  onNavigateInvoices,
  onNavigateStock,
  onNavigateExpenses,
}: SmartAlertsProps) {
  const { colors } = useTheme();

  const alerts = useMemo(() => {
    const result: SmartAlert[] = [];

    const netDiff = totalDecaissements - totalEncaissements;
    if (netDiff > 0) {
      const topExpense = expenseBreakdownSegments.length > 0
        ? expenseBreakdownSegments.sort((a, b) => b.value - a.value)[0]
        : null;
      const totalExp = expenseBreakdownSegments.reduce((s, e) => s + e.value, 0);
      const topPct = topExpense && totalExp > 0 ? Math.round((topExpense.value / totalExp) * 100) : 0;
      let desc = `Vos décaissements dépassent vos encaissements de ${formatCurrency(Math.round(netDiff), currency)} ce mois`;
      if (topExpense && topPct > 30) {
        desc += ` — vérifiez vos dépenses en ${topExpense.label.toLowerCase()} qui représentent ${topPct}% de vos sorties.`;
      } else {
        desc += '.';
      }
      result.push({
        id: 'cashflow-negative',
        title: 'Trésorerie déficitaire',
        description: desc,
        impact: netDiff,
        color: '#DC2626',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
        icon: 'cashflow',
        onPress: onNavigateExpenses,
        actionLabel: 'Voir dépenses',
      });
    }

    if (unpaidInvoices.length > 0) {
      const clientUnpaidMap = new Map<string, { name: string; amount: number }>();
      for (const inv of unpaidInvoices) {
        const existing = clientUnpaidMap.get(inv.clientId) || { name: inv.clientName || 'Client', amount: 0 };
        existing.amount += inv.totalTTC - inv.paidAmount;
        clientUnpaidMap.set(inv.clientId, existing);
      }
      const totalUnpaid = unpaidInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
      const topClient = Array.from(clientUnpaidMap.values()).sort((a, b) => b.amount - a.amount)[0];
      const topClientPct = totalUnpaid > 0 ? Math.round((topClient.amount / totalUnpaid) * 100) : 0;

      let desc = '';
      if (topClient && topClientPct >= 20) {
        desc = `${topClient.name} représente ${topClientPct}% de vos impayés (${formatCurrency(Math.round(topClient.amount), currency)}) — c'est le client à relancer en priorité.`;
      } else {
        desc = `${unpaidInvoices.length} facture${unpaidInvoices.length > 1 ? 's' : ''} impayée${unpaidInvoices.length > 1 ? 's' : ''} pour un total de ${formatCurrency(Math.round(totalUnpaid), currency)}.`;
      }

      const overdueCount = unpaidInvoices.filter(i => new Date(i.dueDate) < now).length;
      if (overdueCount > 0) {
        desc += ` ${overdueCount} en retard de paiement.`;
      }

      result.push({
        id: 'unpaid-invoices',
        title: `${unpaidInvoices.length} facture${unpaidInvoices.length > 1 ? 's' : ''} impayée${unpaidInvoices.length > 1 ? 's' : ''}`,
        description: desc,
        impact: totalUnpaid,
        color: '#D97706',
        bgColor: '#FFFBEB',
        borderColor: '#FDE68A',
        icon: 'unpaid',
        onPress: onNavigateInvoices,
        actionLabel: 'Voir factures',
      });
    }

    if (lowStockProducts.length > 0) {
      const outOfStock = lowStockProducts.filter(p => p.stockQuantity <= 0);
      const criticalNames = lowStockProducts.slice(0, 2).map(p => p.name);
      let desc = '';
      if (outOfStock.length > 0) {
        desc = `${outOfStock[0].name} est en rupture de stock.`;
        if (outOfStock.length > 1) {
          desc = `${outOfStock.length} produits en rupture de stock dont ${outOfStock[0].name}.`;
        }
      } else {
        desc = `${criticalNames.join(' et ')} ${criticalNames.length > 1 ? 'sont' : 'est'} en stock critique.`;
      }
      desc += ` ${lowStockProducts.length} produit${lowStockProducts.length > 1 ? 's' : ''} à réapprovisionner.`;

      result.push({
        id: 'low-stock',
        title: `${lowStockProducts.length} produit${lowStockProducts.length > 1 ? 's' : ''} en stock critique`,
        description: desc,
        impact: lowStockProducts.length * 100,
        color: '#EA580C',
        bgColor: '#FFF7ED',
        borderColor: '#FED7AA',
        icon: 'stock',
        onPress: onNavigateStock,
        actionLabel: 'Voir stock',
      });
    }

    return result.sort((a, b) => b.impact - a.impact).slice(0, 3);
  }, [unpaidInvoices, lowStockProducts, totalEncaissements, totalDecaissements, expenseBreakdownSegments, currency, formatCurrency, now, onNavigateInvoices, onNavigateStock, onNavigateExpenses]);

  if (alerts.length === 0) return null;

  const IconMap = {
    cashflow: TrendingDown,
    unpaid: AlertTriangle,
    stock: Package,
  };

  return (
    <View style={styles.container}>
      {alerts.map((alert) => {
        const IconComp = IconMap[alert.icon];
        return (
          <TouchableOpacity
            key={alert.id}
            style={[styles.alertCard, { backgroundColor: alert.bgColor, borderColor: alert.borderColor }]}
            onPress={alert.onPress}
            activeOpacity={0.7}
            testID={`smart-alert-${alert.id}`}
          >
            <View style={styles.alertHeader}>
              <View style={[styles.alertIconWrap, { backgroundColor: alert.color + '15' }]}>
                <IconComp size={15} color={alert.color} />
              </View>
              <Text style={[styles.alertTitle, { color: alert.color }]} numberOfLines={1}>
                {alert.title}
              </Text>
              {alert.onPress && <ChevronRight size={16} color={alert.color} />}
            </View>
            <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
              {alert.description}
            </Text>
            {alert.actionLabel && alert.onPress && (
              <Text style={[styles.alertAction, { color: alert.color }]}>
                {alert.actionLabel} →
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.MD,
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
    gap: SPACING.MD,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  alertIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    flex: 1,
  },
  alertDesc: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    lineHeight: 18,
  },
  alertAction: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    alignSelf: 'flex-start',
  },
});
