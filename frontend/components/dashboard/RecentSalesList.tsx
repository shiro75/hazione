/**
 * components/dashboard/RecentSalesList.tsx
 *
 * Liste des dernières ventes regroupées par jour.
 * Chaque ligne est expandable pour afficher le détail des articles.
 * Supporte les ventes comptoir et les factures.
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, LayoutAnimation, StyleSheet,
} from 'react-native';
import { ChevronRight, CreditCard, Banknote, Smartphone, ArrowUpRight, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate } from '@/utils/format';
import { ClientAvatar } from './DashboardCards';
import ActionableEmptyState from '@/components/ActionableEmptyState';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';
import { useRouter } from 'expo-router';

// ─── Icônes de paiement ───────────────────────────────────────────────────────

const PAYMENT_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
  mobile_wave: Smartphone,
  mobile_om: Smartphone,
  mixed: CreditCard,
  transfer: ArrowUpRight,
  check: FileText,
  twint: Smartphone,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalTTC: number;
  variantId?: string;
}

interface RecentSale {
  id: string;
  date: string;
  client: string;
  amount: number;
  status: string;
  paymentMethod: string;
  items: SaleItem[];
  totalHT: number;
  totalTVA: number;
  clientId?: string;
  saleType: 'comptoir' | 'facture';
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
}

interface RecentSalesListProps {
  recentSales: RecentSale[];
  recentSalesMax: number;
  recentSalesTotalCA: number;
  currency: string;
  clients: Client[];
  now: Date;
  locale: string;
  getVariantLabel: (productId: string, variantId: string) => string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function RecentSalesList({
  recentSales,
  recentSalesMax,
  recentSalesTotalCA,
  currency,
  clients,
  now,
  locale,
  getVariantLabel,
}: RecentSalesListProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const toggleSaleExpand = useCallback((saleId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSaleId((prev) => (prev === saleId ? null : saleId));
  }, []);

  /** Regroupe les ventes par date (aujourd'hui, hier, ou date formatée) */
  const recentSalesGrouped = React.useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; sales: RecentSale[] }[] = [];
    const loc = locale === 'en' ? 'en-US' : 'fr-FR';

    for (const sale of recentSales) {
      const d = new Date(sale.date);
      const dateKey = d.toISOString().slice(0, 10);
      const isToday = dateKey === now.toISOString().slice(0, 10);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = dateKey === yesterday.toISOString().slice(0, 10);
      const dateLabel = isToday
        ? "Aujourd'hui"
        : isYesterday
        ? 'Hier'
        : d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'short' }).replace(/^\w/, (c) => c.toUpperCase());

      const existing = groups.find((g) => g.dateKey === dateKey);
      if (existing) existing.sales.push(sale);
      else groups.push({ dateKey, dateLabel, sales: [sale] });
    }
    return groups;
  }, [recentSales, now, locale]);

  if (recentSales.length === 0) {
    return (
      <ActionableEmptyState
        icon="cart"
        message="Enregistrez votre première vente pour voir l'historique ici"
        ctaLabel="Enregistrer une vente"
        onCtaPress={() => router.push('/ventes')}
      />
    );
  }

  return (
    <View style={listStyles.container}>
      {recentSalesGrouped.map((group, gIdx) => (
        <View key={group.dateKey}>
          {/* En-tête de groupe par date */}
          <View style={[listStyles.dayGroupHeader, gIdx > 0 && { marginTop: SPACING.XL }]}>
            <View style={[listStyles.dayGroupDot, { backgroundColor: colors.primary }]} />
            <Text style={[listStyles.dayGroupLabel, { color: colors.textSecondary }]}>{group.dateLabel}</Text>
            <View style={[listStyles.dayGroupLine, { backgroundColor: colors.borderLight }]} />
          </View>

          {group.sales.map((sale, idx) => {
            const progress = recentSalesMax > 0 ? sale.amount / recentSalesMax : 0;
            const PaymentIcon = PAYMENT_ICONS[sale.paymentMethod] || CreditCard;
            const isExpanded = expandedSaleId === sale.id;
            const clientData = sale.clientId ? clients.find((c) => c.id === sale.clientId) : null;
            const isUnpaid = sale.status === 'unpaid';
            const caPct = recentSalesTotalCA > 0 ? Math.round((sale.amount / recentSalesTotalCA) * 100) : 0;

            return (
              <View key={sale.id + idx}>
                {/* Ligne de vente principale */}
                <TouchableOpacity
                  onPress={() => toggleSaleExpand(sale.id)}
                  activeOpacity={0.7}
                  style={[
                    listStyles.saleRow,
                    !isExpanded && idx < group.sales.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  ]}
                >
                  {/* Barre de progression proportionnelle au montant */}
                  <View style={[listStyles.saleProgressStrip, { backgroundColor: colors.primary + '08' }]}>
                    <View style={[listStyles.saleProgressFill, { backgroundColor: colors.primary + '30', width: `${progress * 100}%` as `${number}%` }]} />
                  </View>

                  <View style={listStyles.saleRowContent}>
                    <View style={listStyles.saleRowLeft}>
                      <ClientAvatar name={sale.client} size={32} />
                      <View style={listStyles.saleInfo}>
                        <Text style={[listStyles.saleClient, { color: isUnpaid ? colors.danger : colors.text }]} numberOfLines={1}>
                          {sale.client}
                        </Text>
                        <View style={listStyles.saleMeta}>
                          <Text style={[listStyles.saleDate, { color: colors.textTertiary }]}>{formatDate(sale.date)}</Text>
                          {/* Badge type de vente */}
                          {sale.saleType === 'facture' ? (
                            <View style={[listStyles.saleTypeBadge, { backgroundColor: isUnpaid ? '#FEF2F2' : '#ECFDF5', borderColor: isUnpaid ? '#FECACA' : '#A7F3D0' }]}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: isUnpaid ? '#DC2626' : '#059669' }}>
                                {isUnpaid ? 'Facture' : 'Facture payée'}
                              </Text>
                            </View>
                          ) : (
                            <View style={[listStyles.saleTypeBadge, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#6B7280' }}>Comptoir</Text>
                            </View>
                          )}
                          <View style={[listStyles.paymentIconWrap, { backgroundColor: colors.primaryLight }]}>
                            <PaymentIcon size={11} color={colors.primary} />
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.SM }}>
                        <Text style={[listStyles.saleAmount, { color: colors.primary }]}>
                          {formatCurrency(sale.amount, currency)}
                        </Text>
                        <ChevronRight
                          size={14}
                          color={colors.textTertiary}
                          style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
                        />
                      </View>
                      {caPct > 0 && sale.status === 'paid' && (
                        <Text style={[listStyles.caPctText, { color: colors.textTertiary }]}>{caPct}% du CA</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Panneau de détail expandable */}
                {isExpanded && (
                  <View style={[listStyles.saleDetailPanel, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
                    {/* Infos client */}
                    {clientData && (
                      <View style={listStyles.saleDetailSection}>
                        <Text style={[listStyles.saleDetailLabel, { color: colors.textTertiary }]}>Client</Text>
                        <Text style={[listStyles.saleDetailValue, { color: colors.text }]}>
                          {clientData.companyName || `${clientData.firstName} ${clientData.lastName}`}
                        </Text>
                        {clientData.email && (
                          <Text style={[listStyles.saleDetailSub, { color: colors.textSecondary }]}>{clientData.email}</Text>
                        )}
                      </View>
                    )}

                    {/* Articles */}
                    <View style={listStyles.saleDetailSection}>
                      <Text style={[listStyles.saleDetailLabel, { color: colors.textTertiary }]}>Articles</Text>
                      {sale.items.map((item, i) => {
                        const variantLabel = item.variantId ? getVariantLabel(item.productId, item.variantId) : '';
                        return (
                          <View
                            key={item.id || i}
                            style={[listStyles.saleDetailItem, i < sale.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[listStyles.saleDetailItemName, { color: colors.text }]} numberOfLines={1}>
                                {item.productName}
                              </Text>
                              {variantLabel ? (
                                <View style={[listStyles.variantAttrChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
                                  <Text style={[listStyles.variantAttrText, { color: colors.primary }]} numberOfLines={1}>
                                    {variantLabel}
                                  </Text>
                                </View>
                              ) : null}
                              <Text style={[listStyles.saleDetailSub, { color: colors.textTertiary }]}>
                                {item.quantity} x {formatCurrency(item.unitPrice, currency)}
                              </Text>
                            </View>
                            <Text style={[listStyles.saleDetailItemTotal, { color: colors.text }]}>
                              {formatCurrency(item.totalTTC, currency)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Totaux */}
                    <View style={[listStyles.saleDetailTotals, { borderTopColor: colors.border }]}>
                      <View style={listStyles.saleDetailTotalRow}>
                        <Text style={[listStyles.saleDetailSub, { color: colors.textSecondary }]}>Total HT</Text>
                        <Text style={[listStyles.saleDetailSub, { color: colors.textSecondary }]}>{formatCurrency(sale.totalHT, currency)}</Text>
                      </View>
                      <View style={listStyles.saleDetailTotalRow}>
                        <Text style={[listStyles.saleDetailSub, { color: colors.textSecondary }]}>TVA</Text>
                        <Text style={[listStyles.saleDetailSub, { color: colors.textSecondary }]}>{formatCurrency(sale.totalTVA, currency)}</Text>
                      </View>
                      <View style={listStyles.saleDetailTotalRow}>
                        <Text style={[listStyles.saleDetailTotalLabel, { color: colors.text }]}>Total TTC</Text>
                        <Text style={[listStyles.saleDetailTotalValue, { color: isUnpaid ? colors.danger : colors.primary }]}>
                          {formatCurrency(sale.amount, currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {isExpanded && idx < group.sales.length - 1 && (
                  <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }} />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const listStyles = StyleSheet.create({
  container: { marginTop: SPACING.XS },

  dayGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, paddingVertical: SPACING.SM, paddingHorizontal: SPACING.XS },
  dayGroupDot: { width: 6, height: 6, borderRadius: 3 },
  dayGroupLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  dayGroupLine: { flex: 1, height: 1 },

  saleRow: { position: 'relative', overflow: 'hidden' },
  saleProgressStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: RADIUS.XS },
  saleProgressFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  saleRowContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.LG, paddingHorizontal: SPACING.XS },
  saleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.LG, flex: 1 },
  saleInfo: { flex: 1 },
  saleClient: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, marginTop: 2 },
  saleDate: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  saleAmount: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  saleTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  paymentIconWrap: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  caPctText: { fontSize: 9, fontWeight: '500' },

  saleDetailPanel: { marginHorizontal: SPACING.SM, marginBottom: SPACING.SM, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.XL, gap: SPACING.LG },
  saleDetailSection: { gap: SPACING.SM },
  saleDetailLabel: { fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, textTransform: 'uppercase', letterSpacing: 0.5 },
  saleDetailValue: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleDetailSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION },
  saleDetailItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.SM },
  saleDetailItemName: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  saleDetailItemTotal: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  saleDetailTotals: { borderTopWidth: 1, paddingTop: SPACING.LG, gap: SPACING.XS },
  saleDetailTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  saleDetailTotalLabel: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  saleDetailTotalValue: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },

  variantAttrChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start', marginTop: 3, marginBottom: 2 },
  variantAttrText: { fontSize: 10, fontWeight: '500' },
});