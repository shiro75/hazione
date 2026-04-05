import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, Package, User, TrendingDown, ShoppingCart, CheckCircle, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';
import { formatCurrencyInteger } from '@/utils/format';

interface InvoiceData {
  id: string;
  clientName: string;
  clientId: string;
  totalTTC: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

interface ProductData {
  id: string;
  name: string;
  stock?: number;
  lowStockThreshold?: number;
}

interface SaleData {
  id: string;
  clientId?: string;
  clientName?: string;
  createdAt: string;
  status: string;
}

interface TodoAction {
  id: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconColor: string;
  iconBg: string;
  text: string;
  route: string;
}

interface TodoTodayProps {
  invoices: InvoiceData[];
  lowStockProducts: ProductData[];
  sales: SaleData[];
  todaySalesCount: number;
  monthlyRevenue: number;
  explicitMonthlyGoal: number | null;
  coverageRatio: number;
  currency: string;
  now: Date;
}

export default function TodoToday({
  invoices,
  lowStockProducts,
  sales,
  todaySalesCount,
  monthlyRevenue,
  explicitMonthlyGoal,
  coverageRatio,
  currency,
  now,
}: TodoTodayProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const actions = useMemo(() => {
    const result: TodoAction[] = [];
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    const unpaidInvoices = invoices.filter(
      i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'
    );

    const urgentInvoices = unpaidInvoices.filter(inv => {
      const due = inv.dueDate.slice(0, 10);
      const dueDate = new Date(due);
      return due === todayStr || (dueDate < now && dueDate >= sevenDaysAgo);
    });

    if (urgentInvoices.length > 0) {
      const sorted = urgentInvoices.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
      const inv = sorted[0];
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
      );
      const remaining = inv.totalTTC - inv.paidAmount;
      const label = daysOverdue === 0
        ? `Relancer ${inv.clientName} · ${formatCurrencyInteger(remaining, currency)} dû aujourd'hui`
        : `Relancer ${inv.clientName} · ${formatCurrencyInteger(remaining, currency)} dus depuis ${daysOverdue}j`;
      result.push({
        id: 'invoice-' + inv.id,
        icon: Clock,
        iconColor: '#DC2626',
        iconBg: '#FEF2F2',
        text: label,
        route: '/ventes?tab=factures',
      });
    }

    if (result.length < 3 && lowStockProducts.length > 0) {
      const product = lowStockProducts[0];
      const stock = product.stock ?? 0;
      result.push({
        id: 'stock-' + product.id,
        icon: Package,
        iconColor: '#D97706',
        iconBg: '#FFF7ED',
        text: `Réapprovisionner ${product.name} · ${stock} unité${stock > 1 ? 's' : ''} restante${stock > 1 ? 's' : ''}`,
        route: '/stock?tab=inventaire',
      });
    }

    if (result.length < 3) {
      const fortyFiveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 45).toISOString();
      const unpaidClientIds = new Set(
        unpaidInvoices.map(i => i.clientId)
      );

      const paidSales = sales.filter(s => s.status === 'paid');
      const clientLastPurchase = new Map<string, string>();
      for (const s of paidSales) {
        const cid = s.clientId || s.clientName || '';
        if (!cid) continue;
        const existing = clientLastPurchase.get(cid);
        if (!existing || s.createdAt > existing) {
          clientLastPurchase.set(cid, s.createdAt);
        }
      }

      for (const [clientId, lastDate] of clientLastPurchase) {
        if (result.length >= 3) break;
        if (!unpaidClientIds.has(clientId)) continue;
        if (lastDate >= fortyFiveDaysAgo) continue;

        const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);
        const inv = unpaidInvoices.find(i => i.clientId === clientId);
        const clientName = inv?.clientName || 'Client';
        result.push({
          id: 'client-' + clientId,
          icon: User,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          text: `Contacter ${clientName} · dernière commande il y a ${daysSince}j`,
          route: '/clients',
        });
      }
    }

    if (result.length < 3 && todaySalesCount === 0 && now.getHours() >= 12) {
      result.push({
        id: 'no-sales-today',
        icon: ShoppingCart,
        iconColor: '#7C3AED',
        iconBg: '#F5F3FF',
        text: 'Enregistrez vos ventes du matin',
        route: '/ventes',
      });
    }

    if (result.length < 3 && explicitMonthlyGoal && explicitMonthlyGoal > 0) {
      const daysElapsed = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projected = daysElapsed > 0 ? (monthlyRevenue / daysElapsed) * daysInMonth : 0;
      if (projected < explicitMonthlyGoal * 0.8) {
        const missing = Math.round(explicitMonthlyGoal - monthlyRevenue);
        if (missing > 0) {
          result.push({
            id: 'boost-sales',
            icon: TrendingDown,
            iconColor: '#F59E0B',
            iconBg: '#FFFBEB',
            text: `Boostez vos ventes : il manque ${formatCurrencyInteger(missing, currency)} pour atteindre votre objectif`,
            route: '/ventes',
          });
        }
      }
    }

    if (result.length < 3 && coverageRatio < 0.3) {
      const ratioStr = coverageRatio.toFixed(2);
      result.push({
        id: 'reduce-expenses',
        icon: TrendingDown,
        iconColor: '#DC2626',
        iconBg: '#FEF2F2',
        text: `Réduisez vos dépenses · ratio couverture critique (${ratioStr}×)`,
        route: '/cashflow',
      });
    }

    return result.slice(0, 3);
  }, [invoices, lowStockProducts, sales, todaySalesCount, monthlyRevenue, explicitMonthlyGoal, coverageRatio, currency, now]);

  const isEmpty = actions.length === 0;

  return (
    <View style={[s.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} testID="todo-today">
      <View style={s.headerRow}>
        <Text style={[s.title, { color: colors.text }]}>À faire aujourd'hui</Text>
        {!isEmpty && (
          <View style={[s.countBadge, { backgroundColor: '#F59E0B' + '20' }]}>
            <Text style={[s.countText, { color: '#D97706' }]}>{actions.length}</Text>
          </View>
        )}
      </View>

      {isEmpty ? (
        <View style={s.emptyRow}>
          <View style={[s.emptyIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <CheckCircle size={18} color="#059669" />
          </View>
          <Text style={[s.emptyText, { color: '#059669' }]}>
            Tout est en ordre pour aujourd'hui.
          </Text>
        </View>
      ) : (
        <View style={s.actionsList}>
          {actions.map((action, idx) => {
            const IconComp = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                style={[
                  s.actionRow,
                  { borderColor: colors.borderLight },
                  idx < actions.length - 1 && s.actionRowBorder,
                ]}
                onPress={() => router.push(action.route as never)}
                activeOpacity={0.65}
                testID={`todo-action-${idx}`}
              >
                <View style={[s.actionIconWrap, { backgroundColor: action.iconBg }]}>
                  <IconComp size={15} color={action.iconColor} />
                </View>
                <Text style={[s.actionText, { color: colors.text }]} numberOfLines={2}>
                  {action.text}
                </Text>
                <View style={[s.actionBtn, { backgroundColor: colors.primary + '12' }]}>
                  <Text style={[s.actionBtnText, { color: colors.primary }]}>Agir</Text>
                  <ChevronRight size={12} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING.XXXL,
    ...SHADOWS.SM,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: SPACING.XL,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.BODY_LARGE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  countBadge: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.ROUND,
  },
  countText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  emptyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
    paddingVertical: SPACING.LG,
  },
  emptyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  actionsList: {
    gap: 0,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
    paddingVertical: SPACING.XL,
  },
  actionRowBorder: {
    borderBottomWidth: 1,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.MD,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionText: {
    flex: 1,
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.MD,
  },
  actionBtnText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});
