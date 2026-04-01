/**
 * @fileoverview Global search overlay modal.
 * Searches across clients, products, invoices, quotes, sales, and purchase orders.
 * Results are grouped by entity type with navigation to detail pages.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Search, X, Users, Package, FileText, ShoppingCart, Truck, ClipboardList } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';

interface SearchResult {
  id: string;
  type: 'client' | 'product' | 'invoice' | 'quote' | 'sale' | 'supplier' | 'purchase_order';
  title: string;
  subtitle: string;
  route: string;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    activeClients, activeProducts, invoices, quotes, sales,
    activeSuppliers, activePurchaseOrders,
  } = useData();
  const [query, setQuery] = useState('');

  const results = useMemo((): SearchResult[] => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const res: SearchResult[] = [];

    activeClients.forEach(c => {
      const name = c.companyName || `${c.firstName} ${c.lastName}`;
      if (name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
        res.push({ id: c.id, type: 'client', title: name, subtitle: c.email || c.phone || '', route: '/ventes' });
      }
    });

    activeProducts.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) {
        res.push({ id: p.id, type: 'product', title: p.name, subtitle: `REF: ${p.sku}`, route: '/stock' });
      }
    });

    invoices.forEach(i => {
      if (i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)) {
        res.push({ id: i.id, type: 'invoice', title: i.invoiceNumber || 'Brouillon', subtitle: i.clientName, route: '/ventes' });
      }
    });

    quotes.forEach(qt => {
      if (qt.quoteNumber.toLowerCase().includes(q) || qt.clientName.toLowerCase().includes(q)) {
        res.push({ id: qt.id, type: 'quote', title: qt.quoteNumber, subtitle: qt.clientName, route: '/ventes' });
      }
    });

    sales.forEach(s => {
      if (s.saleNumber.toLowerCase().includes(q) || (s.clientName?.toLowerCase().includes(q))) {
        res.push({ id: s.id, type: 'sale', title: s.saleNumber, subtitle: s.clientName || 'Sans client', route: '/sales' });
      }
    });

    activeSuppliers.forEach(s => {
      if (s.companyName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) {
        res.push({ id: s.id, type: 'supplier', title: s.companyName, subtitle: s.email || '', route: '/achats' });
      }
    });

    activePurchaseOrders.forEach(po => {
      if (po.number.toLowerCase().includes(q) || (po.supplierName?.toLowerCase().includes(q))) {
        res.push({ id: po.id, type: 'purchase_order', title: po.number, subtitle: po.supplierName || '', route: '/achats' });
      }
    });

    return res.slice(0, 20);
  }, [query, activeClients, activeProducts, invoices, quotes, sales, activeSuppliers, activePurchaseOrders]);

  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; icon: React.ComponentType<{ size: number; color: string }>; items: SearchResult[] }> = {};
    const typeConfig: Record<string, { label: string; icon: React.ComponentType<{ size: number; color: string }> }> = {
      client: { label: 'Clients', icon: Users },
      product: { label: 'Produits', icon: Package },
      invoice: { label: 'Factures', icon: FileText },
      quote: { label: 'Devis', icon: ClipboardList },
      sale: { label: 'Ventes', icon: ShoppingCart },
      supplier: { label: 'Fournisseurs', icon: Truck },
      purchase_order: { label: 'Commandes', icon: ShoppingCart },
    };
    results.forEach(r => {
      if (!groups[r.type]) {
        const cfg = typeConfig[r.type] || { label: r.type, icon: Search };
        groups[r.type] = { label: cfg.label, icon: cfg.icon, items: [] };
      }
      groups[r.type].items.push(r);
    });
    return groups;
  }, [results]);

  const handleSelect = useCallback((result: SearchResult) => {
    setQuery('');
    onClose();
    router.push(result.route as never);
  }, [onClose, router]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={[styles.searchRow, { borderColor: colors.border }]}>
            <Search size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Rechercher clients, produits, factures, devis..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {query.length >= 2 && results.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucun résultat pour "{query}"</Text>
              </View>
            )}

            {Object.entries(grouped).map(([type, group]) => (
              <View key={type}>
                <View style={styles.groupHeader}>
                  <group.icon size={14} color={colors.textTertiary} />
                  <Text style={[styles.groupLabel, { color: colors.textTertiary }]}>{group.label}</Text>
                  <Text style={[styles.groupCount, { color: colors.textTertiary }]}>{group.items.length}</Text>
                </View>
                {group.items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.resultSubtitle, { color: colors.textTertiary }]}>{item.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {query.length < 2 && (
              <View style={styles.emptyState}>
                <Search size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Tapez au moins 2 caractères pour rechercher</Text>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'center', paddingTop: 80 },
  modal: { width: '90%', maxWidth: 560, borderRadius: 16, maxHeight: '70%', overflow: 'hidden' },
  searchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  input: { flex: 1, fontSize: 16, outlineStyle: 'none' as never },
  results: { maxHeight: 400 },
  emptyState: { alignItems: 'center' as const, paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14 },
  groupHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  groupLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, flex: 1 },
  groupCount: { fontSize: 11 },
  resultRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  resultInfo: { gap: 2 },
  resultTitle: { fontSize: 14, fontWeight: '500' as const },
  resultSubtitle: { fontSize: 12 },
});
