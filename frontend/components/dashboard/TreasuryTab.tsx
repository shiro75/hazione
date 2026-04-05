/**
 * components/dashboard/TreasuryTab.tsx
 *
 * Onglet "Trésorerie" du tableau de bord.
 * Sections :
 *   1. Runway (mois de survie)
 *   2. KPIs : solde, encaissements, décaissements
 *   3. Ratio de couverture (CashflowRatio)
 *   4. Encaissements attendus (factures impayées)
 *   5. Flux de trésorerie net + sparkline
 *   6. Projection de trésorerie (factures en attente)
 *   7. Évolution du solde + Répartition dépenses
 *   8. Délai moyen de paiement
 *   9. Factures en retard + fournisseurs à payer
 *   10. Liste des mouvements avec filtre + export FEC
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import {
  ArrowUpRight, ArrowDownRight, AlertTriangle, Clock, Truck, Download,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrency, formatCurrencyInteger, formatDate } from '@/utils/format';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SEMANTIC_COLORS } from '@/constants/theme';
import SparklineChart from '@/components/dashboard/charts/SparklineChart';
import KPICard from '@/components/KPICard';
import RunwayCard from '@/components/dashboard/charts/RunwayCard';
import CashflowRatio from '@/components/dashboard/charts/CashflowRatio';
import FinancialHealthScore from '@/components/dashboard/charts/FinancialHealthScore';
import SmartDonut from '@/components/dashboard/charts/SmartDonut';
import {
  TreasuryLineChart, ProjectionBars, LegendRow, HorizontalRefBarChart,
} from '@/components/dashboard/charts/DashboardCharts';
import ActionableEmptyState from '@/components/ActionableEmptyState';
import CompactSummaryCard from '@/components/CompactSummaryCard';
import useChartState from '@/hooks/useChartState';
import type { useDashboardData } from '@/hooks/useDashboardData';
import type { MovementFilter } from '@/types/dashboard.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = ReturnType<typeof useDashboardData>;

interface TreasuryTabProps {
  data: DashboardData;
  currency: string;
  isMobile: boolean;
  width: number;
  allMovements: any[];
  lateClientInvoices: { id: string; client: string; amount: number; daysLate: number }[];
  suppliersDue: { id: string; supplier: string; amount: number; dueDate: string }[];
  projectionData: { label: string; actual?: number; projected?: number }[];
  expenseBreakdownSegments: { label: string; value: number; color: string }[];
  onExportFEC: () => void;
  now: Date;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function TreasuryTab({
  data, currency, isMobile, width,
  allMovements, lateClientInvoices, suppliersDue, projectionData,
  expenseBreakdownSegments, onExportFEC, now,
}: TreasuryTabProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [showMovements, setShowMovements] = useState(false);

  const {
    cashBalance, monthlyExpensesAvg, totalEncaissements, totalDecaissements,
    totalDecaissementsWithPlanned, netCashflow, netCashflowSparkline,
    treasurySparkline, treasuryMonthlyData, sixMonthsData,
    paymentDelayData, avgPaymentDelay, expectedCollections,
  } = data;

  const projectionChartState = useChartState(projectionData.map((d) => ({ value: (d.actual || 0) + (d.projected || 0) })));
  const paymentDelayChartState = useChartState(paymentDelayData);

  const filteredMovements = movementFilter === 'all'
    ? allMovements
    : allMovements.filter((m) => m.type === movementFilter);

  return (
    <>
      {/* ══ 1. Runway ══ */}
      <RunwayCard
        solde={cashBalance}
        monthlyExpenses={monthlyExpensesAvg}
        formatCurrency={(v) => formatCurrencyInteger(v, currency)}
      />

      {/* ══ 2. KPIs 3 colonnes ══ */}
      <View style={[treasuryStyles.kpiRow, isMobile && { flexWrap: 'wrap' }]}>
        <KPICard
          title={t('dashboard.balance')}
          value={formatCurrencyInteger(cashBalance, currency)}
          icon={<ArrowUpRight size={16} color={cashBalance >= 0 ? colors.success : colors.danger} />}
          accentColor={cashBalance >= 0 ? '#059669' : '#DC2626'}
        />
        <KPICard
          title={t('dashboard.collections')}
          value={formatCurrencyInteger(totalEncaissements, currency)}
          icon={<ArrowUpRight size={16} color="#059669" />}
          accentColor="#059669"
        />
        <KPICard
          title={t('dashboard.disbursements')}
          value={formatCurrencyInteger(totalDecaissementsWithPlanned, currency)}
          icon={<ArrowDownRight size={16} color="#F59E0B" />}
          accentColor="#F59E0B"
        />
      </View>

      {/* ══ 3. Ratio de couverture ══ */}
      <CashflowRatio
        encaissements={totalEncaissements}
        decaissements={totalDecaissements}
        formatCurrency={(v) => formatCurrencyInteger(v, currency)}
      />

      {/* ══ 4. Encaissements attendus ══ */}
      <View style={[treasuryStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={treasuryStyles.cardHeaderRow}>
          <View>
            <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>Encaissements attendus</Text>
            <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Suivi des factures en attente de paiement</Text>
          </View>
          {expectedCollections.overdueAmount > 0 && (
            <View style={[treasuryStyles.badge, { backgroundColor: '#FEF2F2' }]}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>Retard</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 28, fontWeight: '800', color: expectedCollections.thisWeekAmount > 0 ? colors.text : colors.textTertiary, letterSpacing: -1, marginBottom: SPACING.MD }}>
          {expectedCollections.thisWeekAmount > 0
            ? formatCurrencyInteger(expectedCollections.thisWeekAmount, currency)
            : 'Aucun encaissement prévu cette semaine'}
        </Text>

        {/* Barre de progression recouvrement */}
        {expectedCollections.totalUnpaid > 0 && (
          <View style={{ marginBottom: SPACING.LG }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.SM }}>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '500' }}>Encaissé ce mois</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
                {Math.min(Math.round((expectedCollections.collectedThisMonth / (expectedCollections.collectedThisMonth + expectedCollections.totalUnpaid)) * 100), 100)}%
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
              <View style={[treasuryStyles.progressFill, {
                width: `${Math.min(Math.round((expectedCollections.collectedThisMonth / (expectedCollections.collectedThisMonth + expectedCollections.totalUnpaid)) * 100), 100)}%` as `${number}%`,
              }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.SM }}>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{formatCurrencyInteger(expectedCollections.collectedThisMonth, currency)} encaissé</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary }}>{formatCurrencyInteger(expectedCollections.totalUnpaid, currency)} restant</Text>
            </View>
          </View>
        )}

        {/* Métriques en 3 colonnes */}
        <View style={{ flexDirection: 'row', gap: SPACING.MD, marginBottom: SPACING.LG }}>
          <View style={[treasuryStyles.expectedMetric, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={{ fontSize: 10, color: '#1E40AF', fontWeight: '600' }}>Cette semaine</Text>
            <Text style={{ fontSize: 14, color: '#1E40AF', fontWeight: '800' }}>
              {formatCurrencyInteger(expectedCollections.thisWeekAmount, currency)}
            </Text>
          </View>
          <View style={[treasuryStyles.expectedMetric, {
            backgroundColor: expectedCollections.overdueAmount > 0 ? '#FEF2F2' : '#F9FAFB',
            borderColor: expectedCollections.overdueAmount > 0 ? '#FECACA' : '#E5E7EB',
          }]}>
            <Text style={{ fontSize: 10, color: expectedCollections.overdueAmount > 0 ? '#991B1B' : colors.textTertiary, fontWeight: '600' }}>En retard</Text>
            <Text style={{ fontSize: 14, color: expectedCollections.overdueAmount > 0 ? '#DC2626' : colors.textTertiary, fontWeight: '800' }}>
              {formatCurrencyInteger(expectedCollections.overdueAmount, currency)}
            </Text>
          </View>
          <View style={[treasuryStyles.expectedMetric, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}>
            <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '600' }}>Total</Text>
            <Text style={{ fontSize: 14, color: colors.text, fontWeight: '800' }}>
              {formatCurrencyInteger(expectedCollections.totalUnpaid, currency)}
            </Text>
          </View>
        </View>

        {/* Alerte plus gros impayé */}
        {expectedCollections.topClient && (
          <View style={[treasuryStyles.topClientAlert]}>
            <AlertTriangle size={13} color="#D97706" />
            <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '500', flex: 1 }} numberOfLines={1}>
              Plus gros impayé : {expectedCollections.topClient.name} · {formatCurrencyInteger(expectedCollections.topClient.amount, currency)}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/ventes?tab=factures' as never)} activeOpacity={0.7}>
          <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: colors.primary }}>
            Voir les {expectedCollections.unpaidCount} facture{expectedCollections.unpaidCount > 1 ? 's' : ''} →
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ 5. Flux de trésorerie net ══ */}
      <View style={[treasuryStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={treasuryStyles.cardHeaderRow}>
          <View>
            <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>{t('dashboard.cashFlow')}</Text>
            <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Encaissements − Décaissements</Text>
          </View>
          <View style={[treasuryStyles.badge, { backgroundColor: netCashflow >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: netCashflow >= 0 ? '#059669' : '#DC2626' }}>
              {netCashflow >= 0 ? '+' : ''}{formatCurrencyInteger(netCashflow, currency)}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: netCashflow >= 0 ? '#059669' : '#DC2626', letterSpacing: -1, marginBottom: SPACING.SM }}>
          {netCashflow >= 0 ? '+' : ''}{formatCurrencyInteger(netCashflow, currency)}
        </Text>
        {netCashflowSparkline.some((v) => v !== 0) ? (
          <SparklineChart
            data={netCashflowSparkline}
            color={netCashflow >= 0 ? '#059669' : '#EF4444'}
            width={isMobile ? width - 80 : 460}
            height={48}
          />
        ) : (
          <ActionableEmptyState icon="wallet" message="Enregistrez un mouvement pour voir le flux de trésorerie" ctaLabel="Ajouter un mouvement" onCtaPress={() => router.push('/cashflow')} />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.MD }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.XS }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' }} />
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Entrées {formatCurrencyInteger(totalEncaissements, currency)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.XS }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
            <Text style={{ fontSize: 11, color: colors.textTertiary }}>Sorties {formatCurrencyInteger(totalDecaissements, currency)}</Text>
          </View>
        </View>
      </View>

      {/* ══ 6. Projection de trésorerie ══ */}
      <View style={[treasuryStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={treasuryStyles.cardHeaderRow}>
          <View>
            <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>Projection de trésorerie</Text>
            <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Estimation basée sur les factures en attente</Text>
          </View>
          <LegendRow items={[{ color: '#059669', label: 'Réel' }, { color: '#6366F1', label: 'Projeté' }]} textColor={colors.textSecondary} />
        </View>
        {projectionChartState.isEmpty ? (
          <ActionableEmptyState icon="file" message="Créez des factures avec des dates d'échéance pour voir les projections" ctaLabel="Créer une facture" onCtaPress={() => router.push('/ventes')} />
        ) : projectionChartState.isSparse ? (
          <CompactSummaryCard total={projectionData.reduce((s, d) => s + (d.projected || 0), 0)} totalLabel="Montant projeté" unit={currency} message="Créez plus de factures avec échéances pour enrichir les projections" insight={`${projectionChartState.nonEmptyCount} mois avec des projections`} />
        ) : (
          <ProjectionBars data={projectionData} width={isMobile ? width - 80 : 460} height={140} colorActual="#059669" colorProjected="#6366F1" textColor={colors.textSecondary} />
        )}
      </View>

      {/* ══ 7. Évolution solde + Répartition dépenses ══ */}
      <View style={[treasuryStyles.chartsRow, isMobile && { flexDirection: 'column' }]}>
        {/* Évolution du solde */}
        <View style={[treasuryStyles.card, treasuryStyles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>Évolution du solde</Text>
          <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Santé de votre trésorerie sur 6 mois</Text>
          {treasurySparkline.every((v) => v === 0) ? (
            <ActionableEmptyState icon="wallet" message="Enregistrez un mouvement pour suivre l'évolution du solde" ctaLabel="Ajouter un mouvement" onCtaPress={() => router.push('/cashflow')} />
          ) : (
            <TreasuryLineChart
              data={treasurySparkline}
              labels={sixMonthsData.map((m) => m.label)}
              width={isMobile ? width - 80 : 280}
              height={160}
              color={cashBalance >= 0 ? '#059669' : '#EF4444'}
              textColor={colors.textTertiary}
            />
          )}
        </View>

        {/* Répartition des dépenses */}
        <View style={[treasuryStyles.card, treasuryStyles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }, isMobile && { flex: 0 }]}>
          <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>Répartition des dépenses</Text>
          <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Où va votre argent ?</Text>
          {expenseBreakdownSegments.length === 0 ? (
            <ActionableEmptyState icon="pie" message="Enregistrez vos dépenses pour voir leur répartition" ctaLabel="Ajouter une dépense" onCtaPress={() => router.push('/achats')} />
          ) : (
            <View style={{ paddingVertical: SPACING.XL, alignItems: 'center' }}>
              <SmartDonut
                segments={expenseBreakdownSegments}
                size={isMobile ? 100 : 120}
                strokeWidth={18}
                centerValue={formatCurrencyInteger(expenseBreakdownSegments.reduce((s, seg) => s + seg.value, 0), currency)}
                centerLabel="total"
                currency={currency}
              />
            </View>
          )}
        </View>
      </View>

      {/* ══ 8. Délai moyen de paiement ══ */}
      <View style={[treasuryStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={treasuryStyles.cardHeaderRow}>
          <View>
            <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>Délai moyen de paiement</Text>
            <Text style={[treasuryStyles.cardSubtitle, { color: colors.textTertiary }]}>Délais de règlement de vos clients</Text>
          </View>
          <View style={[treasuryStyles.badge, { backgroundColor: avgPaymentDelay <= 30 ? '#ECFDF5' : '#FEF2F2' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: avgPaymentDelay <= 30 ? '#059669' : '#DC2626' }}>
              Actuel : {avgPaymentDelay}j
            </Text>
          </View>
        </View>
        {paymentDelayChartState.isEmpty ? (
          <ActionableEmptyState icon="clock" message="Les délais apparaîtront après vos premières factures réglées" ctaLabel="Créer une facture" onCtaPress={() => router.push('/ventes')} />
        ) : paymentDelayChartState.isSparse ? (
          <CompactSummaryCard total={avgPaymentDelay} totalLabel="Délai moyen" unit="jours" message={`Encore ${3 - paymentDelayChartState.nonEmptyCount} mois de données nécessaires`} insight={`${paymentDelayChartState.nonEmptyCount} mois avec des données`} />
        ) : (
          <HorizontalRefBarChart
            data={paymentDelayData.map((d) => ({ ...d, value: d.value > 0 ? d.value : 0 }))}
            width={isMobile ? width - 80 : 460}
            referenceLine={30}
            referenceLabel="30j (délai légal)"
            goodColor="#059669"
            badColor="#EF4444"
            textColor={colors.textSecondary}
          />
        )}
      </View>

      {/* ══ 9. Factures en retard + fournisseurs à payer ══ */}
      <View style={[treasuryStyles.miniTablesRow, isMobile && { flexDirection: 'column' }]}>
        {/* Factures clients en retard */}
        <View style={[treasuryStyles.miniTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={treasuryStyles.miniTableHeader}>
            <Clock size={14} color="#D97706" />
            <Text style={[treasuryStyles.miniTableTitle, { color: colors.text }]}>{t('dashboard.lateInvoices')}</Text>
          </View>
          {lateClientInvoices.length === 0 ? (
            <Text style={[treasuryStyles.miniTableEmpty, { color: colors.textTertiary }]}>{t('dashboard.noLateInvoices')}</Text>
          ) : (
            lateClientInvoices.map((inv, idx) => (
              <View key={inv.id} style={[treasuryStyles.miniTableRow, idx < lateClientInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[treasuryStyles.cellBold, { color: colors.text }]} numberOfLines={1}>{inv.client}</Text>
                  <Text style={[treasuryStyles.cellSub, { color: colors.danger }]}>{t('dashboard.daysLate', { count: inv.daysLate })}</Text>
                </View>
                <Text style={[treasuryStyles.cellBold, { color: colors.danger }]}>{formatCurrencyInteger(inv.amount, currency)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Fournisseurs à payer */}
        <View style={[treasuryStyles.miniTable, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={treasuryStyles.miniTableHeader}>
            <Truck size={14} color="#7C3AED" />
            <Text style={[treasuryStyles.miniTableTitle, { color: colors.text }]}>{t('dashboard.suppliersDue')}</Text>
          </View>
          {suppliersDue.length === 0 ? (
            <Text style={[treasuryStyles.miniTableEmpty, { color: colors.textTertiary }]}>{t('dashboard.noSupplierInvoices')}</Text>
          ) : (
            suppliersDue.map((si, idx) => (
              <View key={si.id} style={[treasuryStyles.miniTableRow, idx < suppliersDue.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[treasuryStyles.cellBold, { color: colors.text }]} numberOfLines={1}>{si.supplier}</Text>
                  <Text style={[treasuryStyles.cellSub, { color: colors.textTertiary }]}>{t('dashboard.dueDate', { date: formatDate(si.dueDate) })}</Text>
                </View>
                <Text style={[treasuryStyles.cellBold, { color: '#7C3AED' }]}>{formatCurrencyInteger(si.amount, currency)}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ══ 10. Mouvements avec filtre + export FEC ══ */}
      <View style={[treasuryStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={treasuryStyles.cardHeaderRow}>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            onPress={() => setShowMovements((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={[treasuryStyles.cardTitle, { color: colors.text }]}>{t('dashboard.movements')}</Text>
            <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, color: colors.primary }}>
              {showMovements ? t('dashboard.hide') : t('dashboard.showCount', { count: allMovements.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[treasuryStyles.fecBtn, { borderColor: colors.cardBorder }]}
            onPress={onExportFEC}
            activeOpacity={0.7}
          >
            <Download size={13} color={colors.primary} />
            <Text style={[treasuryStyles.fecBtnText, { color: colors.primary }]}>FEC</Text>
          </TouchableOpacity>
        </View>

        {showMovements && (
          <>
            {/* Filtres entrees / sorties */}
            <View style={treasuryStyles.filterRow}>
              {([
                { key: 'all' as MovementFilter, label: t('dashboard.allMovements') },
                { key: 'income' as MovementFilter, label: t('dashboard.income') },
                { key: 'expense' as MovementFilter, label: t('dashboard.expenses') },
              ]).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[treasuryStyles.filterPill, {
                    backgroundColor: movementFilter === f.key ? colors.primary : colors.card,
                    borderColor: movementFilter === f.key ? colors.primary : colors.cardBorder,
                  }]}
                  onPress={() => setMovementFilter(f.key)}
                >
                  <Text style={[treasuryStyles.filterPillText, { color: movementFilter === f.key ? SEMANTIC_COLORS.WHITE : colors.textSecondary }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredMovements.length === 0 ? (
              <ActionableEmptyState icon="wallet" message="Aucun mouvement trouvé pour ce filtre" />
            ) : (
              filteredMovements.slice(0, 20).map((movement, i) => (
                <View
                  key={movement.id}
                  style={[
                    treasuryStyles.movementRow,
                    i < Math.min(filteredMovements.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  ]}
                >
                  <View style={[treasuryStyles.movementIcon, {
                    backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight,
                  }]}>
                    {movement.type === 'income'
                      ? <ArrowUpRight size={14} color={colors.success} />
                      : <ArrowDownRight size={14} color={colors.danger} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[treasuryStyles.cellBold, { color: colors.text }]} numberOfLines={1}>
                      {movement.description}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginTop: SPACING.XXS, flexWrap: 'wrap' }}>
                      <Text style={[treasuryStyles.cellSub, { color: colors.textTertiary }]}>{formatDate(movement.date)}</Text>
                      <View style={[treasuryStyles.sourceBadge, {
                        backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight,
                      }]}>
                        <Text style={[treasuryStyles.sourceText, { color: movement.type === 'income' ? colors.success : colors.danger }]}>
                          {movement.source}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[treasuryStyles.cellBold, { color: movement.type === 'income' ? colors.success : colors.danger }]}>
                    {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount, currency)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const treasuryStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL, ...SHADOWS.SM },
  chartCard: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  cardTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  cardSubtitle: { fontSize: TYPOGRAPHY.SIZE.SMALL, marginTop: 1 },
  chartsRow: { flexDirection: 'row', gap: SPACING.XL },

  kpiRow: { flexDirection: 'row', gap: SPACING.MD },
  badge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },

  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#059669' },
  expectedMetric: { flex: 1, borderWidth: 1, borderRadius: RADIUS.LG, padding: SPACING.LG, alignItems: 'center', gap: SPACING.XS },
  topClientAlert: { flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, marginBottom: SPACING.LG, backgroundColor: '#FEF3C7', paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD },

  miniTablesRow: { flexDirection: 'row', gap: SPACING.LG },
  miniTable: { flex: 1, borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXL, ...SHADOWS.SM },
  miniTableHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, marginBottom: SPACING.LG },
  miniTableTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  miniTableEmpty: { fontSize: TYPOGRAPHY.SIZE.SMALL, paddingVertical: SPACING.XL, textAlign: 'center' },
  miniTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.MD, gap: SPACING.MD },
  cellBold: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  cellSub: { fontSize: TYPOGRAPHY.SIZE.CAPTION, marginTop: 1 },

  fecBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.XS, paddingHorizontal: SPACING.LG, paddingVertical: 5, borderRadius: RADIUS.SM, borderWidth: 1, marginLeft: SPACING.MD },
  fecBtnText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  filterRow: { flexDirection: 'row', gap: SPACING.SM, marginTop: SPACING.XL, marginBottom: SPACING.MD },
  filterPill: { paddingHorizontal: SPACING.XL, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND, borderWidth: 1 },
  filterPillText: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM },
  movementRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.LG, gap: SPACING.LG },
  movementIcon: { width: 32, height: 32, borderRadius: RADIUS.MD, alignItems: 'center', justifyContent: 'center' },
  sourceBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: RADIUS.XS },
  sourceText: { fontSize: 9, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
});