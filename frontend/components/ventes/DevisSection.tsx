/**
 * components/ventes/DevisSection.tsx
 *
 * Section Devis de l'écran Ventes.
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import {
  Search, Plus, ClipboardList, ArrowUpDown, X, Trash2, Send, Check,
  Mail, ChevronDown, ChevronUp, Ban, Truck, Upload, Download,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import ClientPicker from '@/components/ClientPicker';
import LineItemsEditor, { type LineItem } from '@/components/LineItemsEditor';
import TotalsSummary from '@/components/TotalsSummary';
import FormField from '@/components/FormField';
import UniversalImportModal from '@/components/UniversalImportModal';
import { sendEmail, buildQuoteEmailBody } from '@/services/emailService';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import type { QuoteItem } from '@/types';
import { styles } from './ventesStyles';

type DevisSortKey = 'date' | 'amount' | 'status' | 'client';
const DEVIS_SORT_OPTIONS: { value: DevisSortKey; label: string }[] = [
  { value: 'date', label: 'Date' }, { value: 'amount', label: 'Montant' },
  { value: 'status', label: 'Statut' }, { value: 'client', label: 'Client A→Z' },
];

export default function DevisSection({ isMobile: _isMobile, highlightedId, onHighlightClear }: { isMobile: boolean; highlightedId?: string | null; onHighlightClear?: () => void }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const DEVIS_COMPANY_ID = authUser?.id ?? 'anonymous';
  const {
    quotes, activeClients, sendQuote, acceptQuote, refuseQuote, convertQuoteToInvoice,
    createQuote, updateQuote, deleteQuote, cancelQuote, showToast, sendQuoteByEmail,
    company, duplicateQuote, createDeliveryNoteFromQuote,
  } = useData();
  const cur = company.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<DevisSortKey>('date');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedId && quotes.some((q) => q.id === highlightedId)) {
      setSelectedQuoteId(highlightedId);
      onHighlightClear?.();
    }
  }, [highlightedId, quotes, onHighlightClear]);

  // ── Formulaire création ────────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [formClientId, setFormClientId] = useState('');
  const [formItems, setFormItems] = useState<LineItem[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formDelivery, setFormDelivery] = useState(false);
  const [formDeliveryPrice, setFormDeliveryPrice] = useState('15');
  const [formDeliveryAddress, setFormDeliveryAddress] = useState('');
  const [formGlobalDiscount, setFormGlobalDiscount] = useState('');

  // ── Formulaire édition ─────────────────────────────────────────────────────
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editFormClientId, setEditFormClientId] = useState('');
  const [editFormItems, setEditFormItems] = useState<LineItem[]>([]);
  const [editFormNotes, setEditFormNotes] = useState('');
  const [editFormError, setEditFormError] = useState('');

  // ── Email ──────────────────────────────────────────────────────────────────
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailQuoteId, setEmailQuoteId] = useState<string | null>(null);

  // ── Confirmations ──────────────────────────────────────────────────────────
  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [devisCsvVisible, setDevisCsvVisible] = useState(false);

  const filtered = useMemo(() => {
    let list = quotes;
    if (search) { const q = search.toLowerCase(); list = list.filter((qt) => qt.quoteNumber.toLowerCase().includes(q) || qt.clientName.toLowerCase().includes(q)); }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date': return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
        case 'amount': return b.totalTTC - a.totalTTC;
        case 'status': return a.status.localeCompare(b.status);
        case 'client': return a.clientName.localeCompare(b.clientName);
        default: return 0;
      }
    });
  }, [quotes, search, sortBy]);

  const openCreate = useCallback(() => {
    setFormClientId(''); setFormItems([]); setFormNotes(''); setFormError('');
    setFormDelivery(false); setFormDeliveryPrice('15'); setFormDeliveryAddress(''); setFormGlobalDiscount('');
    setFormVisible(true);
  }, []);

  const handleClientChange = useCallback((clientId: string) => {
    setFormClientId(clientId);
    const client = activeClients.find((c) => c.id === clientId);
    if (client?.address) setFormDeliveryAddress(`${client.address}${client.postalCode ? ', ' + client.postalCode : ''}${client.city ? ' ' + client.city : ''}`);
    else setFormDeliveryAddress('');
    if (client?.discountPercent && formItems.length > 0) {
      const disc = client.discountPercent || 0;
      setFormItems(formItems.map((item) => { const baseHT = item.unitPrice * item.quantity; const totalHT = baseHT * (1 - disc / 100); const totalTVA = totalHT * (item.vatRate / 100); return { ...item, discount: disc, totalHT, totalTVA, totalTTC: totalHT + totalTVA }; }));
    }
  }, [activeClients, formItems]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Veuillez sélectionner un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }
    if (formDelivery && !formDeliveryAddress.trim()) { setFormError('L\'adresse de livraison est requise'); return; }
    const quoteItems: QuoteItem[] = formItems.map((li) => ({ id: li.id, quoteId: '', productId: li.productId, productName: li.productName, quantity: li.quantity, unitPrice: li.unitPrice, vatRate: li.vatRate, totalHT: li.totalHT, totalTVA: li.totalTVA, totalTTC: li.totalTTC }));
    let notes = formNotes;
    if (formDelivery) { const deliveryPrice = parseFloat(formDeliveryPrice) || 0; notes = `${notes ? notes + '\n' : ''}Livraison : ${deliveryPrice.toFixed(2)} ${cur}\nAdresse de livraison : ${formDeliveryAddress.trim()}`; }
    if (formGlobalDiscount) notes = `${notes ? notes + '\n' : ''}Remise globale : ${formGlobalDiscount}%`;
    const result = createQuote(formClientId, quoteItems, 30, notes);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    if (formDelivery && result.quoteId) {
      const client = activeClients.find((c) => c.id === formClientId);
      const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : '';
      const allQuotes = queryClient.getQueryData<import('@/types').Quote[]>(['quotes', DEVIS_COMPANY_ID]) ?? quotes;
      const createdQuote = allQuotes.find((q) => q.id === result.quoteId);
      createDeliveryNoteFromQuote({ quoteId: result.quoteId, quoteNumber: createdQuote?.quoteNumber || '', clientId: formClientId, clientName, items: quoteItems.map((qi) => ({ id: qi.id, orderId: '', productId: qi.productId, productName: qi.productName, quantity: qi.quantity, unitPrice: qi.unitPrice, vatRate: qi.vatRate, totalHT: qi.totalHT, totalTVA: qi.totalTVA, totalTTC: qi.totalTTC })), deliveryAddress: formDeliveryAddress.trim() });
    }
    setFormVisible(false);
  }, [formClientId, formItems, formNotes, formDelivery, formDeliveryPrice, formDeliveryAddress, formGlobalDiscount, createQuote, cur, activeClients, createDeliveryNoteFromQuote, queryClient, DEVIS_COMPANY_ID, quotes]);

  const openEditQuote = useCallback((quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt || qt.status !== 'draft') return;
    setEditingQuoteId(quoteId);
    setEditFormClientId(qt.clientId);
    setEditFormItems(qt.items.map((item) => ({ id: item.id, productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, vatRate: item.vatRate, totalHT: item.totalHT, totalTVA: item.totalTVA, totalTTC: item.totalTTC })));
    setEditFormNotes(qt.notes || '');
    setEditFormError('');
  }, [quotes]);

  const handleEditSubmit = useCallback(() => {
    if (!editingQuoteId || !editFormClientId) { setEditFormError('Veuillez sélectionner un client'); return; }
    if (editFormItems.length === 0) { setEditFormError('Ajoutez au moins une ligne'); return; }
    const client = activeClients.find((c) => c.id === editFormClientId);
    const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : '';
    const quoteItems: QuoteItem[] = editFormItems.map((li) => ({ id: li.id, quoteId: editingQuoteId, productId: li.productId, productName: li.productName, quantity: li.quantity, unitPrice: li.unitPrice, vatRate: li.vatRate, totalHT: li.totalHT, totalTVA: li.totalTVA, totalTTC: li.totalTTC }));
    const result = updateQuote(editingQuoteId, { clientId: editFormClientId, clientName, items: quoteItems, notes: editFormNotes });
    if (!result.success) { setEditFormError(result.error || 'Erreur'); return; }
    setEditingQuoteId(null);
  }, [editingQuoteId, editFormClientId, editFormItems, editFormNotes, activeClients, updateQuote]);

  const handleOpenQuoteEmail = useCallback((quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt) return;
    const client = activeClients.find((c) => c.id === qt.clientId);
    const { subject, body } = buildQuoteEmailBody({ companyName: company.name, clientName: qt.clientName, quoteNumber: qt.quoteNumber, totalTTC: qt.totalTTC, expirationDate: qt.expirationDate, currency: company.currency || 'EUR' });
    setEmailTo(client?.email || ''); setEmailSubject(subject); setEmailBody(body); setEmailQuoteId(quoteId); setEmailModalVisible(true);
  }, [quotes, activeClients, company]);

  const handleSendQuoteEmail = useCallback(async () => {
    if (!emailTo) { showToast('Email destinataire requis', 'error'); return; }
    const success = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    if (success) { if (emailQuoteId) sendQuoteByEmail(emailQuoteId); showToast('Email envoyé avec succès'); }
    else showToast('Impossible d\'ouvrir le client mail', 'error');
    setEmailModalVisible(false);
  }, [emailTo, emailSubject, emailBody, emailQuoteId, showToast, sendQuoteByEmail]);

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Rechercher un devis..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setDevisCsvVisible(true)}><Upload size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => { const cols: ExportColumn<Record<string, unknown>>[] = [{ key: 'quoteNumber', label: 'N° Devis' }, { key: 'clientName', label: 'Client' }, { key: 'status', label: 'Statut' }, { key: 'totalHT', label: 'Total HT' }, { key: 'totalTVA', label: 'TVA' }, { key: 'totalTTC', label: 'Total TTC' }, { key: 'issueDate', label: 'Date émission' }, { key: 'expirationDate', label: 'Date expiration' }]; void exportToCSV(quotes.map((q) => ({ ...q } as unknown as Record<string, unknown>)), cols, `devis_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.primary }]} onPress={openCreate}><Plus size={16} color="#FFF" /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {DEVIS_SORT_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><ClipboardList size={28} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun devis pour l'instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez votre premier devis pour démarrer</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openCreate}><Plus size={14} color="#FFF" /><Text style={styles.emptyBtnText}>Créer un devis</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((quote, i) => (
            <View key={quote.id}>
              <TouchableOpacity style={[styles.listRow, i < filtered.length - 1 && !selectedQuoteId && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => setSelectedQuoteId(selectedQuoteId === quote.id ? null : quote.id)} activeOpacity={0.7}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{quote.quoteNumber || 'Brouillon'}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{quote.clientName} · {formatDate(quote.issueDate)}</Text>
                  </View>
                  <StatusBadge status={quote.status} />
                  <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(quote.totalTTC, cur)}</Text>
                  <View style={styles.listRowActions}>
                    {quote.convertedToInvoiceId ? <View style={[styles.convertedBadge, { backgroundColor: colors.successLight }]}><Check size={11} color={colors.success} /><Text style={[styles.convertedBadgeText, { color: colors.success }]}>Facturé</Text></View> : null}
                    {selectedQuoteId === quote.id ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </View>
              </TouchableOpacity>

              {selectedQuoteId === quote.id && (
                <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={styles.detailHeader}>
                    <Text style={[styles.detailHeaderTitle, { color: colors.text }]}>Détail du devis</Text>
                    <StatusBadge status={quote.status} />
                  </View>
                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Client</Text><Text style={[styles.detailValue, { color: colors.text }]}>{quote.clientName}</Text></View>
                    <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(quote.issueDate)}</Text></View>
                    <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Validité</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(quote.expirationDate)}</Text></View>
                  </View>
                  <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
                  {quote.items.map((item) => (
                    <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                      <Text style={[styles.detailLineName, { color: colors.text }]}>{item.productName}</Text>
                      <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{item.quantity} × {formatCurrency(item.unitPrice, cur)} HT · TVA {item.vatRate}%</Text>
                      <Text style={[styles.detailLineTotal, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                    </View>
                  ))}
                  {quote.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{quote.notes}</Text> : null}
                  <View style={styles.detailActions}>
                    {quote.status === 'draft' && (
                      <>
                        <TouchableOpacity onPress={() => openEditQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}><X size={13} color={colors.text} /><Text style={[styles.detailActionBtnText, { color: colors.text }]}>Modifier</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setDeleteConfirm(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger + '30' }]}><Trash2 size={13} color={colors.danger} /><Text style={[styles.detailActionBtnText, { color: colors.danger }]}>Supprimer</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => sendQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}><Send size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Envoyer</Text></TouchableOpacity>
                      </>
                    )}
                    {quote.status === 'sent' && (
                      <>
                        <TouchableOpacity onPress={() => acceptQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}><Check size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Accepter</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => refuseQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}><X size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Refuser</Text></TouchableOpacity>
                      </>
                    )}
                    {quote.status === 'accepted' && (
                      <TouchableOpacity onPress={() => { const r = cancelQuote(quote.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}><Ban size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Annuler</Text></TouchableOpacity>
                    )}
                    {quote.status !== 'accepted' && quote.status !== 'cancelled' && (
                      <TouchableOpacity onPress={() => handleOpenQuoteEmail(quote.id)} style={[styles.detailActionBtn, { backgroundColor: '#0369A1' }]}><Mail size={13} color="#FFF" /><Text style={styles.detailActionBtnText}>Email</Text></TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => duplicateQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}><ClipboardList size={13} color={colors.text} /><Text style={[styles.detailActionBtnText, { color: colors.text }]}>Dupliquer</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Formulaire création */}
      <FormModal visible={formVisible} onClose={() => setFormVisible(false)} title="Nouveau devis" subtitle="Créez un devis pour un client" onSubmit={handleSubmit} submitLabel="Créer le devis" width={600}>
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        <ClientPicker selectedClientId={formClientId} onSelect={handleClientChange} required showQuickAdd />
        {formClientId ? (() => { const selectedClient = activeClients.find((c) => c.id === formClientId); if (selectedClient?.discountPercent) return <View style={[styles.discountBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}><Text style={{ fontSize: 12, color: '#166534' }}>Remise client : {selectedClient.discountPercent}%</Text></View>; return null; })() : null}
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE DEVIS</Text>
          <LineItemsEditor items={formItems} onItemsChange={setFormItems} idPrefix="qi" showDiscount allowedProductTypes={SALES_ALLOWED_TYPES} defaultDiscount={(() => { const cl = activeClients.find((c) => c.id === formClientId); return cl?.discountPercent || 0; })()} />
          <TotalsSummary items={formItems} compact />
        </View>
        <FormField label="Remise sur total (%)" value={formGlobalDiscount} onChangeText={setFormGlobalDiscount} placeholder="Ex: 5" keyboardType="decimal-pad" />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIVRAISON</Text>
          <TouchableOpacity style={[styles.deliveryToggle, { backgroundColor: formDelivery ? '#EFF6FF' : colors.card, borderColor: formDelivery ? '#3B82F6' : colors.cardBorder }]} onPress={() => setFormDelivery(!formDelivery)} activeOpacity={0.7}>
            <Truck size={16} color={formDelivery ? '#3B82F6' : colors.textTertiary} />
            <Text style={{ flex: 1, fontSize: 14, color: formDelivery ? '#1E40AF' : colors.text }}>Inclure la livraison</Text>
            {formDelivery ? <Check size={16} color="#3B82F6" /> : null}
          </TouchableOpacity>
          {formDelivery ? (
            <>
              <FormField label="Prix de livraison" value={formDeliveryPrice} onChangeText={setFormDeliveryPrice} placeholder="15.00" keyboardType="decimal-pad" />
              <FormField label="Adresse de livraison" value={formDeliveryAddress} onChangeText={setFormDeliveryAddress} placeholder="Adresse complète de livraison" required multiline numberOfLines={2} />
            </>
          ) : null}
        </View>
        <FormField label="Notes" value={formNotes} onChangeText={setFormNotes} placeholder="Notes internes ou conditions..." multiline numberOfLines={3} />
      </FormModal>

      {/* Formulaire édition */}
      <FormModal visible={editingQuoteId !== null} onClose={() => setEditingQuoteId(null)} title="Modifier le devis" subtitle="Modifiez les informations du devis" onSubmit={handleEditSubmit} submitLabel="Mettre à jour" width={600}>
        {editFormError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{editFormError}</Text></View> : null}
        <ClientPicker selectedClientId={editFormClientId} onSelect={setEditFormClientId} required />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE DEVIS</Text>
          <LineItemsEditor items={editFormItems} onItemsChange={setEditFormItems} idPrefix="qi" showDiscount allowedProductTypes={SALES_ALLOWED_TYPES} />
          <TotalsSummary items={editFormItems} compact />
        </View>
        <FormField label="Notes" value={editFormNotes} onChangeText={setEditFormNotes} placeholder="Notes internes ou conditions..." multiline numberOfLines={3} />
      </FormModal>

      {/* Email devis */}
      <FormModal visible={emailModalVisible} onClose={() => setEmailModalVisible(false)} title="Envoyer le devis par email" subtitle="Le devis sera envoyé au client" onSubmit={handleSendQuoteEmail} submitLabel="Envoyer">
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Destinataire</Text><TextInput style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailTo} onChangeText={setEmailTo} placeholder="email@exemple.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" /></View>
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Objet</Text><TextInput style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailSubject} onChangeText={setEmailSubject} /></View>
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Message</Text><TextInput style={[styles.emailFieldInput, styles.emailBodyField, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailBody} onChangeText={setEmailBody} multiline numberOfLines={8} textAlignVertical="top" /></View>
      </FormModal>

      <ConfirmModal visible={convertConfirm !== null} onClose={() => setConvertConfirm(null)} onConfirm={() => { if (!convertConfirm) return; const r = convertQuoteToInvoice(convertConfirm); if (!r.success) showToast(r.error || 'Erreur', 'error'); setConvertConfirm(null); }} title="Convertir en facture ?" message="Les lignes du devis seront dupliquées dans une nouvelle facture brouillon." confirmLabel="Convertir" />
      <ConfirmModal visible={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} onConfirm={() => { if (!deleteConfirm) return; deleteQuote(deleteConfirm); setDeleteConfirm(null); setSelectedQuoteId(null); }} title="Supprimer ce devis ?" message="Le devis sera définitivement supprimé. Cette action est irréversible." confirmLabel="Supprimer" destructive />

      <UniversalImportModal
        visible={devisCsvVisible}
        onClose={() => setDevisCsvVisible(false)}
        title="Importer des devis"
        entityLabel="devis"
        fields={[{ key: 'clientName', label: 'Client', required: true, aliases: ['client', 'nom client'] }, { key: 'description', label: 'Description' }, { key: 'amount', label: 'Montant', aliases: ['total', 'prix'] }, { key: 'date', label: 'Date', aliases: ['date emission'] }]}
        pastePlaceholder={"Client;Description;Montant;Date\nDupont SARL;Prestation web;1500;2026-03-01"}
        onImport={(rows: Record<string, string>[]) => {
          let imported = 0;
          const errors: string[] = [];
          rows.forEach((row, idx) => {
            const clientName = (row.clientName || '').trim();
            if (!clientName) { errors.push(`Ligne ${idx + 1}: Client requis`); return; }
            const client = activeClients.find((c) => { const name = c.companyName || `${c.firstName} ${c.lastName}`; return name.toLowerCase() === clientName.toLowerCase(); });
            if (!client) { errors.push(`Ligne ${idx + 1}: Client "${clientName}" introuvable`); return; }
            const amount = parseFloat(row.amount || '0') || 0;
            const description = (row.description || 'Article importé').trim();
            const quoteItems: QuoteItem[] = [{ id: `qi_imp_${Date.now()}_${idx}`, quoteId: '', productId: '', productName: description, quantity: 1, unitPrice: amount, vatRate: 20 as import('@/types').VATRate, totalHT: amount, totalTVA: amount * 0.2, totalTTC: amount * 1.2 }];
            const result = createQuote(client.id, quoteItems, 30);
            if (result.success) { imported++; void queryClient.invalidateQueries({ queryKey: ['quotes', DEVIS_COMPANY_ID] }); }
            else errors.push(`Ligne ${idx + 1}: ${result.error || 'Erreur'}`);
          });
          return { imported, errors };
        }}
      />
    </>
  );
}