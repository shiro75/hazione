/**
 * components/ventes/AvoirsSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, Check, CreditCard } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import { styles } from './ventesStyles';

export default function AvoirsSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { creditNotes, company, showToast } = useData();
  const { user } = useAuth();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const cur = company.currency || 'EUR';
  const [expandedCnId, setExpandedCnId] = useState<string | null>(null);
  const [cnPayments, setCnPayments] = useState<Array<{ id: string; creditNoteId: string; amount: number; date: string; note: string }>>([]);
  const [paymentModalCnId, setPaymentModalCnId] = useState<string | null>(null);
  const [cnPaymentAmount, setCnPaymentAmount] = useState('');
  const [cnPaymentNote, setCnPaymentNote] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(`credit-note-payments-${COMPANY_ID}`).then((stored) => {
      if (stored) setCnPayments(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const addCnPayment = useCallback((creditNoteId: string, amount: number, note: string) => {
    const cn = creditNotes.find((c) => c.id === creditNoteId);
    if (!cn) return;
    const totalPaid = cnPayments.filter((p) => p.creditNoteId === creditNoteId).reduce((s, p) => s + p.amount, 0);
    const cnRem = cn.totalTTC - totalPaid;
    if (amount > cnRem + 0.01) { showToast(`Le montant dépasse le solde restant (${cnRem.toFixed(2)})`, 'error'); return; }
    const newPmt = { id: `cnp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, creditNoteId, amount, date: new Date().toISOString(), note };
    const updated = [newPmt, ...cnPayments];
    setCnPayments(updated);
    void AsyncStorage.setItem(`credit-note-payments-${COMPANY_ID}`, JSON.stringify(updated));
    const newTotalPaid = totalPaid + amount;
    if (Math.abs(newTotalPaid - cn.totalTTC) < 0.01) showToast(`Avoir ${cn.creditNoteNumber} clôturé`);
    else showToast(`Paiement de ${amount.toFixed(2)} enregistré sur avoir ${cn.creditNoteNumber}`);
  }, [cnPayments, creditNotes, showToast, COMPANY_ID]);

  const getCnPaidAmount = useCallback((id: string) => cnPayments.filter((p) => p.creditNoteId === id).reduce((s, p) => s + p.amount, 0), [cnPayments]);
  const getCnPaymentsList = useCallback((id: string) => cnPayments.filter((p) => p.creditNoteId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [cnPayments]);

  return (
    <View testID="avoirs-section">
      {creditNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun avoir pour l'instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les avoirs sont créés depuis l'onglet Factures</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {creditNotes.map((cn, i) => {
            const paidAmount = getCnPaidAmount(cn.id);
            const cnRemaining = cn.totalTTC - paidAmount;
            const isClosed = cnRemaining < 0.01;
            const isExpanded = expandedCnId === cn.id;
            const payments = getCnPaymentsList(cn.id);
            return (
              <View key={cn.id}>
                <TouchableOpacity style={[styles.listRow, i < creditNotes.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => setExpandedCnId(isExpanded ? null : cn.id)} activeOpacity={0.7}>
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{cn.creditNoteNumber}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{cn.clientName} · Facture {cn.invoiceNumber} · {formatDate(cn.issueDate)}</Text>
                    </View>
                    <View style={[styles.convertedBadge, { backgroundColor: isClosed ? colors.successLight : colors.dangerLight }]}>
                      <Text style={[styles.convertedBadgeText, { color: isClosed ? colors.success : colors.danger }]}>{isClosed ? 'Clôturé' : 'Avoir'}</Text>
                    </View>
                    <Text style={[styles.listRowValue, { color: colors.danger }]}>-{formatCurrency(cn.totalTTC, cur)}</Text>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Total avoir</Text><Text style={[styles.detailValue, { color: colors.danger }]}>-{formatCurrency(cn.totalTTC, cur)}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Réglé</Text><Text style={[styles.detailValue, { color: colors.success }]}>{formatCurrency(paidAmount, cur)}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Reste</Text><Text style={[styles.detailValue, { color: cnRemaining > 0 ? colors.warning : colors.success, fontWeight: '700' }]}>{formatCurrency(cnRemaining, cur)}</Text></View>
                    </View>
                    {cn.reason ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>Motif : {cn.reason}</Text> : null}
                    {payments.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>HISTORIQUE DES RÈGLEMENTS</Text>
                        {payments.map((p) => (
                          <View key={p.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[styles.detailLineName, { color: colors.text }]}>{formatCurrency(p.amount, cur)}</Text>
                            <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{formatDate(p.date)}{p.note ? ` - ${p.note}` : ''}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    {!isClosed && (
                      <View style={styles.detailActions}>
                        <TouchableOpacity onPress={() => { setPaymentModalCnId(cn.id); setCnPaymentAmount(String(cnRemaining.toFixed(2))); setCnPaymentNote(''); }} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                          <CreditCard size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Règlement partiel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => addCnPayment(cn.id, cnRemaining, 'Clôture complète')} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}>
                          <Check size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Clôturer</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      <FormModal visible={paymentModalCnId !== null} onClose={() => setPaymentModalCnId(null)} title="Règlement d'avoir" subtitle="Enregistrer un paiement partiel ou total" onSubmit={() => { if (!paymentModalCnId) return; const amount = parseFloat(cnPaymentAmount); if (isNaN(amount) || amount <= 0) { showToast('Montant invalide', 'error'); return; } addCnPayment(paymentModalCnId, amount, cnPaymentNote); setPaymentModalCnId(null); }} submitLabel="Enregistrer">
        <FormField label="Montant" value={cnPaymentAmount} onChangeText={setCnPaymentAmount} placeholder="0.00" keyboardType="decimal-pad" required />
        <FormField label="Note (optionnel)" value={cnPaymentNote} onChangeText={setCnPaymentNote} placeholder="Ex: Chèque n1234" />
      </FormModal>
    </View>
  );
}