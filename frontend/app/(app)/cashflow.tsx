/**
 * @fileoverview Cash flow / Treasury screen with tabs: Overview, Movements, Journals.
 * Displays computed balance from invoices and sales, monthly charts,
 * late client invoices, supplier invoices due, and FEC export.
 * Scrolls to top on tab change.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Platform, Share } from 'react-native';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet, AlertTriangle, Inbox, Download } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import { formatCurrency, formatDate, generateFECExport } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import { useConfirm } from '@/contexts/ConfirmContext';

type CashTab = 'overview' | 'movements' | 'journals';
type MovementFilter = 'all' | 'income' | 'expense';
type PeriodFilter = 'month' | '3months' | '6months' | 'year';
type JournalFilter = 'all' | 'cash' | 'bank' | 'card' | 'other';

interface RealMovement {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  source: string;
}

export default function CashFlowScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { canAccess } = useRole();
  const { successAlert, errorAlert } = useConfirm();
  const isMobile = width < 768;
  const [activeTab, setActiveTab] = useState<CashTab>('overview');
  const scrollRef = useRef<ScrollView>(null);

  if (!canAccess('cashflow')) {
    return <AccessDenied />;
  }
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('6months');
  const [journalFilter, setJournalFilter] = useState<JournalFilter>('all');

  const { invoices, activeSupplierInvoices, clients, sales, company } = useData();
  const cur = company.currency || 'EUR';

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) {
      map[c.id] = c.companyName || `${c.firstName} ${c.lastName}`;
    }
    return map;
  }, [clients]);

  const now = useMemo(() => new Date(), []);

  const periodStart = useMemo(() => {
    const d = new Date(now);
    switch (periodFilter) {
      case 'month': d.setMonth(d.getMonth() - 1); break;
      case '3months': d.setMonth(d.getMonth() - 3); break;
      case '6months': d.setMonth(d.getMonth() - 6); break;
      case 'year': d.setFullYear(d.getFullYear() - 1); break;
    }
    return d;
  }, [now, periodFilter]);

  const paidInvoices = useMemo(() =>
    invoices.filter(i => i.status === 'paid' && new Date(i.issueDate) >= periodStart),
    [invoices, periodStart]
  );

  const paidSupplierInvoices = useMemo(() =>
    activeSupplierInvoices.filter(si => si.status === 'paid' && new Date(si.date) >= periodStart),
    [activeSupplierInvoices, periodStart]
  );

  const paidSales = useMemo(() =>
    sales.filter(s => s.status === 'paid' && new Date(s.createdAt) >= periodStart),
    [sales, periodStart]
  );

  const refundedSales = useMemo(() =>
    sales.filter(s => s.status === 'refunded' && s.refundedAt && new Date(s.refundedAt) >= periodStart),
    [sales, periodStart]
  );

  const paidInvoiceIds = useMemo(() => new Set(paidInvoices.map(i => i.id)), [paidInvoices]);

  const salesNotFromInvoices = useMemo(() => {
    return paidSales.filter(s => !s.convertedToInvoiceId || !paidInvoiceIds.has(s.convertedToInvoiceId));
  }, [paidSales, paidInvoiceIds]);

  const totalEncaissements = useMemo(() =>
    paidInvoices.reduce((s, i) => s + i.totalTTC, 0) + salesNotFromInvoices.reduce((s, sale) => s + sale.totalTTC, 0),
    [paidInvoices, salesNotFromInvoices]
  );

  const totalDecaissements = useMemo(() =>
    paidSupplierInvoices.reduce((s, si) => s + (si.total || 0), 0) + refundedSales.reduce((s, sale) => s + sale.totalTTC, 0),
    [paidSupplierInvoices, refundedSales]
  );

  const solde = totalEncaissements - totalDecaissements;

  const allMovements = useMemo((): RealMovement[] => {
    const moves: RealMovement[] = [];

    for (const inv of paidInvoices) {
      moves.push({
        id: `inv-${inv.id}`,
        type: 'income',
        amount: inv.totalTTC,
        description: `Facture ${inv.invoiceNumber} — ${clientMap[inv.clientId] || inv.clientName}`,
        date: inv.issueDate,
        source: 'Facture client',
      });
    }

    for (const sale of salesNotFromInvoices) {
      moves.push({
        id: `sale-${sale.id}`,
        type: 'income',
        amount: sale.totalTTC,
        description: `Vente ${sale.saleNumber}${sale.clientName ? ` — ${sale.clientName}` : ''}`,
        date: sale.createdAt,
        source: 'Vente comptoir',
      });
    }

    for (const sale of refundedSales) {
      moves.push({
        id: `refund-${sale.id}`,
        type: 'expense',
        amount: sale.totalTTC,
        description: `Remboursement ${sale.saleNumber}${sale.clientName ? ` — ${sale.clientName}` : ''}`,
        date: sale.refundedAt || sale.createdAt,
        source: 'Remboursement',
      });
    }

    for (const si of paidSupplierInvoices) {
      moves.push({
        id: `si-${si.id}`,
        type: 'expense',
        amount: si.total || 0,
        description: `Facture ${si.number} — ${si.supplierName || 'Fournisseur'}`,
        date: si.date,
        source: 'Facture fournisseur',
      });
    }

    moves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return moves;
  }, [paidInvoices, paidSupplierInvoices, clientMap, salesNotFromInvoices, refundedSales]);

  const filteredMovements = useMemo(() => {
    let list = allMovements;
    if (movementFilter !== 'all') {
      list = list.filter(m => m.type === movementFilter);
    }
    return list;
  }, [allMovements, movementFilter]);

  const inferJournal = useCallback((movement: RealMovement): string => {
    const src = movement.source.toLowerCase();
    if (src.includes('comptoir') || src.includes('caisse') || src.includes('esp')) return 'cash';
    if (src.includes('carte') || src.includes('card')) return 'card';
    if (src.includes('virement') || src.includes('bank') || src.includes('facture')) return 'bank';
    return 'other';
  }, []);

  const journalMovements = useMemo(() => {
    if (journalFilter === 'all') return allMovements;
    return allMovements.filter(m => inferJournal(m) === journalFilter);
  }, [allMovements, journalFilter, inferJournal]);

  const journalBalances = useMemo(() => {
    const balances: Record<string, { income: number; expense: number }> = {
      cash: { income: 0, expense: 0 },
      bank: { income: 0, expense: 0 },
      card: { income: 0, expense: 0 },
      other: { income: 0, expense: 0 },
    };
    allMovements.forEach(m => {
      const j = inferJournal(m);
      if (m.type === 'income') balances[j].income += m.amount;
      else balances[j].expense += m.amount;
    });
    return balances;
  }, [allMovements, inferJournal]);

  const JOURNAL_FILTERS: { key: JournalFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: '' },
    { key: 'cash', label: 'Caisse', icon: '' },
    { key: 'bank', label: 'Banque', icon: '' },
    { key: 'card', label: 'Carte', icon: '' },
    { key: 'other', label: 'Autre', icon: '' },
  ];

  const JOURNAL_LABELS: Record<string, string> = {
    cash: 'Caisse espèces',
    bank: 'Compte bancaire',
    card: 'Carte',
    other: 'Autre',
  };

  const monthlyData = useMemo(() => {
    const months: { month: string; encaissements: number; decaissements: number }[] = [];
    const convertedInvoiceIds = new Set(
      sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!)
    );
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

      const enc = invoices
        .filter(inv => inv.status === 'paid' && new Date(inv.issueDate) >= d && new Date(inv.issueDate) < end)
        .reduce((s, inv) => s + inv.totalTTC, 0);

      const saleEnc = sales
        .filter(s => s.status === 'paid' && new Date(s.createdAt) >= d && new Date(s.createdAt) < end && (!s.convertedToInvoiceId || !convertedInvoiceIds.has(s.convertedToInvoiceId)))
        .reduce((s, sale) => s + sale.totalTTC, 0);

      const dec = activeSupplierInvoices
        .filter(si => si.status === 'paid' && new Date(si.date) >= d && new Date(si.date) < end)
        .reduce((s, si) => s + (si.total || 0), 0);

      const refDec = sales
        .filter(s => s.status === 'refunded' && s.refundedAt && new Date(s.refundedAt) >= d && new Date(s.refundedAt) < end)
        .reduce((s, sale) => s + sale.totalTTC, 0);

      months.push({ month: label, encaissements: enc + saleEnc, decaissements: dec + refDec });
    }
    return months;
  }, [invoices, activeSupplierInvoices, sales, now]);

  const maxChartValue = useMemo(() => {
    const all = monthlyData.flatMap(m => [m.encaissements, m.decaissements]);
    return Math.max(...all, 1);
  }, [monthlyData]);

  const unpaidInvoices = useMemo(() =>
    invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft'),
    [invoices]
  );
  const unpaidAmount = useMemo(() =>
    unpaidInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0),
    [unpaidInvoices]
  );

  const hasData = paidInvoices.length > 0 || paidSupplierInvoices.length > 0 || salesNotFromInvoices.length > 0;

  const handleExportFEC = useCallback(async () => {
    try {
      const startDate = periodStart.toISOString();
      const endDate = now.toISOString();
      const movements = allMovements.map(m => ({
        id: m.id,
        date: m.date,
        type: m.type,
        amount: m.amount,
        description: m.description,
        reference: m.source,
      }));
      const fecContent = generateFECExport({
        movements,
        companyName: company.name || 'Mon entreprise',
        siret: company.siret || '',
        startDate,
        endDate,
        currency: company.currency || 'EUR',
      });
      if (Platform.OS === 'web') {
        const blob = new Blob([fecContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FEC_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        successAlert('Export FEC', 'Fichier FEC téléchargé');
      } else {
        await Share.share({ message: fecContent, title: 'Export FEC' });
      }
    } catch {
      errorAlert('Erreur', 'Impossible de générer l\'export FEC');
    }
  }, [allMovements, company, periodStart, now, successAlert, errorAlert]);

  const TABS: { key: CashTab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: Wallet },
    { key: 'movements', label: 'Mouvements', icon: ArrowUpRight },
    { key: 'journals', label: 'Journaux', icon: Download },
  ];

  const PERIOD_FILTERS: { key: PeriodFilter; label: string }[] = [
    { key: 'month', label: 'Ce mois' },
    { key: '3months', label: '3 mois' },
    { key: '6months', label: '6 mois' },
    { key: 'year', label: 'Année' },
  ];

  const MOVEMENT_FILTERS: { key: MovementFilter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'income', label: 'Entrées' },
    { key: 'expense', label: 'Sorties' },
  ];

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
        <Inbox size={32} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun mouvement pour le moment</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
        Les encaissements et décaissements apparaîtront ici dès que vos factures seront payées.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title="Trésorerie"
        action={
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
            onPress={handleExportFEC}
            activeOpacity={0.7}
          >
            <Download size={16} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'overview' && (
          <>
            <View style={[styles.soldeCard, { backgroundColor: solde >= 0 ? '#052E16' : '#450A0A', borderColor: solde >= 0 ? '#065F46' : '#7F1D1D' }]}>
              <View style={styles.soldeHeader}>
                <Wallet size={20} color={solde >= 0 ? '#34D399' : '#FCA5A5'} />
                <Text style={[styles.soldeLabel, { color: solde >= 0 ? '#A7F3D0' : '#FECACA' }]}>Solde calculé</Text>
              </View>
              <Text style={[styles.soldeValue, { color: solde >= 0 ? '#34D399' : '#FCA5A5' }]}>
                {formatCurrency(solde, cur)}
              </Text>
              <Text style={[styles.soldeNote, { color: solde >= 0 ? '#6EE7B7' : '#FCA5A5' }]}>
                Encaissements − Décaissements (factures payées)
              </Text>
              {solde < 0 && (
                <View style={styles.soldeAlert}>
                  <AlertTriangle size={14} color="#FCA5A5" />
                  <Text style={styles.soldeAlertText}>Solde négatif — vérifiez vos encaissements</Text>
                </View>
              )}
            </View>

            <View style={[styles.kpiRow, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.successLight }]}>
                  <TrendingUp size={20} color={colors.success} />
                </View>
                <Text style={[styles.kpiValue, { color: colors.success }]}>{formatCurrency(totalEncaissements, cur)}</Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Encaissements</Text>
                <Text style={[styles.kpiDetail, { color: colors.textTertiary }]}>{paidInvoices.length} factures payées</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.dangerLight }]}>
                  <TrendingDown size={20} color={colors.danger} />
                </View>
                <Text style={[styles.kpiValue, { color: colors.danger }]}>{formatCurrency(totalDecaissements, cur)}</Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Décaissements</Text>
                <Text style={[styles.kpiDetail, { color: colors.textTertiary }]}>{paidSupplierInvoices.length} factures fourn.</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={[styles.kpiIcon, { backgroundColor: colors.warningLight }]}>
                  <AlertTriangle size={20} color={colors.warning} />
                </View>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>{formatCurrency(unpaidAmount, cur)}</Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Impayés clients</Text>
                <Text style={[styles.kpiDetail, { color: colors.textTertiary }]}>{unpaidInvoices.length} factures</Text>
              </View>
            </View>

            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartTitle, { color: colors.text }]}>Flux sur 6 mois</Text>
                <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>Encaissements vs Décaissements</Text>
              </View>
              {!hasData ? (
                <View style={styles.chartEmpty}>
                  <Text style={[styles.chartEmptyText, { color: colors.textTertiary }]}>Pas de données pour cette période</Text>
                </View>
              ) : (
                <>
                  <View style={styles.barChart}>
                    {monthlyData.map((item) => (
                      <View key={item.month} style={styles.barGroup}>
                        <View style={styles.barContainer}>
                          <View
                            style={[
                              styles.barExpense,
                              {
                                height: `${(item.decaissements / maxChartValue) * 100}%` as never,
                                backgroundColor: colors.danger + '40',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.barRevenue,
                              {
                                height: `${(item.encaissements / maxChartValue) * 100}%` as never,
                                backgroundColor: colors.success,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, { color: colors.textTertiary }]}>{item.month}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.legendText, { color: colors.textSecondary }]}>Encaissements</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.danger + '40' }]} />
                      <Text style={[styles.legendText, { color: colors.textSecondary }]}>Décaissements</Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={[styles.chartsRow, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.chartTitle, { color: colors.text, marginBottom: 16 }]}>Indicateurs clés</Text>
                <View style={styles.indicatorList}>
                  <View style={[styles.indicatorRow, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.indicatorLabel, { color: colors.textSecondary }]}>Flux net (période)</Text>
                    <Text style={[styles.indicatorValue, { color: solde >= 0 ? colors.success : colors.danger }]}>
                      {solde >= 0 ? '+' : ''}{formatCurrency(solde, cur)}
                    </Text>
                  </View>
                  <View style={[styles.indicatorRow, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.indicatorLabel, { color: colors.textSecondary }]}>Factures payées</Text>
                    <Text style={[styles.indicatorValue, { color: colors.text }]}>{paidInvoices.length}</Text>
                  </View>
                  <View style={[styles.indicatorRow, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.indicatorLabel, { color: colors.textSecondary }]}>Impayés en cours</Text>
                    <Text style={[styles.indicatorValue, { color: colors.warning }]}>{formatCurrency(unpaidAmount, cur)}</Text>
                  </View>
                  <View style={styles.indicatorRow}>
                    <Text style={[styles.indicatorLabel, { color: colors.textSecondary }]}>Marge nette</Text>
                    <Text style={[styles.indicatorValue, { color: totalEncaissements > 0 ? colors.success : colors.textTertiary }]}>
                      {totalEncaissements > 0 ? `${((solde / totalEncaissements) * 100).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {activeTab === 'journals' && (
          <>
            <View style={[styles.kpiRow, isMobile && { flexDirection: 'column' }]}>
              {(['cash', 'bank', 'card', 'other'] as const).map((j) => {
                const bal = journalBalances[j];
                const soldeJ = bal.income - bal.expense;
                return (
                  <TouchableOpacity
                    key={j}
                    style={[
                      styles.kpiCard,
                      {
                        backgroundColor: journalFilter === j ? colors.primaryLight : colors.card,
                        borderColor: journalFilter === j ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setJournalFilter(journalFilter === j ? 'all' : j)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary, marginBottom: 4 }]}>{JOURNAL_LABELS[j]}</Text>
                    <Text style={[styles.kpiValue, { color: soldeJ >= 0 ? colors.success : colors.danger }]}>
                      {formatCurrency(soldeJ, cur)}
                    </Text>
                    <Text style={[styles.kpiDetail, { color: colors.textTertiary }]}>
                      +{formatCurrency(bal.income, cur)} / -{formatCurrency(bal.expense, cur)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filtersRow}>
              <View style={[styles.filterGroup, isMobile && { flexWrap: 'wrap' as const }]}>
                {JOURNAL_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: journalFilter === f.key ? colors.primary : colors.card,
                        borderColor: journalFilter === f.key ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setJournalFilter(f.key)}
                  >
                    <Text style={[styles.filterPillText, { color: journalFilter === f.key ? '#FFF' : colors.textSecondary }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.movementsSummary, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                <Text style={styles.summaryBold}>{journalMovements.length}</Text> mouvements
              </Text>
              <Text style={[styles.summaryText, { color: colors.success }]}>
                +{formatCurrency(journalMovements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0), cur)}
              </Text>
              <Text style={[styles.summaryText, { color: colors.danger }]}>
                -{formatCurrency(journalMovements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0), cur)}
              </Text>
            </View>

            {journalMovements.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {journalMovements.map((movement, i) => (
                  <View
                    key={movement.id}
                    style={[
                      styles.movementRow,
                      i < journalMovements.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <View style={[
                      styles.movementIcon,
                      { backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight },
                    ]}>
                      {movement.type === 'income' ? (
                        <ArrowUpRight size={16} color={colors.success} />
                      ) : (
                        <ArrowDownRight size={16} color={colors.danger} />
                      )}
                    </View>
                    <View style={styles.movementInfo}>
                      <Text style={[styles.movementDesc, { color: colors.text }]} numberOfLines={1}>{movement.description}</Text>
                      <View style={styles.movementMetaRow}>
                        <Text style={[styles.movementDate, { color: colors.textTertiary }]}>
                          {formatDate(movement.date)}
                        </Text>
                        <View style={[styles.sourceBadge, { backgroundColor: colors.surfaceHover }]}>
                          <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                            {JOURNAL_LABELS[inferJournal(movement)] || 'Autre'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[
                      styles.movementAmount,
                      { color: movement.type === 'income' ? colors.success : colors.danger },
                    ]}>
                      {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount, cur)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'movements' && (
          <>
            <View style={styles.filtersRow}>
              <View style={[styles.filterGroup, isMobile && { flexWrap: 'wrap' as const }]}>
                {MOVEMENT_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: movementFilter === f.key ? colors.primary : colors.card,
                        borderColor: movementFilter === f.key ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setMovementFilter(f.key)}
                  >
                    <Text style={[styles.filterPillText, { color: movementFilter === f.key ? '#FFF' : colors.textSecondary }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.filterGroup, isMobile && { flexWrap: 'wrap' as const }]}>
                {PERIOD_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: periodFilter === f.key ? colors.primaryLight : colors.card,
                        borderColor: periodFilter === f.key ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setPeriodFilter(f.key)}
                  >
                    <Text style={[styles.filterPillText, { color: periodFilter === f.key ? colors.primary : colors.textSecondary }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.movementsSummary, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                <Text style={styles.summaryBold}>{filteredMovements.length}</Text> mouvements
              </Text>
              <Text style={[styles.summaryText, { color: colors.success }]}>
                +{formatCurrency(filteredMovements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0), cur)}
              </Text>
              <Text style={[styles.summaryText, { color: colors.danger }]}>
                -{formatCurrency(filteredMovements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0), cur)}
              </Text>
            </View>

            {filteredMovements.length === 0 ? (
              renderEmptyState()
            ) : (
              <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {filteredMovements.map((movement, i) => (
                  <View
                    key={movement.id}
                    style={[
                      styles.movementRow,
                      i < filteredMovements.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <View style={[
                      styles.movementIcon,
                      { backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight },
                    ]}>
                      {movement.type === 'income' ? (
                        <ArrowUpRight size={16} color={colors.success} />
                      ) : (
                        <ArrowDownRight size={16} color={colors.danger} />
                      )}
                    </View>
                    <View style={styles.movementInfo}>
                      <Text style={[styles.movementDesc, { color: colors.text }]} numberOfLines={1}>{movement.description}</Text>
                      <View style={styles.movementMetaRow}>
                        <Text style={[styles.movementDate, { color: colors.textTertiary }]}>
                          {formatDate(movement.date)}
                        </Text>
                        <View style={[styles.sourceBadge, { backgroundColor: movement.type === 'income' ? colors.successLight : colors.dangerLight }]}>
                          <Text style={[styles.sourceText, { color: movement.type === 'income' ? colors.success : colors.danger }]}>
                            {movement.source}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[
                      styles.movementAmount,
                      { color: movement.type === 'income' ? colors.success : colors.danger },
                    ]}>
                      {movement.type === 'income' ? '+' : '-'}{formatCurrency(movement.amount, cur)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBar: { flexDirection: 'row' as const, gap: 0 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  soldeCard: { borderWidth: 1, borderRadius: 16, padding: 24 },
  soldeHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 },
  soldeLabel: { fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  soldeValue: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  soldeNote: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  soldeAlert: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 12 },
  soldeAlertText: { fontSize: 12, color: '#FCA5A5', fontWeight: '500' as const },
  kpiRow: { flexDirection: 'row' as const, gap: 12 },
  kpiCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 20, alignItems: 'center' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  kpiIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 },
  kpiValue: { fontSize: 24, fontWeight: '800' as const, marginBottom: 4, letterSpacing: -0.3 },
  kpiLabel: { fontSize: 12, textAlign: 'center' as const },
  kpiDetail: { fontSize: 11, marginTop: 2 },
  chartCard: { borderWidth: 1, borderRadius: 14, padding: 20, flex: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  chartHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: '600' as const },
  chartSubtitle: { fontSize: 13 },
  chartEmpty: { height: 120, alignItems: 'center' as const, justifyContent: 'center' as const },
  chartEmptyText: { fontSize: 14 },
  barChart: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, height: 180, gap: 4 },
  barGroup: { flex: 1, alignItems: 'center' as const, gap: 6 },
  barContainer: { flex: 1, width: '80%' as const, justifyContent: 'flex-end' as const, gap: 2 },
  barRevenue: { borderRadius: 3, minHeight: 4 },
  barExpense: { borderRadius: 3, minHeight: 2 },
  barLabel: { fontSize: 10, fontWeight: '500' as const },
  legend: { flexDirection: 'row' as const, gap: 16, marginTop: 16 },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  chartsRow: { flexDirection: 'row' as const, gap: 16 },
  indicatorList: { gap: 0 },
  indicatorRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 12, borderBottomWidth: 1 },
  indicatorLabel: { fontSize: 13 },
  indicatorValue: { fontSize: 14, fontWeight: '600' as const },
  filtersRow: { gap: 10 },
  filterGroup: { flexDirection: 'row' as const, gap: 6 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillText: { fontSize: 13, fontWeight: '500' as const },
  movementsSummary: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, borderRadius: 10, padding: 12, borderWidth: 1 },
  summaryText: { fontSize: 13, fontWeight: '500' as const },
  summaryBold: { fontWeight: '700' as const },
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  movementRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  movementIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  movementInfo: { flex: 1 },
  movementDesc: { fontSize: 14, fontWeight: '500' as const },
  movementDate: { fontSize: 12, marginTop: 2 },
  movementMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 2, flexWrap: 'wrap' as const },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sourceText: { fontSize: 10, fontWeight: '600' as const },
  movementAmount: { fontSize: 14, fontWeight: '600' as const },
  emptyState: { borderWidth: 1, borderRadius: 16, padding: 40, alignItems: 'center' as const, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const },
  emptySubtitle: { fontSize: 14, textAlign: 'center' as const, lineHeight: 20, maxWidth: 300 },
  fecExportBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, gap: 6 },
  fecExportBtnText: { fontSize: 13, fontWeight: '600' as const },
});
