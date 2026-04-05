/**
 * VentesScreen.tsx  (refactorisé)
 *
 * Écran de gestion des ventes — orchestrateur pur.
 * Chaque section est déléguée à son propre composant.
 *
 * STRUCTURE :
 *   components/ventes/ClientsSection.tsx
 *   components/ventes/DevisSection.tsx
 *   components/ventes/FacturesSection.tsx
 *   components/ventes/RelancesSection.tsx
 *   components/ventes/AvoirsSection.tsx
 *   components/ventes/RecurrentesSection.tsx
 *   components/ventes/BonsLivraisonSection.tsx
 *   components/ventes/ShopCommandesSection.tsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Users, FileText, ClipboardList, ShoppingCart, Bell, RefreshCw, Truck } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useQuery } from '@tanstack/react-query';
import { shopDb } from '@/services/shopService';
import PageHeader from '@/components/PageHeader';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import { Download } from 'lucide-react-native';

import ClientsSection from '@/components/ventes/ClientsSection';
import DevisSection from '@/components/ventes/DevisSection';
import FacturesSection from '@/components/ventes/FacturesSection';
import RelancesSection from '@/components/ventes/RelancesSection';
import AvoirsSection from '@/components/ventes/AvoirsSection';
import RecurrentesSection from '@/components/ventes/RecurrentesSection';
import BonsLivraisonSection from '@/components/ventes/BonsLivraisonSection';
import ShopCommandesSection from '@/components/ventes/ShopCommandesSection';

import { useWindowDimensions } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type VentesTab = 'clients' | 'devis' | 'factures' | 'commandes';
type FacturesSubTab = 'factures' | 'avoirs' | 'relances' | 'recurrentes';
type CommandesSubTab = 'commandes' | 'livraisons';

const VENTES_TAB_KEYS: {
  key: VentesTab;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { key: 'clients', labelKey: 'ventes.clients', icon: Users },
  { key: 'devis', labelKey: 'ventes.quotes', icon: ClipboardList },
  { key: 'factures', labelKey: 'ventes.invoices', icon: FileText },
  { key: 'commandes', labelKey: 'ventes.orders', icon: ShoppingCart },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function VentesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const { user } = useAuth();
  const { creditNotes, lateInvoices, recurringInvoices, deliveryNotes, getCurrency, quotes } = useData();
  const params = useLocalSearchParams<{ tab?: string; selectedId?: string }>();

  const [activeTab, setActiveTab] = useState<VentesTab>('clients');
  const [facturesSubTab, setFacturesSubTab] = useState<FacturesSubTab>('factures');
  const [commandesSubTab, setCommandesSubTab] = useState<CommandesSubTab>('commandes');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const COMPANY_ID = user?.id ?? 'anonymous';
  const currency = getCurrency();

  // Commandes boutique — chargées au niveau orchestrateur pour le compteur de badge
  const ordersQuery = useQuery({
    queryKey: ['shop-orders', COMPANY_ID],
    queryFn: () => shopDb.fetchShopOrders(COMPANY_ID),
    staleTime: 10000,
  });
  const orders = ordersQuery.data ?? [];
  const newOrdersCount = orders.filter((o) => o.status === 'en_attente').length;

  // Navigation depuis les paramètres URL
  useEffect(() => {
    if (!params.tab) return;
    if (VENTES_TAB_KEYS.some((tk) => tk.key === params.tab)) {
      setActiveTab(params.tab as VentesTab);
    }
    if (['avoirs', 'relances', 'recurrentes'].includes(params.tab)) {
      setActiveTab('factures');
      setFacturesSubTab(params.tab as FacturesSubTab);
    }
    if (params.tab === 'livraisons') {
      setActiveTab('commandes');
      setCommandesSubTab('livraisons');
    }
    if (params.selectedId) setHighlightedId(params.selectedId);
  }, [params.tab, params.selectedId]);

  // ── Sous-onglets Factures ──────────────────────────────────────────────────

  const FACTURES_SUB_TABS: {
    key: FacturesSubTab;
    label: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    count?: number;
  }[] = [
    { key: 'factures', label: 'Factures', icon: FileText },
    { key: 'avoirs', label: 'Avoirs', icon: FileText, count: creditNotes.length },
    { key: 'relances', label: 'Relances', icon: Bell, count: lateInvoices.length },
    { key: 'recurrentes', label: 'Récurrentes', icon: RefreshCw, count: recurringInvoices.length },
  ];

  const COMMANDES_SUB_TABS: {
    key: CommandesSubTab;
    label: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    count?: number;
  }[] = [
    { key: 'commandes', label: 'Commandes', icon: ShoppingCart, count: newOrdersCount > 0 ? newOrdersCount : undefined },
    { key: 'livraisons', label: 'Livraisons', icon: Truck, count: deliveryNotes.length },
  ];

  // ── Contenu de l'onglet actif ──────────────────────────────────────────────

  const renderTabContent = () => {
    switch (activeTab) {
      case 'clients':
        return <ClientsSection isMobile={isMobile} />;

      case 'devis':
        return (
          <DevisSection
            isMobile={isMobile}
            highlightedId={highlightedId}
            onHighlightClear={() => setHighlightedId(null)}
          />
        );

      case 'factures':
        return (
          <>
            <SubTabBar
              tabs={FACTURES_SUB_TABS}
              activeTab={facturesSubTab}
              onTabChange={setFacturesSubTab}
              colors={colors}
            />
            {facturesSubTab === 'factures' && (
              <FacturesSection
                isMobile={isMobile}
                highlightedId={highlightedId}
                onHighlightClear={() => setHighlightedId(null)}
              />
            )}
            {facturesSubTab === 'avoirs' && <AvoirsSection isMobile={isMobile} />}
            {facturesSubTab === 'relances' && <RelancesSection isMobile={isMobile} />}
            {facturesSubTab === 'recurrentes' && <RecurrentesSection isMobile={isMobile} />}
          </>
        );

      case 'commandes':
        return (
          <>
            <SubTabBar
              tabs={COMMANDES_SUB_TABS}
              activeTab={commandesSubTab}
              onTabChange={setCommandesSubTab}
              colors={colors}
              rightAction={
                <TouchableOpacity
                  style={subTabStyles.exportBtn}
                  onPress={() => {
                    const cols: ExportColumn<Record<string, unknown>>[] = [
                      { key: 'orderNumber', label: 'N° Commande' },
                      { key: 'customerFirstName', label: 'Prénom' },
                      { key: 'customerLastName', label: 'Nom' },
                      { key: 'customerEmail', label: 'Email' },
                      { key: 'status', label: 'Statut' },
                      { key: 'totalTtc', label: 'Total TTC' },
                      { key: 'deliveryMode', label: 'Mode livraison' },
                      { key: 'paymentMethod', label: 'Paiement' },
                      { key: 'createdAt', label: 'Date' },
                    ];
                    void exportToCSV(
                      orders.map((o) => ({ ...o } as unknown as Record<string, unknown>)),
                      cols,
                      `commandes_${new Date().toISOString().slice(0, 10)}.csv`,
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Download size={14} color={colors.text} />
                </TouchableOpacity>
              }
            />
            {commandesSubTab === 'commandes' && (
              <ShopCommandesSection
                orders={orders}
                companyId={COMPANY_ID}
                currency={currency}
                isLoading={ordersQuery.isLoading}
              />
            )}
            {commandesSubTab === 'livraisons' && <BonsLivraisonSection isMobile={isMobile} />}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="ventes-screen">
      <PageHeader title={t('ventes.title')} />

      {/* Barre d'onglets principale */}
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {VENTES_TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                testID={`ventes-tab-${tab.key}`}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => {
                  setActiveTab(tab.key);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                activeOpacity={0.7}
              >
                <TabIcon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}

// ─── SubTabBar — barre de sous-onglets réutilisable ───────────────────────────

interface SubTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  count?: number;
}

function SubTabBar<T extends string>({
  tabs, activeTab, onTabChange, colors, rightAction,
}: {
  tabs: SubTab[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  colors: any;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={[subTabStyles.bar, { borderBottomColor: colors.border }]}>
      <View style={subTabStyles.tabsRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[subTabStyles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => onTabChange(tab.key as T)}
              activeOpacity={0.7}
            >
              <tab.icon size={15} color={active ? colors.primary : colors.textTertiary} />
              <Text style={[subTabStyles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </Text>
              {tab.count !== undefined && tab.count > 0 ? (
                <View style={[subTabStyles.badge, { backgroundColor: `${colors.primary}15` }]}>
                  <Text style={[subTabStyles.badgeText, { color: colors.primary }]}>{tab.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {rightAction}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16, paddingBottom: 40 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBar: { flexDirection: 'row', gap: 0 },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 6,
    marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
});

const subTabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: 20, minHeight: 40,
    alignItems: 'center', justifyContent: 'space-between',
  },
  tabsRow: { flexDirection: 'row', alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  exportBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
});