/**
 * components/ventes/FacturesSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import {
  Search, Download, Bell, RefreshCw, CreditCard, Printer, X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import FormField from '@/components/FormField';
import PaymentReminderSheet from '@/components/PaymentReminderSheet';
import { generateInvoiceHTML, generateAndSharePDF } from '@/services/pdfService';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import type { Invoice, OrderItem } from '@/types';
import { styles } from './ventesStyles';

const INVOICE_PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces', icon: '💵' },
  { value: 'card', label: 'Carte bancaire', icon: '💳' },
  { value: 'bank_transfer', label: 'Virement', icon: 'VIR' },
  { value: 'check', label: 'Chèque', icon: 'CHQ' },
  { value: 'mobile_wave', label: 'Wave', icon: 'W' },
  { value: 'mobile_om', label: 'Orange Money', icon: 'OM' },
];

const STATUS_FILTERS = [
  { label: 'Tous', value: 'all' },
  { label: 'En attente de paiement', value: 'validated' },
  { label: 'Envoyée', value: 'sent' },
  { label: 'Payée', value: 'paid' },
  { label: 'En retard', value: 'late' },
  { label: 'Annulée', value: 'cancelled' },
];

export default function FacturesSection({ isMobile: _isMobile, highlightedId, onHighlightClear }: { isMobile: boolean; highlightedId?: string | null; onHighlightClear?: () => void }) {
  const { colors } = useTheme();
  const { invoices, recordPartialPayment, createCreditNote, company, activeClients, showToast, revertInvoiceStatus, updateInvoiceDueDate } = useData();
  const cur = company.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);
  const [_pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDueDays, setPaymentDueDays] = useState('');
  const [creditNoteModal, setCreditNoteModal] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedId && invoices.some((i) => i.id === highlightedId)) {
      setExpandedInvoiceId(highlightedId);
      onHighlightClear?.();
    }
  }, [highlightedId, invoices, onHighlightClear]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (search) { const q = search.toLowerCase(); list = list.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q)); }
    return list;
  }, [invoices, search, statusFilter]);

  const totalAmount = useMemo(() => invoices.reduce((s, i) => s + i.totalTTC, 0), [invoices]);
  const unpaidCount = useMemo(() => invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length, [invoices]);

  const handleGeneratePDF = useCallback(async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;
    setPdfLoading(invoiceId);
    try {
      const client = activeClients.find((c) => c.id === invoice.clientId);
      const html = generateInvoiceHTML(invoice, company, client);
      const success = await generateAndSharePDF(html, `Facture_${invoice.invoiceNumber || 'brouillon'}.pdf`);
      if (success) showToast('PDF généré avec succès');
      else showToast('Erreur lors de la génération du PDF', 'error');
    } catch { showToast('Erreur lors de la génération du PDF', 'error'); }
    finally { setPdfLoading(null); }
  }, [invoices, activeClients, company, showToast]);

  return (
    <>
      <View style={[styles.summaryBar, { backgroundColor: '#F0F9FF', borderColor: '#BFDBFE' }]}>
        <Text style={styles.summaryBarText}>
          Total : <Text style={styles.summaryBarBold}>{invoices.length} factures</Text> | <Text style={[styles.summaryBarBold, { color: '#1E40AF' }]}>{formatCurrency(totalAmount, cur)}</Text> | <Text style={[styles.summaryBarBold, { color: '#D97706' }]}>{unpaidCount} impayées</Text>
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Rechercher une facture..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => { const cols: ExportColumn<Record<string, unknown>>[] = [{ key: 'invoiceNumber', label: 'N° Facture' }, { key: 'clientName', label: 'Client' }, { key: 'status', label: 'Statut' }, { key: 'totalHT', label: 'Total HT' }, { key: 'totalTVA', label: 'TVA' }, { key: 'totalTTC', label: 'Total TTC' }, { key: 'paidAmount', label: 'Montant payé' }, { key: 'issueDate', label: 'Date émission' }, { key: 'dueDate', label: 'Date échéance' }]; void exportToCSV(invoices.map((inv) => ({ ...inv } as unknown as Record<string, unknown>)), cols, `factures_${new Date().toISOString().slice(0, 10)}.csv`); }}>
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity key={f.value} style={[styles.filterChip, { backgroundColor: statusFilter === f.value ? colors.primary : colors.card, borderColor: statusFilter === f.value ? colors.primary : colors.cardBorder }]} onPress={() => setStatusFilter(f.value)}>
            <Text style={[styles.filterChipText, { color: statusFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture pour l'instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Vos factures apparaîtront ici une fois créées</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((inv, i) => {
            const remaining = inv.totalTTC - (inv.paidAmount || 0);
            const isPartial = inv.paidAmount > 0 && inv.paidAmount < inv.totalTTC;
            return (
              <TouchableOpacity key={inv.id} style={[styles.listRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                onPress={() => {
                  if ((inv.status === 'validated' || inv.status === 'sent' || inv.status === 'late' || isPartial) && inv.status !== 'paid' && inv.status !== 'cancelled') {
                    setPaymentModal(inv.id); setPaymentAmount(String(remaining.toFixed(2))); setPaymentMethod('bank_transfer'); setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentDueDays('');
                  } else { setExpandedInvoiceId(inv.id); }
                }} activeOpacity={0.7}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{inv.invoiceNumber || 'Brouillon'}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{inv.clientName} · {formatDate(inv.issueDate)}</Text>
                    {isPartial && <View style={[styles.partialBanner, { backgroundColor: '#FEF3C7' }]}><Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' }}>Reste à payer : {formatCurrency(remaining, cur)}</Text></View>}
                  </View>
                  <StatusBadge status={isPartial ? 'partial' : inv.status} />
                  <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(inv.totalTTC, cur)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Modale paiement */}
      <FormModal
        visible={paymentModal !== null}
        onClose={() => setPaymentModal(null)}
        title="Paiement"
        subtitle={paymentModal ? (() => { const inv = invoices.find((i) => i.id === paymentModal); return inv ? `${inv.clientName} — ${inv.invoiceNumber || 'Brouillon'}` : ''; })() : ''}
        onSubmit={() => {
          if (!paymentModal) return;
          const amount = parseFloat(paymentAmount);
          if (isNaN(amount) || amount <= 0) { showToast('Montant invalide', 'error'); return; }
          const result = recordPartialPayment(paymentModal, amount, paymentMethod);
          if (result.success) {
            if (paymentDueDays) { const days = parseInt(paymentDueDays, 10); if (!isNaN(days) && days >= 0) updateInvoiceDueDate(paymentModal, days); }
            showToast('Paiement enregistré'); setPaymentModal(null);
          } else showToast(result.error || 'Erreur', 'error');
        }}
        submitLabel={`Valider le paiement — ${paymentAmount ? formatCurrency(parseFloat(paymentAmount) || 0, cur) : '0,00 €'}`}
        width={480}
      >
        {paymentModal ? (() => {
          const inv = invoices.find((i) => i.id === paymentModal);
          if (!inv) return null;
          const remaining = inv.totalTTC - (inv.paidAmount || 0);
          return (
            <>
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceHover, gap: 6, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Total TTC</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.primary }}>{formatCurrency(inv.totalTTC, cur)}</Text>
                </View>
                {inv.paidAmount > 0 && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' }}>Reste à payer</Text><Text style={{ fontSize: 15, color: '#92400E', fontWeight: '700' }}>{formatCurrency(remaining, cur)}</Text></View>}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>Mode de paiement</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {INVOICE_PAYMENT_METHODS.map((m) => {
                  const isActive = paymentMethod === m.value;
                  return (
                    <TouchableOpacity key={m.value} style={{ flex: 1, minWidth: 100, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: isActive ? colors.primary : colors.cardBorder, backgroundColor: isActive ? `${colors.primary}10` : colors.card, alignItems: 'center', gap: 4 }} onPress={() => setPaymentMethod(m.value)} activeOpacity={0.7}>
                      <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? colors.primary : colors.textSecondary, textAlign: 'center' }}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}><FormField label="Montant" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="0.00" keyboardType="decimal-pad" required /></View>
                <View style={{ flex: 1 }}><FormField label="Date de paiement" value={paymentDate} onChangeText={setPaymentDate} placeholder="AAAA-MM-JJ" /></View>
              </View>
              <FormField label="Modifier l'échéance (jours)" value={paymentDueDays} onChangeText={setPaymentDueDays} placeholder="Laisser vide pour ne pas changer" keyboardType="numeric" />
            </>
          );
        })() : null}
      </FormModal>

      {/* Modale détail facture */}
      {expandedInvoiceId && (() => {
        const inv = invoices.find((i) => i.id === expandedInvoiceId);
        if (!inv) return null;
        const remaining = inv.totalTTC - (inv.paidAmount || 0);
        const isPartial = inv.paidAmount > 0 && inv.paidAmount < inv.totalTTC;
        return (
          <FormModal visible onClose={() => setExpandedInvoiceId(null)} title={`Facture ${inv.invoiceNumber || 'Brouillon'}`} subtitle={`${inv.clientName} — ${formatCurrency(inv.totalTTC, cur)}`} showCancel={false} width={520}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <StatusBadge status={isPartial ? 'partial' : inv.status} />
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>Échéance : {formatDate(inv.dueDate)}</Text>
            </View>
            <View style={{ gap: 4, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text><Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalHT, cur)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text><Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalTVA, cur)}</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.borderLight }}><Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Total TTC</Text><Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>{formatCurrency(inv.totalTTC, cur)}</Text></View>
              {isPartial && <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' }}>Reste à payer</Text><Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' }}>{formatCurrency(remaining, cur)}</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {(inv.status === 'validated' || inv.status === 'sent' || inv.status === 'late' || inv.status === 'partial') && (
                <TouchableOpacity onPress={() => { const r = revertInvoiceStatus(inv.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}>
                  <RefreshCw size={13} color={colors.text} /><Text style={[styles.detailActionBtnText, { color: colors.text }]}>Statut précédent</Text>
                </TouchableOpacity>
              )}
              {(inv.status === 'validated' || inv.status === 'sent' || inv.status === 'late' || isPartial) && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => { setPaymentModal(inv.id); setPaymentAmount(String(remaining.toFixed(2))); setPaymentMethod('bank_transfer'); setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentDueDays(''); }, 100); }} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                  <CreditCard size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Payer</Text>
                </TouchableOpacity>
              )}
              {inv.status !== 'paid' && inv.status !== 'cancelled' && !inv.creditNoteId && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => setCreditNoteModal(inv.id), 100); }} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}>
                  <X size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Avoir</Text>
                </TouchableOpacity>
              )}
              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => setReminderInvoice(inv), 100); }} style={[styles.detailActionBtn, { backgroundColor: '#D97706' }]}>
                  <Bell size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Rappeler</Text>
                </TouchableOpacity>
              )}
              {inv.status !== 'cancelled' && (
                <TouchableOpacity onPress={() => { void handleGeneratePDF(inv.id); }} style={[styles.detailActionBtn, { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30' }]}>
                  <Printer size={13} color={colors.primary} /><Text style={[styles.detailActionBtnText, { color: colors.primary }]}>PDF</Text>
                </TouchableOpacity>
              )}
            </View>
          </FormModal>
        );
      })()}

      <ConfirmModal
        visible={creditNoteModal !== null}
        onClose={() => setCreditNoteModal(null)}
        onConfirm={() => {
          if (!creditNoteModal) return;
          const inv = invoices.find((i) => i.id === creditNoteModal);
          if (!inv) return;
          const items: OrderItem[] = inv.items.map((it) => ({ ...it }));
          const result = createCreditNote(creditNoteModal, items, 'Avoir sur facture ' + inv.invoiceNumber);
          if (result.success) showToast('Avoir créé');
          else showToast(result.error || 'Erreur', 'error');
          setCreditNoteModal(null);
        }}
        title="Créer un avoir ?"
        message="Un avoir total sera créé pour cette facture."
        confirmLabel="Créer l'avoir"
        destructive
      />

      <PaymentReminderSheet visible={reminderInvoice !== null} onClose={() => setReminderInvoice(null)} invoice={reminderInvoice} />
    </>
  );
}