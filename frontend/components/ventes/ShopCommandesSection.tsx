/**
 * components/ventes/ShopCommandesSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Send, Ban, ChevronRight, Globe, Truck, CreditCard } from 'lucide-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { shopDb } from '@/services/shopService';
import EmptyState from '@/components/EmptyState';
import { ShoppingCart } from 'lucide-react-native';
import { styles as sharedStyles } from './ventesStyles';
import type { ShopOrder, ShopOrderStatus, ShopOrderItem } from '@/types';

const ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const ORDER_STATUS_COLORS: Record<ShopOrderStatus, string> = {
  en_attente: '#D97706',
  confirmee: '#2563EB',
  livree: '#059669',
  annulee: '#DC2626',
};

const getNextStatus = (current: ShopOrderStatus): ShopOrderStatus | null => {
  const flow: Record<string, ShopOrderStatus> = { en_attente: 'confirmee', confirmee: 'livree' };
  return flow[current] || null;
};

const nextStatusLabels: Record<string, string> = {
  confirmee: 'Confirmer la commande',
  livree: 'Marquer livrée',
};

export default function ShopCommandesSection({
  orders, companyId, currency, isLoading,
}: { orders: ShopOrder[]; companyId: string; currency: string; isLoading: boolean }) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ShopOrderStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => filter === 'all' ? orders : orders.filter((o) => o.status === filter), [orders, filter]);
  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId), [orders, selectedOrderId]);

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => { await shopDb.updateShopOrderStatus(orderId, status); },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['shop-orders', companyId] }); showToast('Statut mis à jour'); },
    onError: () => showToast('Erreur', 'error'),
  });

  const filterOptions: { key: ShopOrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Toutes' }, { key: 'en_attente', label: 'En attente' },
    { key: 'confirmee', label: 'Confirmées' }, { key: 'livree', label: 'Livrées' }, { key: 'annulee', label: 'Annulées' },
  ];

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color={colors.primary} /></View>;

  if (selectedOrder) {
    const next = getNextStatus(selectedOrder.status);
    return (
      <View style={{ gap: 16 }}>
        <TouchableOpacity onPress={() => setSelectedOrderId(null)}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>← Retour aux commandes</Text>
        </TouchableOpacity>
        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={cmdStyles.orderDetailHeader}>
            <Text style={[cmdStyles.orderNumber, { color: colors.text }]}>{selectedOrder.orderNumber}</Text>
            <View style={[cmdStyles.statusPill, { backgroundColor: ORDER_STATUS_COLORS[selectedOrder.status] + '20' }]}>
              <Text style={[cmdStyles.statusPillText, { color: ORDER_STATUS_COLORS[selectedOrder.status] }]}>{ORDER_STATUS_LABELS[selectedOrder.status]}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[cmdStyles.sectionTitle, { color: colors.textSecondary }]}>CLIENT</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{selectedOrder.customerFirstName} {selectedOrder.customerLastName}</Text>
          <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerEmail}</Text>
          {selectedOrder.customerPhone ? <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerPhone}</Text> : null}
          {selectedOrder.customerAddress ? <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerAddress}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={[cmdStyles.infoPill, { backgroundColor: colors.primaryLight }]}><Truck size={12} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: '500', color: colors.primary }}>{selectedOrder.deliveryMode === 'pickup' ? 'Retrait' : 'Livraison'}</Text></View>
            <View style={[cmdStyles.infoPill, { backgroundColor: colors.primaryLight }]}><CreditCard size={12} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: '500', color: colors.primary }}>{selectedOrder.paymentMethod}</Text></View>
          </View>
        </View>
        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[cmdStyles.sectionTitle, { color: colors.textSecondary }]}>ARTICLES</Text>
          {selectedOrder.items.map((item: ShopOrderItem) => (
            <View key={item.id} style={[cmdStyles.orderItemRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{item.productName}</Text>
                {Object.keys(item.variantInfo).length > 0 && <Text style={{ fontSize: 11, color: colors.textTertiary }}>{Object.entries(item.variantInfo).map(([k, v]) => `${k}: ${v}`).join(', ')}</Text>}
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>×{item.quantity}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{(item.totalPrice ?? 0).toFixed(2)} {currency}</Text>
            </View>
          ))}
          <View style={[cmdStyles.totalSection, { borderTopColor: colors.border }]}>
            <View style={cmdStyles.totalRow}><Text style={{ fontSize: 13, color: colors.textSecondary }}>Sous-total HT</Text><Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.subtotalHt ?? 0).toFixed(2)} {currency}</Text></View>
            <View style={cmdStyles.totalRow}><Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text><Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.tvaAmount ?? 0).toFixed(2)} {currency}</Text></View>
            {(selectedOrder.shippingCost ?? 0) > 0 && <View style={cmdStyles.totalRow}><Text style={{ fontSize: 13, color: colors.textSecondary }}>Livraison</Text><Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.shippingCost ?? 0).toFixed(2)} {currency}</Text></View>}
            <View style={[cmdStyles.totalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' }]}><Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Total TTC</Text><Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{(selectedOrder.totalTtc ?? 0).toFixed(2)} {currency}</Text></View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {next && selectedOrder.status !== 'annulee' && selectedOrder.status !== 'livree' && (
            <TouchableOpacity style={[cmdStyles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => statusMutation.mutate({ orderId: selectedOrder.id, status: next })} disabled={statusMutation.isPending}>
              <Send size={14} color="#FFF" /><Text style={cmdStyles.actionBtnText}>{nextStatusLabels[next]}</Text>
            </TouchableOpacity>
          )}
          {selectedOrder.status !== 'annulee' && selectedOrder.status !== 'livree' && (
            <TouchableOpacity style={[cmdStyles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => statusMutation.mutate({ orderId: selectedOrder.id, status: 'annulee' })} disabled={statusMutation.isPending}>
              <Ban size={14} color="#FFF" /><Text style={cmdStyles.actionBtnText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {filterOptions.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[sharedStyles.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.cardBorder }]} onPress={() => setFilter(f.key)}>
              <Text style={[sharedStyles.filterChipText, { color: active ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={32} color={colors.textTertiary} />} title="Aucune commande" subtitle="Les commandes de votre boutique en ligne apparaîtront ici" />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((order) => (
            <TouchableOpacity key={order.id} style={[cmdStyles.orderRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setSelectedOrderId(order.id)}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{order.orderNumber}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#8B5CF620' }}>
                    <Globe size={10} color="#8B5CF6" /><Text style={{ fontSize: 10, fontWeight: '600', color: '#8B5CF6' }}>En ligne</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{order.customerFirstName} {order.customerLastName}</Text>
                <Text style={{ fontSize: 11, marginTop: 2, color: colors.textTertiary }}>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{(order.totalTtc ?? 0).toFixed(2)} {currency}</Text>
                <View style={[cmdStyles.statusPill, { backgroundColor: ORDER_STATUS_COLORS[order.status] + '20' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: ORDER_STATUS_COLORS[order.status] }}>{ORDER_STATUS_LABELS[order.status]}</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const cmdStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  orderDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 18, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  totalSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  orderRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
});