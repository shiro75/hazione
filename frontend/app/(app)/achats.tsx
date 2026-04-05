/**
 * AchatsScreen.tsx
 *
 * Écran de gestion des achats — orchestrateur pur.
 *
 * STRUCTURE :
 *   components/achats/FournisseursSection.tsx
 *   components/achats/CommandesSection.tsx
 *   components/achats/FacturesRecuesSection.tsx
 *   components/achats/DepensesSection.tsx
 *   components/achats/SupplierHistoryModal.tsx
 *   components/achats/SupplierDropdown.tsx
 *   components/achats/QuickDropdown.tsx
 *   components/achats/achatsStyles.ts
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { Truck, FileText, ShoppingCart, Receipt } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRole } from '@/contexts/RoleContext';
import { useI18n } from '@/contexts/I18nContext';
import AccessDenied from '@/components/AccessDenied';
import PageHeader from '@/components/PageHeader';

import FournisseursSection from '@/components/achats/FournisseursSection';
import CommandesSection from '@/components/achats/CommandesSection';
import FacturesRecuesSection from '@/components/achats/FacturesRecuesSection';
import DepensesSection from '@/components/achats/DepensesSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type AchatsTab = 'fournisseurs' | 'commandes' | 'factures' | 'depenses';

const TAB_KEYS: {
  key: AchatsTab;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { key: 'fournisseurs', labelKey: 'purchases.suppliers', icon: Truck },
  { key: 'commandes', labelKey: 'purchases.orders', icon: ShoppingCart },
  { key: 'factures', labelKey: 'purchases.receivedInvoices', icon: FileText },
  { key: 'depenses', labelKey: 'expenses.title', icon: Receipt },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AchatsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { canAccess } = useRole();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string; selectedId?: string }>();
  const [activeTab, setActiveTab] = useState<AchatsTab>('fournisseurs');
  const [_highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  if (!canAccess('achats')) return <AccessDenied />;

  useEffect(() => {
    if (params.tab && TAB_KEYS.some((tk) => tk.key === params.tab)) {
      setActiveTab(params.tab as AchatsTab);
    }
    if (params.selectedId) setHighlightedId(params.selectedId);
  }, [params.tab, params.selectedId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('purchases.title')} />

      {/* Barre d'onglets */}
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TAB_KEYS.map((tab) => {
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
        {activeTab === 'fournisseurs' && <FournisseursSection isMobile={isMobile} />}
        {activeTab === 'commandes' && <CommandesSection isMobile={isMobile} />}
        {activeTab === 'factures' && <FacturesRecuesSection isMobile={isMobile} />}
        {activeTab === 'depenses' && <DepensesSection />}
      </ScrollView>
    </View>
  );
}

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