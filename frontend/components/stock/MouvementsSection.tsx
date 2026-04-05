/**
 * components/stock/MouvementsSection.tsx
 * Historique des mouvements de stock avec timeline et filtres.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { History, ArrowUp, ArrowDown, RotateCcw, ArrowUpDown as ArrowUpDownIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatDate } from '@/utils/format';
import { styles } from './stockStyles';

const TYPE_FILTERS = [
  { label: 'Tous', value: 'all' },
  { label: 'Entrée achat', value: 'purchase_in' },
  { label: 'Sortie vente', value: 'sale_out' },
  { label: 'Ajustement', value: 'adjustment' },
  { label: 'Correction', value: 'inventory_correction' },
];

const TYPE_LABEL_MAP: Record<string, string> = {
  purchase_in: 'Entrée achat',
  sale_out: 'Sortie vente',
  adjustment: 'Ajustement',
  inventory_correction: 'Correction inventaire',
  in: 'Entrée',
  out: 'Sortie',
};

export default function MouvementsSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { stockMovements, activeProducts } = useData();
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'product' | 'type'>('date');
  const [productFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = stockMovements;
    if (typeFilter !== 'all') list = list.filter((sm) => sm.type === typeFilter);
    if (productFilter !== 'all') list = list.filter((sm) => sm.productId === productFilter);
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'product': return (a.productName || '').localeCompare(b.productName || '');
        case 'type': return a.type.localeCompare(b.type);
        default: return 0;
      }
    });
  }, [stockMovements, typeFilter, productFilter, sortBy]);

  const getTypeColor = (type: string) => {
    if (type === 'purchase_in' || type === 'in') return { bg: colors.successLight, text: colors.success };
    if (type === 'sale_out' || type === 'out') return { bg: colors.dangerLight, text: colors.danger };
    return { bg: colors.warningLight, text: colors.warning };
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TYPE_FILTERS.map((f) => (
          <TouchableOpacity key={f.value} style={[styles.filterChip, { backgroundColor: typeFilter === f.value ? colors.primary : colors.card, borderColor: typeFilter === f.value ? colors.primary : colors.cardBorder }]} onPress={() => setTypeFilter(f.value)}>
            <Text style={[styles.filterChipText, { color: typeFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDownIcon size={13} color={colors.textTertiary} />
        {([{ value: 'date' as const, label: 'Date' }, { value: 'product' as const, label: 'Produit' }, { value: 'type' as const, label: 'Type' }]).map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><History size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun mouvement de stock</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les entrées, sorties et corrections apparaîtront ici</Text>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          {filtered.map((sm, i) => {
            const tc = getTypeColor(sm.type);
            const isIn = sm.type === 'purchase_in' || sm.type === 'in';
            const isOut = sm.type === 'sale_out' || sm.type === 'out';
            const productName = sm.productName || activeProducts.find((p) => p.id === sm.productId)?.name || 'Inconnu';
            return (
              <View key={sm.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIcon, { backgroundColor: tc.bg }]}>
                    {isIn ? <ArrowUp size={14} color={tc.text} /> : isOut ? <ArrowDown size={14} color={tc.text} /> : <RotateCcw size={14} color={tc.text} />}
                  </View>
                  {i < filtered.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.borderLight }]} />}
                </View>
                <View style={[styles.timelineContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.timelineContentHeader}>
                    <Text style={[styles.movementProduct, { color: colors.text }]}>{productName}</Text>
                    <View style={[styles.timelineQtyBadge, { backgroundColor: tc.bg }]}>
                      <Text style={[styles.timelineQtyText, { color: tc.text }]}>{sm.quantity > 0 ? '+' : ''}{sm.quantity}</Text>
                    </View>
                  </View>
                  <Text style={[styles.movementMeta, { color: colors.textTertiary }]}>{TYPE_LABEL_MAP[sm.type] || sm.type} · {sm.reference}</Text>
                  <Text style={[styles.timelineDate, { color: colors.textTertiary }]}>{formatDate(sm.createdAt)}</Text>
                  {sm.notes ? <Text style={[styles.movementNotes, { color: colors.textSecondary }]}>{sm.notes}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}