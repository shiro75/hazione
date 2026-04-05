/**
 * components/ventes/BonsLivraisonSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Truck, ChevronDown, ChevronUp, Send, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatDate } from '@/utils/format';
import { styles } from './ventesStyles';

export default function BonsLivraisonSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { deliveryNotes, updateDeliveryNoteStatus, showToast, activeClients } = useData();
  const [expandedDnId, setExpandedDnId] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'preparation': return 'En préparation';
      case 'shipped': return 'Expédié';
      case 'delivered': return 'Livré';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparation': return { bg: colors.warningLight, text: colors.warning };
      case 'shipped': return { bg: colors.primaryLight, text: colors.primary };
      case 'delivered': return { bg: colors.successLight, text: colors.success };
      default: return { bg: colors.primaryLight, text: colors.primary };
    }
  };

  const handleStatusChange = useCallback((id: string, newStatus: 'preparation' | 'shipped' | 'delivered') => {
    const result = updateDeliveryNoteStatus(id, newStatus);
    if (result.success) showToast(`Statut mis à jour : ${getStatusLabel(newStatus)}`);
    else showToast(result.error || 'Erreur', 'error');
  }, [updateDeliveryNoteStatus, showToast]);

  return (
    <View testID="livraisons-section">
      {deliveryNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Truck size={28} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun bon de livraison</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez un BL depuis l'onglet Factures</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {deliveryNotes.map((dn, i) => {
            const sc = getStatusColor(dn.status);
            const isExpanded = expandedDnId === dn.id;
            const client = activeClients.find((c) => c.id === dn.clientId);
            return (
              <View key={dn.id}>
                <TouchableOpacity style={[styles.listRow, i < deliveryNotes.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => setExpandedDnId(isExpanded ? null : dn.id)} activeOpacity={0.7}>
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{dn.deliveryNumber}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{dn.clientName} · Facture {dn.invoiceNumber} · {formatDate(dn.createdAt)}</Text>
                    </View>
                    <View style={[styles.convertedBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.convertedBadgeText, { color: sc.text }]}>{getStatusLabel(dn.status)}</Text>
                    </View>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Client</Text><Text style={[styles.detailValue, { color: colors.text }]}>{dn.clientName}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Facture</Text><Text style={[styles.detailValue, { color: colors.text }]}>{dn.invoiceNumber}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date création</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.createdAt)}</Text></View>
                    </View>
                    {client?.address ? <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Adresse de livraison</Text><Text style={[styles.detailValue, { color: colors.text }]}>{client.address}{client.city ? `, ${client.postalCode} ${client.city}` : ''}</Text></View> : null}
                    {dn.shippedAt ? <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Expédié le</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.shippedAt)}</Text></View> : null}
                    {dn.deliveredAt ? <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Livré le</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.deliveredAt)}</Text></View> : null}
                    {dn.items && dn.items.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>ARTICLES</Text>
                        {dn.items.map((item) => (
                          <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[styles.detailLineName, { color: colors.text }]}>{item.productName}</Text>
                            <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{item.quantity} unité(s)</Text>
                          </View>
                        ))}
                      </>
                    )}
                    {dn.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{dn.notes}</Text> : null}
                    <View style={styles.detailActions}>
                      {dn.status === 'preparation' && (
                        <TouchableOpacity onPress={() => handleStatusChange(dn.id, 'shipped')} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}>
                          <Send size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Expédier</Text>
                        </TouchableOpacity>
                      )}
                      {dn.status === 'shipped' && (
                        <TouchableOpacity onPress={() => handleStatusChange(dn.id, 'delivered')} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                          <Check size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Livré</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}