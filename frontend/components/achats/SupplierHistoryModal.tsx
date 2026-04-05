/**
 * components/achats/SupplierHistoryModal.tsx
 * Timeline des événements liés à un fournisseur :
 * commandes, factures reçues, mouvements de trésorerie.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, ShoppingCart, FileText, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import type { Supplier } from '@/types';

interface SupplierHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  supplier: Supplier;
  purchaseOrders: any[];
  supplierInvoices: any[];
  cashMovements: any[];
  currency: string;
  onNavigate?: (route: string) => void;
}

export default function SupplierHistoryModal({
  visible, onClose, supplier, purchaseOrders, supplierInvoices, cashMovements, currency, onNavigate,
}: SupplierHistoryModalProps) {
  const { colors } = useTheme();

  const timeline = useMemo(() => {
    const events: Array<{ id: string; date: string; type: string; title: string; subtitle: string; amount?: number }> = [];

    purchaseOrders.filter((po) => po.supplierId === supplier.id).forEach((po) => {
      const statusLabel = po.status === 'received' ? 'Reçue' : po.status === 'sent' ? 'Envoyée' : po.status === 'draft' ? 'Brouillon' : po.status === 'cancelled' ? 'Annulée' : po.status;
      events.push({ id: `po-${po.id}`, date: po.date || po.createdAt, type: 'purchase_order', title: `Commande ${po.number}`, subtitle: statusLabel, amount: po.total });
    });

    supplierInvoices.filter((si) => si.supplierId === supplier.id).forEach((si) => {
      const statusLabel = si.status === 'paid' ? 'Payée' : si.status === 'to_pay' ? 'À payer' : si.status === 'received' ? 'Reçue' : si.status === 'late' ? 'En retard' : si.status;
      events.push({ id: `si-${si.id}`, date: si.date || si.createdAt, type: 'supplier_invoice', title: `Facture ${si.number}`, subtitle: statusLabel, amount: si.total });
    });

    cashMovements.filter((cm) => cm.description?.includes(supplier.companyName)).forEach((cm) => {
      events.push({ id: `cm-${cm.id}`, date: cm.date || cm.createdAt, type: 'payment', title: cm.type === 'expense' ? 'Paiement effectué' : 'Encaissement', subtitle: cm.description, amount: cm.amount });
    });

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplier, purchaseOrders, supplierInvoices, cashMovements]);

  const getEventColor = useCallback((type: string) => {
    switch (type) {
      case 'purchase_order': return colors.primary;
      case 'supplier_invoice': return '#D97706';
      case 'payment': return colors.success;
      default: return colors.textTertiary;
    }
  }, [colors]);

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={`Historique — ${supplier.companyName}`}
      subtitle={`${timeline.length} événement(s)`}
      showCancel={false}
      width={600}
    >
      {timeline.length === 0 ? (
        <View style={histStyles.empty}>
          <Clock size={32} color={colors.textTertiary} />
          <Text style={[histStyles.emptyText, { color: colors.textTertiary }]}>Aucun historique</Text>
        </View>
      ) : (
        <View style={histStyles.timeline}>
          {timeline.map((event, idx) => (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.6}
              onPress={() => {
                if (!onNavigate) return;
                switch (event.type) {
                  case 'purchase_order': onNavigate(`/achats?tab=commandes&selectedId=${event.id.replace('po-', '')}`); break;
                  case 'supplier_invoice': onNavigate(`/achats?tab=factures&selectedId=${event.id.replace('si-', '')}`); break;
                  case 'payment': onNavigate('/cashflow'); break;
                }
              }}
              style={[
                histStyles.eventRow,
                { borderBottomColor: colors.borderLight },
                idx % 2 === 0 && { backgroundColor: colors.background + '40' },
              ]}
            >
              <View style={[histStyles.eventDot, { backgroundColor: getEventColor(event.type) }]}>
                {event.type === 'purchase_order' ? <ShoppingCart size={12} color="#FFF" /> :
                 event.type === 'supplier_invoice' ? <FileText size={12} color="#FFF" /> :
                 <Check size={12} color="#FFF" />}
              </View>
              <View style={histStyles.eventInfo}>
                <Text style={[histStyles.eventTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
                <Text style={[histStyles.eventSub, { color: colors.textSecondary }]}>{event.subtitle}</Text>
              </View>
              <View style={histStyles.eventRight}>
                {event.amount !== undefined && (
                  <Text style={[histStyles.eventAmount, { color: colors.text }]}>
                    {formatCurrency(event.amount, currency)}
                  </Text>
                )}
                <Text style={[histStyles.eventDate, { color: colors.textTertiary }]}>{formatDate(event.date)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </FormModal>
  );
}

const histStyles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14 },
  timeline: { gap: 0 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, gap: 12 },
  eventDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600' },
  eventSub: { fontSize: 11, marginTop: 1 },
  eventRight: { alignItems: 'flex-end' },
  eventAmount: { fontSize: 13, fontWeight: '600' },
  eventDate: { fontSize: 11, marginTop: 1 },
});