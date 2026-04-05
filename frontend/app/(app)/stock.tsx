/**
 * StockScreen.tsx  (refactorisé)
 *
 * Écran Stock — orchestrateur pur.
 *
 * STRUCTURE :
 *   components/stock/InventaireSection.tsx
 *   components/stock/MouvementsSection.tsx
 *   components/stock/EntrepotsSection.tsx
 *   components/stock/stockStyles.ts
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, useWindowDimensions, StyleSheet,
} from 'react-native';
import { Package, ClipboardList, History, Warehouse, Download } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PageHeader from '@/components/PageHeader';
import ProductsScreen from '@/components/stock/Products';

import InventaireSection from '@/components/stock/InventaireSection';
import MouvementsSection from '@/components/stock/MouvementsSection';
import EntrepotsSection from '@/components/stock/EntrepotsSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type StockTab = 'catalogue' | 'inventaire' | 'mouvements' | 'entrepots';

const TAB_KEYS: {
  key: StockTab;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
}[] = [
  { key: 'catalogue', labelKey: 'stock.catalogue', icon: Package },
  { key: 'inventaire', labelKey: 'stock.inventory', icon: ClipboardList },
  { key: 'mouvements', labelKey: 'stock.movements', icon: History },
  { key: 'entrepots', labelKey: 'stock.warehouses', icon: Warehouse },
];

// ─── Bouton export contextuel ─────────────────────────────────────────────────

function StockTabExportButton({ activeTab }: { activeTab: StockTab }) {
  const { colors } = useTheme();
  const { activeProducts, stockMovements, getProductStock, getVariantsForProduct } = useData();

  const handleExport = useCallback(() => {
    if (activeTab === 'inventaire') {
      const physicalProducts = activeProducts.filter((p) => p.type !== 'service');
      const cols: ExportColumn<Record<string, unknown>>[] = [
        { key: 'name', label: 'Produit' }, { key: 'sku', label: 'SKU' },
        { key: 'stockQuantity', label: 'Stock actuel' }, { key: 'lowStockThreshold', label: 'Seuil min' },
        { key: 'unit', label: 'Unité' }, { key: 'salePrice', label: 'Prix vente' },
        { key: 'purchasePrice', label: 'Prix achat' },
      ];
      const data = physicalProducts.map((p) => {
        const pv = getVariantsForProduct(p.id);
        const stock = pv.length > 0 ? pv.reduce((s, v) => s + v.stockQuantity, 0) : getProductStock(p.id);
        return { ...p, stockQuantity: stock } as unknown as Record<string, unknown>;
      });
      void exportToCSV(data, cols, `inventaire_${new Date().toISOString().slice(0, 10)}.csv`);
    } else if (activeTab === 'mouvements') {
      const cols: ExportColumn<Record<string, unknown>>[] = [
        { key: 'productName', label: 'Produit' }, { key: 'type', label: 'Type' },
        { key: 'quantity', label: 'Quantité' }, { key: 'reference', label: 'Référence' },
        { key: 'notes', label: 'Notes' }, { key: 'createdAt', label: 'Date' },
      ];
      const data = stockMovements.map((sm) => {
        const pName = sm.productName || activeProducts.find((p) => p.id === sm.productId)?.name || 'Inconnu';
        return { ...sm, productName: pName } as unknown as Record<string, unknown>;
      });
      void exportToCSV(data, cols, `mouvements_stock_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  }, [activeTab, activeProducts, stockMovements, getProductStock, getVariantsForProduct]);

  return (
    <TouchableOpacity
      style={[styles.exportBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={handleExport}
      activeOpacity={0.7}
    >
      <Download size={14} color={colors.text} />
    </TouchableOpacity>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function StockScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<StockTab>((tab as StockTab) || 'catalogue');
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('stock.title')} />

      {/* Barre d'onglets */}
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <View style={styles.tabBarRow}>
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
          {(activeTab === 'inventaire' || activeTab === 'mouvements') && (
            <StockTabExportButton activeTab={activeTab} />
          )}
        </View>
      </View>

      {/* Contenu */}
      {activeTab === 'catalogue' ? (
        <ProductsScreen embedded />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'inventaire' && <InventaireSection isMobile={isMobile} />}
          {activeTab === 'mouvements' && <MouvementsSection isMobile={isMobile} />}
          {activeTab === 'entrepots' && <EntrepotsSection isMobile={isMobile} />}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12, paddingBottom: 40 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarRow: { flexDirection: 'row', alignItems: 'center' },
  tabBar: { flexDirection: 'row', gap: 0, flex: 1 },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 6,
    marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  exportBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginRight: 4,
  },
});