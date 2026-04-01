import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { Download, Lock, FileText, CheckCircle, Shield, Ban, History, Zap, Plus, Pencil, Calendar, Mail, Printer, DollarSign, Repeat, Truck, Play, Pause, Trash2, PackageCheck, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { canEditInvoice, canCancelInvoice } from '@/services/invoiceService';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import FormModal from '@/components/FormModal';
import ClientPicker from '@/components/ClientPicker';
import LineItemsEditor, { type LineItem } from '@/components/LineItemsEditor';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import TotalsSummary from '@/components/TotalsSummary';
import ConfirmModal from '@/components/ConfirmModal';
import SearchBar from '@/components/SearchBar';
import { FilterChips } from '@/components/FilterChips';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import EmailModal from '@/components/EmailModal';
import type { InvoiceStatus, OrderItem, RecurringFrequency } from '@/types';

import { generateInvoiceHTML, generateAndSharePDF, printPDF } from '@/services/pdfService';
import { sendEmail, buildInvoiceEmailBody } from '@/services/emailService';

type InvoiceTab = 'invoices' | 'credit_notes' | 'reminders' | 'recurring' | 'delivery_notes';

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Brouillon', value: 'draft' },
  { label: 'Validées', value: 'validated' },
  { label: 'Envoyées', value: 'sent' },
  { label: 'Payées', value: 'paid' },
  { label: 'Partielle', value: 'partial' },
  { label: 'En retard', value: 'late' },
];

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { invoices, createInvoice, updateInvoice, validateInvoice, markInvoicePaid, recordPartialPayment, createCreditNote, creditNotes, duplicateInvoice, showToast, company, activeClients, sendInvoiceByEmail, recurringInvoices, createRecurringInvoice, toggleRecurringInvoice, generateRecurringInvoice, deleteRecurringInvoice, deliveryNotes, createDeliveryNote, updateDeliveryNoteStatus, reminderLogs } = useData();
  const cur = company.currency || 'EUR';

  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [_emailInvoiceId, setEmailInvoiceId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('invoices');

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formClientId, setFormClientId] = useState('');
  const [formItems, setFormItems] = useState<LineItem[]>([]);
  const [formError, setFormError] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  const [validateConfirm, setValidateConfirm] = useState<string | null>(null);
  const [creditNoteConfirm, setCreditNoteConfirm] = useState<string | null>(null);

  const handleDownloadPDF = useCallback(async (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    setPdfLoading(true);
    try {
      const client = activeClients.find((c) => c.id === inv.clientId);
      const html = generateInvoiceHTML(inv, company, client);
      const success = await generateAndSharePDF(html, `Facture_${inv.invoiceNumber || 'brouillon'}.pdf`);
      if (success) {
        showToast('PDF généré avec succès');
      } else {
        showToast('Erreur lors de la génération du PDF', 'error');
      }
    } catch {
      showToast('Erreur lors de la génération du PDF', 'error');
    } finally {
      setPdfLoading(false);
    }
  }, [invoices, company, activeClients, showToast]);

  const handlePrintPDF = useCallback(async (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const html = generateInvoiceHTML(inv, company, client);
    await printPDF(html);
  }, [invoices, company, activeClients]);

  const handleOpenEmail = useCallback((invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const { subject, body } = buildInvoiceEmailBody({
      companyName: company.name,
      clientName: inv.clientName,
      invoiceNumber: inv.invoiceNumber || 'Brouillon',
      totalTTC: inv.totalTTC,
      dueDate: inv.dueDate,
      currency: company.currency || 'EUR',
    });
    setEmailTo(client?.email || '');
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailInvoiceId(invoiceId);
    setEmailModalVisible(true);
  }, [invoices, activeClients, company]);

  const handleSendEmail = useCallback(async () => {
    if (!emailTo) { showToast('Email destinataire requis', 'error'); return; }
    const success = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    if (success) {
      if (_emailInvoiceId) sendInvoiceByEmail(_emailInvoiceId);
      showToast('Email envoyé avec succès');
    } else {
      showToast('Impossible d\'ouvrir le client mail', 'error');
    }
    setEmailModalVisible(false);
  }, [emailTo, emailSubject, emailBody, _emailInvoiceId, showToast, sendInvoiceByEmail]);

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, statusFilter, invoices]);

  const selected = useMemo(
    () => invoices.find((i) => i.id === selectedInvoice),
    [selectedInvoice, invoices]
  );

  const vatSummary = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, inv) => ({
        totalHT: acc.totalHT + inv.totalHT,
        totalTVA: acc.totalTVA + inv.totalTVA,
        totalTTC: acc.totalTTC + inv.totalTTC,
        paid: acc.paid + inv.paidAmount,
      }),
      { totalHT: 0, totalTVA: 0, totalTTC: 0, paid: 0 }
    );
  }, [filteredInvoices]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormClientId('');
    setFormItems([]);
    setFormError('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv || inv.isLocked) {
      showToast('Cette facture est verrouillée et ne peut être modifiée', 'error');
      return;
    }
    setEditingId(inv.id);
    setFormClientId(inv.clientId);
    setFormItems(inv.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      totalHT: i.totalHT,
      totalTVA: i.totalTVA,
      totalTTC: i.totalTTC,
    })));
    setFormDate(inv.issueDate ? inv.issueDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormError('');
    setFormVisible(true);
  }, [invoices, showToast]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Veuillez sélectionner un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }

    const issueDate = new Date(formDate + 'T00:00:00').toISOString();
    const orderItems: OrderItem[] = formItems.map((li) => ({
      id: li.id,
      orderId: '',
      productId: li.productId,
      productName: li.productName,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
      totalHT: li.totalHT,
      totalTVA: li.totalTVA,
      totalTTC: li.totalTTC,
    }));

    if (editingId) {
      const result = updateInvoice(editingId, { clientId: formClientId, items: orderItems, issueDate });
      if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    } else {
      const result = createInvoice(formClientId, orderItems, undefined, issueDate);
      if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    }
    setFormVisible(false);
  }, [formClientId, formItems, formDate, editingId, createInvoice, updateInvoice]);

  const handleValidate = useCallback(() => {
    if (!validateConfirm) return;
    const result = validateInvoice(validateConfirm);
    if (!result.success) {
      showToast(result.error || 'Erreur de validation', 'error');
    }
    setValidateConfirm(null);
  }, [validateConfirm, validateInvoice, showToast]);

  const [partialPaymentVisible, setPartialPaymentVisible] = useState(false);
  const [partialPaymentInvoiceId, setPartialPaymentInvoiceId] = useState<string | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [partialPaymentError, setPartialPaymentError] = useState('');

  const handleCreateCreditNote = useCallback(() => {
    if (!creditNoteConfirm) return;
    const inv = invoices.find(i => i.id === creditNoteConfirm);
    if (!inv) { setCreditNoteConfirm(null); return; }
    const result = createCreditNote(creditNoteConfirm, inv.items, 'Annulation facture');
    if (!result.success) {
      showToast(result.error || 'Erreur', 'error');
    }
    setCreditNoteConfirm(null);
  }, [creditNoteConfirm, invoices, createCreditNote, showToast]);

  const handleDuplicate = useCallback((invoiceId: string) => {
    duplicateInvoice(invoiceId);
  }, [duplicateInvoice]);

  const openPartialPayment = useCallback((invoiceId: string) => {
    setPartialPaymentInvoiceId(invoiceId);
    setPartialPaymentAmount('');
    setPartialPaymentError('');
    setPartialPaymentVisible(true);
  }, []);

  const handlePartialPayment = useCallback(() => {
    if (!partialPaymentInvoiceId) return;
    const amount = parseFloat(partialPaymentAmount);
    if (isNaN(amount) || amount <= 0) { setPartialPaymentError('Montant invalide'); return; }
    const result = recordPartialPayment(partialPaymentInvoiceId, amount);
    if (!result.success) { setPartialPaymentError(result.error || 'Erreur'); return; }
    setPartialPaymentVisible(false);
  }, [partialPaymentInvoiceId, partialPaymentAmount, recordPartialPayment]);

  const [riFormVisible, setRiFormVisible] = useState(false);
  const [riClientId, setRiClientId] = useState('');
  const [riItems, setRiItems] = useState<LineItem[]>([]);
  const [riFrequency, setRiFrequency] = useState<RecurringFrequency>('monthly');
  const [riStartDate, setRiStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [riEndDate, setRiEndDate] = useState('');
  const [riNotes, setRiNotes] = useState('');
  const [riError, setRiError] = useState('');
  const [dnConfirm, setDnConfirm] = useState<string | null>(null);

  const handleCreateRecurring = useCallback(() => {
    if (!riClientId) { setRiError('Veuillez sélectionner un client'); return; }
    if (riItems.length === 0) { setRiError('Ajoutez au moins une ligne'); return; }
    const orderItems: OrderItem[] = riItems.map((li) => ({
      id: li.id, orderId: '', productId: li.productId, productName: li.productName,
      quantity: li.quantity, unitPrice: li.unitPrice, vatRate: li.vatRate,
      totalHT: li.totalHT, totalTVA: li.totalTVA, totalTTC: li.totalTTC,
    }));
    const result = createRecurringInvoice({
      clientId: riClientId, items: orderItems, frequency: riFrequency,
      startDate: new Date(riStartDate + 'T00:00:00').toISOString(),
      endDate: riEndDate ? new Date(riEndDate + 'T00:00:00').toISOString() : undefined,
      notes: riNotes,
    });
    if (!result.success) { setRiError(result.error || 'Erreur'); return; }
    setRiFormVisible(false);
  }, [riClientId, riItems, riFrequency, riStartDate, riEndDate, riNotes, createRecurringInvoice]);

  const handleCreateDeliveryNote = useCallback(() => {
    if (!dnConfirm) return;
    const result = createDeliveryNote(dnConfirm);
    if (!result.success) {
      showToast(result.error || 'Erreur', 'error');
    }
    setDnConfirm(null);
  }, [dnConfirm, createDeliveryNote, showToast]);

  const TABS: { key: InvoiceTab; label: string; count: number }[] = [
    { key: 'invoices', label: 'Factures', count: invoices.length },
    { key: 'recurring', label: 'Récurrentes', count: recurringInvoices.length },
    { key: 'delivery_notes', label: 'Livraisons', count: deliveryNotes.length },
    { key: 'credit_notes', label: 'Avoirs', count: creditNotes.length },
    { key: 'reminders', label: 'Relances', count: reminderLogs.length },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title="Factures"
        action={
          <View style={styles.headerActions}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate} testID="create-invoice-btn">
              <Plus size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}>
              <Download size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabCount, { backgroundColor: active ? colors.primary + '20' : colors.surfaceHover }]}>
                  <Text style={[styles.tabCountText, { color: active ? colors.primary : colors.textTertiary }]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'invoices' && (
          <>
            <View style={[styles.vatRow, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.vatCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.vatLabel, { color: colors.textSecondary }]}>Total HT</Text>
                <Text style={[styles.vatValue, { color: colors.text }]}>{formatCurrency(vatSummary.totalHT, cur)}</Text>
              </View>
              <View style={[styles.vatCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.vatLabel, { color: colors.textSecondary }]}>TVA collectée</Text>
                <Text style={[styles.vatValue, { color: colors.primary }]}>{formatCurrency(vatSummary.totalTVA, cur)}</Text>
              </View>
              <View style={[styles.vatCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.vatLabel, { color: colors.textSecondary }]}>Total TTC</Text>
                <Text style={[styles.vatValue, { color: colors.text }]}>{formatCurrency(vatSummary.totalTTC, cur)}</Text>
              </View>
              <View style={[styles.vatCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.vatLabel, { color: colors.textSecondary }]}>Encaissé</Text>
                <Text style={[styles.vatValue, { color: colors.success }]}>{formatCurrency(vatSummary.paid, cur)}</Text>
              </View>
            </View>

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une facture..."
              testID="invoice-search"
            />

            <FilterChips options={STATUS_FILTERS} value={statusFilter} onSelect={setStatusFilter} />

            <View style={[styles.complianceBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Shield size={16} color={colors.primary} />
              <Text style={[styles.complianceText, { color: colors.primary }]}>
                Conformité anti-fraude · Les factures validées sont verrouillées et non modifiables · Annulation par avoir uniquement
              </Text>
            </View>

            {filteredInvoices.length === 0 && (
              <EmptyState
                icon={<FileText size={40} color={colors.textTertiary} />}
                title="Aucune facture trouvée"
              />
            )}

            <View style={[styles.mainContent, isMobile && { flexDirection: 'column' }]}>
              <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {filteredInvoices.map((invoice) => {
                  const editable = canEditInvoice(invoice);
                  return (
                    <TouchableOpacity
                      key={invoice.id}
                      style={[
                        styles.invoiceRow,
                        { borderBottomColor: colors.borderLight },
                        selectedInvoice === invoice.id && { backgroundColor: colors.surfaceHover },
                      ]}
                      onPress={() => setSelectedInvoice(selectedInvoice === invoice.id ? null : invoice.id)}
                      activeOpacity={0.7}
                      testID={`invoice-row-${invoice.id}`}
                    >
                      <View style={styles.invoiceMain}>
                        <View style={styles.invoiceLeft}>
                          <View style={styles.invoiceNumRow}>
                            <Text style={[styles.invoiceNum, { color: colors.text }]}>{invoice.invoiceNumber || 'Brouillon'}</Text>
                            {invoice.isLocked && <Lock size={12} color={colors.textTertiary} />}
                            {invoice.electronicReady && <Zap size={12} color={colors.primary} />}
                          </View>
                          <Text style={[styles.invoiceClient, { color: colors.textSecondary }]}>{invoice.clientName}</Text>
                          {invoice.orderId && (
                            <Text style={[styles.invoiceSource, { color: colors.textTertiary }]}>Depuis commande</Text>
                          )}
                          {invoice.quoteId && (
                            <Text style={[styles.invoiceSource, { color: colors.textTertiary }]}>Depuis devis</Text>
                          )}
                        </View>
                        <View style={styles.invoiceRight}>
                          <StatusBadge status={invoice.status} />
                          <Text style={[styles.invoiceAmount, { color: colors.text }]}>{formatCurrency(invoice.totalTTC, cur)}</Text>
                        </View>
                      </View>
                      <View style={styles.invoiceMeta}>
                        <Text style={[styles.invoiceDate, { color: colors.textTertiary }]}>
                          Émise le {formatDate(invoice.issueDate)} · Échéance {formatDate(invoice.dueDate)}
                        </Text>
                        <View style={styles.invoiceActions}>
                          {editable && (
                            <TouchableOpacity onPress={() => openEdit(invoice.id)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
                              <Pencil size={12} color={colors.primary} />
                            </TouchableOpacity>
                          )}
                          {invoice.isLocked && (
                            <View style={[styles.lockedBadge, { backgroundColor: colors.surfaceHover }]}>
                              <Lock size={10} color={colors.textTertiary} />
                              <Text style={[styles.lockedText, { color: colors.textTertiary }]}>Verrouillée</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selected && !isMobile && (
                <View style={[styles.detailPanel, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight }]}>
                      <FileText size={24} color={colors.primary} />
                    </View>
                    <Text style={[styles.detailNum, { color: colors.text }]}>{selected.invoiceNumber || 'Brouillon'}</Text>
                    {selected.isValidated && (
                      <View style={[styles.validatedBadge, { backgroundColor: colors.successLight }]}>
                        <CheckCircle size={12} color={colors.success} />
                        <Text style={[styles.validatedText, { color: colors.success }]}>Validée · Non modifiable</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>CLIENT</Text>
                    <Text style={[styles.detailText, { color: colors.text }]}>{selected.clientName}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
                    {selected.items.map((item) => (
                      <View key={item.id} style={styles.lineItem}>
                        <Text style={[styles.lineProduct, { color: colors.text }]}>{item.productName}</Text>
                        <Text style={[styles.lineDetail, { color: colors.textSecondary }]}>
                          {item.quantity} × {formatCurrency(item.unitPrice, cur)} · TVA {item.vatRate}%
                        </Text>
                        <Text style={[styles.lineTotal, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.totalSection, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalRowLabel, { color: colors.textSecondary }]}>Total HT</Text>
                      <Text style={[styles.totalRowValue, { color: colors.text }]}>{formatCurrency(selected.totalHT, cur)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalRowLabel, { color: colors.textSecondary }]}>TVA</Text>
                      <Text style={[styles.totalRowValue, { color: colors.text }]}>{formatCurrency(selected.totalTVA, cur)}</Text>
                    </View>
                    <View style={[styles.totalRow, styles.totalRowFinal]}>
                      <Text style={[styles.totalRowLabelBold, { color: colors.text }]}>Total TTC</Text>
                      <Text style={[styles.totalRowValueBold, { color: colors.text }]}>{formatCurrency(selected.totalTTC, cur)}</Text>
                    </View>
                    {selected.paidAmount > 0 && selected.paidAmount < selected.totalTTC && (
                      <View style={[styles.totalRow, { marginTop: 4 }]}>
                        <Text style={[styles.totalRowLabel, { color: colors.success }]}>Payé</Text>
                        <Text style={[styles.totalRowValue, { color: colors.success }]}>{formatCurrency(selected.paidAmount, cur)}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>MENTIONS LÉGALES</Text>
                    <Text style={[styles.legalText, { color: colors.textTertiary }]}>{selected.legalMentions}</Text>
                    <Text style={[styles.legalText, { color: colors.textTertiary, marginTop: 4 }]}>{selected.paymentTerms}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    {!selected.isValidated && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.success }]}
                        onPress={() => setValidateConfirm(selected.id)}
                        testID="validate-invoice-btn"
                      >
                        <CheckCircle size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Valider & Verrouiller</Text>
                      </TouchableOpacity>
                    )}
                    {canEditInvoice(selected) && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => openEdit(selected.id)}
                      >
                        <Pencil size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Modifier</Text>
                      </TouchableOpacity>
                    )}
                    {selected.isValidated && canCancelInvoice(selected) && (selected.status === 'paid' || selected.paidAmount > 0 || selected.status !== 'cancelled') && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                        onPress={() => setCreditNoteConfirm(selected.id)}
                      >
                        <Ban size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Créer un avoir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.actionRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                      onPress={() => handleDownloadPDF(selected.id)}
                      disabled={pdfLoading}
                    >
                      <Download size={14} color={colors.text} />
                      <Text style={[styles.actionBtnText, { color: colors.text }]}>{pdfLoading ? 'Génération...' : 'PDF'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                      onPress={() => handlePrintPDF(selected.id)}
                    >
                      <Printer size={14} color={colors.text} />
                      <Text style={[styles.actionBtnText, { color: colors.text }]}>Imprimer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleOpenEmail(selected.id)}
                    >
                      <Mail size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Email</Text>
                    </TouchableOpacity>
                  </View>
                  {(selected.status === 'validated' || selected.status === 'sent' || selected.status === 'late' || selected.status === 'partial') && (
                    <View style={[styles.actionRow, { marginTop: 8 }]}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.success }]}
                        onPress={() => markInvoicePaid(selected.id)}
                      >
                        <DollarSign size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Marquer payée</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#0369A1' }]}
                        onPress={() => openPartialPayment(selected.id)}
                      >
                        <DollarSign size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Paiement partiel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {selected.paidAmount > 0 && selected.paidAmount < selected.totalTTC && (
                    <View style={[styles.actionRow, { marginTop: 6 }]}>
                      <View style={[styles.actionBtn, { backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning + '40' }]}>
                        <DollarSign size={14} color={colors.warning} />
                        <Text style={[styles.actionBtnText, { color: colors.warning }]}>Reste à payer : {formatCurrency(selected.totalTTC - selected.paidAmount, cur)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={[styles.actionRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                      onPress={() => handleDuplicate(selected.id)}
                    >
                      <FileText size={14} color={colors.text} />
                      <Text style={[styles.actionBtnText, { color: colors.text }]}>Dupliquer</Text>
                    </TouchableOpacity>
                    {selected.isValidated && !deliveryNotes.some(dn => dn.invoiceId === selected.id) && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#0369A1' }]}
                        onPress={() => setDnConfirm(selected.id)}
                      >
                        <Truck size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Bon de livraison</Text>
                      </TouchableOpacity>
                    )}
                    {deliveryNotes.some(dn => dn.invoiceId === selected.id) && (
                      <View style={[styles.actionBtn, { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success + '40' }]}>
                        <PackageCheck size={14} color={colors.success} />
                        <Text style={[styles.actionBtnText, { color: colors.success }]}>BL créé</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'recurring' && (
          <>
            <View style={{ flexDirection: 'row' as const, justifyContent: 'flex-end' as const, marginBottom: 8 }}>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setRiClientId('');
                  setRiItems([]);
                  setRiFrequency('monthly');
                  setRiStartDate(new Date().toISOString().slice(0, 10));
                  setRiEndDate('');
                  setRiNotes('');
                  setRiError('');
                  setRiFormVisible(true);
                }}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Nouveau modèle</Text>
              </TouchableOpacity>
            </View>
            {recurringInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
                  <Repeat size={28} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun modèle récurrent</Text>
                <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>Créez un modèle pour générer automatiquement des factures</Text>
              </View>
            ) : (
              <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {recurringInvoices.map((ri, i) => {
                  const freqLabels: Record<RecurringFrequency, string> = { monthly: 'Mensuelle', quarterly: 'Trimestrielle', yearly: 'Annuelle' };
                  return (
                    <View
                      key={ri.id}
                      style={[
                        styles.invoiceRow,
                        { borderBottomColor: colors.borderLight },
                        i === recurringInvoices.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.invoiceMain}>
                        <View style={styles.invoiceLeft}>
                          <View style={styles.invoiceNumRow}>
                            <Repeat size={14} color={colors.primary} />
                            <Text style={[styles.invoiceNum, { color: colors.text }]}>{ri.clientName}</Text>
                          </View>
                          <Text style={[styles.invoiceClient, { color: colors.textSecondary }]}>
                            {freqLabels[ri.frequency]} · {ri.items.length} ligne(s)
                          </Text>
                          <Text style={[styles.invoiceSource, { color: colors.textTertiary }]}>
                            Prochaine : {formatDate(ri.nextGenerationDate)}
                            {ri.lastGeneratedAt ? ` · Dernière : ${formatDate(ri.lastGeneratedAt)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.invoiceRight}>
                          <View style={[styles.lockedBadge, { backgroundColor: ri.status === 'active' ? colors.successLight : colors.warningLight }]}>
                            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: ri.status === 'active' ? colors.success : colors.warning }}>
                              {ri.status === 'active' ? 'Actif' : 'Pausé'}
                            </Text>
                          </View>
                          <Text style={[styles.invoiceAmount, { color: colors.text }]}>{formatCurrency(ri.totalTTC, cur)}</Text>
                        </View>
                      </View>
                      <View style={[styles.invoiceMeta, { marginTop: 10 }]}>
                        <View style={{ flexDirection: 'row' as const, gap: 6 }}>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: colors.successLight }]}
                            onPress={() => generateRecurringInvoice(ri.id)}
                          >
                            <Play size={12} color={colors.success} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: ri.status === 'active' ? colors.warningLight : colors.primaryLight }]}
                            onPress={() => toggleRecurringInvoice(ri.id)}
                          >
                            {ri.status === 'active' ? <Pause size={12} color={colors.warning} /> : <Play size={12} color={colors.primary} />}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}
                            onPress={() => deleteRecurringInvoice(ri.id)}
                          >
                            <Trash2 size={12} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {activeTab === 'delivery_notes' && (
          <>
            {deliveryNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
                  <Truck size={28} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun bon de livraison</Text>
                <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>Créez un bon de livraison depuis une facture validée</Text>
              </View>
            ) : (
              <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {deliveryNotes.map((dn, i) => {
                  const statusLabels: Record<string, string> = { preparation: 'En préparation', shipped: 'Expédié', delivered: 'Livré' };
                  const statusColors: Record<string, string> = { preparation: colors.warning, shipped: colors.primary, delivered: colors.success };
                  const statusBgColors: Record<string, string> = { preparation: colors.warningLight, shipped: colors.primaryLight, delivered: colors.successLight };
                  const nextStatus: Record<string, string> = { preparation: 'shipped', shipped: 'delivered' };
                  return (
                    <View
                      key={dn.id}
                      style={[
                        styles.invoiceRow,
                        { borderBottomColor: colors.borderLight },
                        i === deliveryNotes.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.invoiceMain}>
                        <View style={styles.invoiceLeft}>
                          <View style={styles.invoiceNumRow}>
                            <Truck size={14} color={colors.primary} />
                            <Text style={[styles.invoiceNum, { color: colors.text }]}>{dn.deliveryNumber}</Text>
                          </View>
                          <Text style={[styles.invoiceClient, { color: colors.textSecondary }]}>
                            {dn.clientName} · Facture {dn.invoiceNumber}
                          </Text>
                          <Text style={[styles.invoiceSource, { color: colors.textTertiary }]}>
                            {dn.items.length} article(s) · Créé le {formatDate(dn.createdAt)}
                            {dn.shippedAt ? ` · Expédié le ${formatDate(dn.shippedAt)}` : ''}
                            {dn.deliveredAt ? ` · Livré le ${formatDate(dn.deliveredAt)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.invoiceRight}>
                          <View style={[styles.lockedBadge, { backgroundColor: statusBgColors[dn.status] || colors.surfaceHover }]}>
                            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: statusColors[dn.status] || colors.textSecondary }}>
                              {statusLabels[dn.status] || dn.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {nextStatus[dn.status] && (
                        <View style={[styles.invoiceMeta, { marginTop: 10 }]}>
                          <TouchableOpacity
                            style={[styles.iconBtn, { backgroundColor: colors.primaryLight, flexDirection: 'row' as const, gap: 4, paddingHorizontal: 10 }]}
                            onPress={() => updateDeliveryNoteStatus(dn.id, nextStatus[dn.status] as 'shipped' | 'delivered')}
                          >
                            <ChevronRight size={12} color={colors.primary} />
                            <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.primary }}>
                              {nextStatus[dn.status] === 'shipped' ? 'Expédier' : 'Marquer livré'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {activeTab === 'credit_notes' && (
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {creditNotes.length === 0 && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
                  <FileText size={28} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun avoir pour l\u2019instant</Text>
                <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>Les avoirs créés depuis vos factures apparaîtront ici</Text>
              </View>
            )}
            {creditNotes.map((cn, i) => (
              <View
                key={cn.id}
                style={[
                  styles.cnRow,
                  i < creditNotes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
              >
                <View style={styles.cnMain}>
                  <View style={styles.cnLeft}>
                    <View style={styles.cnNumRow}>
                      <Text style={[styles.cnNum, { color: colors.text }]}>{cn.creditNoteNumber}</Text>
                      {cn.isValidated && <Lock size={12} color={colors.textTertiary} />}
                    </View>
                    <Text style={[styles.cnClient, { color: colors.textSecondary }]}>{cn.clientName}</Text>
                    <Text style={[styles.cnRef, { color: colors.textTertiary }]}>Ref: {cn.invoiceNumber}</Text>
                  </View>
                  <View style={styles.cnRight}>
                    <StatusBadge status={cn.status} />
                    <Text style={[styles.cnAmount, { color: colors.danger }]}>-{formatCurrency(cn.totalTTC, cur)}</Text>
                  </View>
                </View>
                <Text style={[styles.cnReason, { color: colors.textSecondary }]}>Motif: {cn.reason}</Text>
                <Text style={[styles.cnDate, { color: colors.textTertiary }]}>
                  Émis le {formatDate(cn.issueDate)}
                  {cn.validatedAt ? ` · Validé le ${formatDate(cn.validatedAt)}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'reminders' && (
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {reminderLogs.length === 0 && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
                  <History size={28} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune relance envoyée</Text>
                <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>Envoyez des relances depuis vos factures impayées</Text>
              </View>
            )}
            {reminderLogs.map((rem, i) => (
              <View
                key={rem.id}
                style={[
                  styles.reminderRow,
                  i < reminderLogs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
              >
                <View style={[styles.reminderIcon, { backgroundColor: colors.warningLight }]}>
                  <History size={16} color={colors.warning} />
                </View>
                <View style={styles.reminderInfo}>
                  <Text style={[styles.reminderInvoice, { color: colors.text }]}>
                    {rem.invoiceNumber || rem.invoiceId} - {rem.clientName || '—'}
                  </Text>
                  <Text style={[styles.reminderType, { color: colors.textSecondary }]}>
                    Niveau {rem.level} · {rem.method}
                  </Text>
                  <Text style={[styles.reminderEmail, { color: colors.textTertiary }]}>
                    Envoyé le {formatDateTime(rem.sentAt || rem.createdAt)}
                  </Text>
                </View>
                <View style={[
                  styles.reminderStatus,
                  { backgroundColor: rem.level >= 3 ? colors.dangerLight : rem.level >= 2 ? colors.warningLight : colors.successLight },
                ]}>
                  <Text style={[
                    styles.reminderStatusText,
                    { color: rem.level >= 3 ? colors.danger : rem.level >= 2 ? colors.warning : colors.success },
                  ]}>
                    Niv. {rem.level}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier la facture' : 'Nouvelle facture'}
        subtitle={editingId ? 'Modifier le brouillon de facture' : 'Créez une facture brouillon, puis validez-la'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer le brouillon'}
        width={600}
      >
        <ErrorBanner message={formError} />

        <ClientPicker
          selectedClientId={formClientId}
          onSelect={setFormClientId}
          required
        />

        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>DATE DE FACTURE</Text>
          <View style={[styles.dateFieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Calendar size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.dateInput, { color: colors.text }]}
              value={formDate}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9-]/g, '');
                setFormDate(cleaned);
              }}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textTertiary}
              maxLength={10}
              testID="invoice-date-input"
            />
            <TouchableOpacity
              style={[styles.todayBtn, { backgroundColor: colors.primaryLight }]}
              onPress={() => setFormDate(new Date().toISOString().slice(0, 10))}
            >
              <Text style={[styles.todayBtnText, { color: colors.primary }]}>Aujourd'hui</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE FACTURE</Text>
          <LineItemsEditor
            items={formItems}
            onItemsChange={setFormItems}
            idPrefix="oi"
            allowedProductTypes={SALES_ALLOWED_TYPES}
          />
          <TotalsSummary items={formItems} compact />
        </View>
      </FormModal>

      <ConfirmModal
        visible={validateConfirm !== null}
        onClose={() => setValidateConfirm(null)}
        onConfirm={handleValidate}
        title="Valider et verrouiller ?"
        message="Une fois validée, cette facture recevra un numéro séquentiel et sera définitivement verrouillée. Elle ne pourra plus être modifiée. Seul un avoir pourra l'annuler."
        confirmLabel="Valider"
      />

      <ConfirmModal
        visible={creditNoteConfirm !== null}
        onClose={() => setCreditNoteConfirm(null)}
        onConfirm={handleCreateCreditNote}
        title="Créer un avoir ?"
        message="Cette action créera un avoir pour annuler cette facture validée. Le montant sera crédité."
        confirmLabel="Créer l'avoir"
        destructive
      />

      <EmailModal
        visible={emailModalVisible}
        onClose={() => setEmailModalVisible(false)}
        onSubmit={handleSendEmail}
        subtitle="Envoyer cette facture par email au client"
        emailTo={emailTo}
        onEmailToChange={setEmailTo}
        emailSubject={emailSubject}
        onEmailSubjectChange={setEmailSubject}
        emailBody={emailBody}
        onEmailBodyChange={setEmailBody}
      />

      <ConfirmModal
        visible={dnConfirm !== null}
        onClose={() => setDnConfirm(null)}
        onConfirm={handleCreateDeliveryNote}
        title="Créer un bon de livraison ?"
        message="Un bon de livraison sera créé à partir des lignes de cette facture."
        confirmLabel="Créer le BL"
      />

      <FormModal
        visible={riFormVisible}
        onClose={() => setRiFormVisible(false)}
        title="Nouveau modèle récurrent"
        subtitle="Créez un modèle de facture récurrente"
        onSubmit={handleCreateRecurring}
        submitLabel="Créer le modèle"
        width={600}
      >
        <ErrorBanner message={riError} />
        <ClientPicker selectedClientId={riClientId} onSelect={setRiClientId} required />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>FRÉQUENCE</Text>
          <View style={{ flexDirection: 'row' as const, gap: 8 }}>
            {(['monthly', 'quarterly', 'yearly'] as RecurringFrequency[]).map((f) => {
              const labels: Record<RecurringFrequency, string> = { monthly: 'Mensuelle', quarterly: 'Trimestrielle', yearly: 'Annuelle' };
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, { backgroundColor: riFrequency === f ? colors.primary : colors.card, borderColor: riFrequency === f ? colors.primary : colors.cardBorder }]}
                  onPress={() => setRiFrequency(f)}
                >
                  <Text style={[styles.filterText, { color: riFrequency === f ? '#FFF' : colors.textSecondary }]}>{labels[f]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>DATE DE DÉBUT</Text>
          <View style={[styles.dateFieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Calendar size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.dateInput, { color: colors.text }]}
              value={riStartDate}
              onChangeText={(t) => setRiStartDate(t.replace(/[^0-9-]/g, ''))}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textTertiary}
              maxLength={10}
            />
          </View>
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>DATE DE FIN (optionnelle)</Text>
          <View style={[styles.dateFieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Calendar size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.dateInput, { color: colors.text }]}
              value={riEndDate}
              onChangeText={(t) => setRiEndDate(t.replace(/[^0-9-]/g, ''))}
              placeholder="AAAA-MM-JJ (vide = sans fin)"
              placeholderTextColor={colors.textTertiary}
              maxLength={10}
            />
          </View>
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE FACTURE</Text>
          <LineItemsEditor items={riItems} onItemsChange={setRiItems} idPrefix="ri" allowedProductTypes={SALES_ALLOWED_TYPES} />
          <TotalsSummary items={riItems} compact />
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>NOTES</Text>
          <TextInput
            style={[styles.emailInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={riNotes}
            onChangeText={setRiNotes}
            placeholder="Notes internes..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>
      </FormModal>

      <FormModal
        visible={partialPaymentVisible}
        onClose={() => setPartialPaymentVisible(false)}
        title="Paiement partiel"
        subtitle={partialPaymentInvoiceId ? `Solde restant : ${formatCurrency((invoices.find(i => i.id === partialPaymentInvoiceId)?.totalTTC ?? 0) - (invoices.find(i => i.id === partialPaymentInvoiceId)?.paidAmount ?? 0), cur)}` : ''}
        onSubmit={handlePartialPayment}
        submitLabel="Enregistrer le paiement"
      >
        <ErrorBanner message={partialPaymentError} />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>MONTANT DU PAIEMENT</Text>
          <TextInput
            style={[styles.partialInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={partialPaymentAmount}
            onChangeText={setPartialPaymentAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            testID="partial-payment-amount"
          />
        </View>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16 },
  headerActions: { flexDirection: 'row' as const, gap: 8 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBar: { flexDirection: 'row' as const, gap: 0 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  tabCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tabCountText: { fontSize: 12, fontWeight: '600' as const },
  vatRow: { flexDirection: 'row' as const, gap: 12 },
  vatCard: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 16 },
  vatLabel: { fontSize: 12, marginBottom: 4 },
  vatValue: { fontSize: 18, fontWeight: '700' as const },
  searchBar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' as never },
  filters: { flexGrow: 0 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: '500' as const },
  complianceBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, borderWidth: 1, borderRadius: 8, padding: 12, borderLeftWidth: 3 },
  complianceText: { fontSize: 12, fontWeight: '500' as const, flex: 1 },
  mainContent: { flex: 1, flexDirection: 'row' as const, gap: 16 },
  tableCard: { flex: 1, borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  invoiceRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  invoiceMain: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const },
  invoiceLeft: { flex: 1 },
  invoiceNumRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  invoiceNum: { fontSize: 14, fontWeight: '600' as const },
  invoiceClient: { fontSize: 13, marginTop: 2 },
  invoiceSource: { fontSize: 11, marginTop: 1, fontStyle: 'italic' as const },
  invoiceRight: { alignItems: 'flex-end' as const, gap: 6 },
  invoiceAmount: { fontSize: 15, fontWeight: '700' as const },
  invoiceMeta: { marginTop: 8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  invoiceDate: { fontSize: 12 },
  invoiceActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6 },
  lockedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  lockedText: { fontSize: 10, fontWeight: '600' as const },
  detailPanel: { width: 380, borderWidth: 1, borderRadius: 14, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  detailHeader: { alignItems: 'center' as const, marginBottom: 20 },
  detailIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 },
  detailNum: { fontSize: 18, fontWeight: '700' as const },
  validatedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  validatedText: { fontSize: 11, fontWeight: '600' as const },
  detailDivider: { height: 1, marginBottom: 16 },
  detailSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 8 },
  detailText: { fontSize: 14, fontWeight: '500' as const },
  lineItem: { marginBottom: 10 },
  lineProduct: { fontSize: 13, fontWeight: '500' as const },
  lineDetail: { fontSize: 12, marginTop: 2 },
  lineTotal: { fontSize: 13, fontWeight: '600' as const, marginTop: 2 },
  totalSection: { borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 20, gap: 6 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 },
  totalRowLabel: { fontSize: 13 },
  totalRowValue: { fontSize: 13, fontWeight: '500' as const },
  totalRowLabelBold: { fontSize: 14, fontWeight: '700' as const },
  totalRowValueBold: { fontSize: 16, fontWeight: '700' as const },
  legalText: { fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: 'row' as const, gap: 8 },
  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, gap: 6, flex: 1, justifyContent: 'center' as const },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  exportBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 6 },
  exportBtnText: { fontSize: 14, fontWeight: '500' as const },
  emptyState: { padding: 40, alignItems: 'center' as const, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyText: { fontSize: 15, fontWeight: '600' as const, textAlign: 'center' as const },
  emptySubText: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  cnRow: { paddingHorizontal: 20, paddingVertical: 14 },
  cnMain: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const },
  cnLeft: { flex: 1 },
  cnNumRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  cnNum: { fontSize: 14, fontWeight: '600' as const },
  cnClient: { fontSize: 13, marginTop: 2 },
  cnRef: { fontSize: 11, marginTop: 2 },
  cnRight: { alignItems: 'flex-end' as const, gap: 6 },
  cnAmount: { fontSize: 15, fontWeight: '700' as const },
  cnReason: { fontSize: 12, marginTop: 6 },
  cnDate: { fontSize: 11, marginTop: 4 },
  reminderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  reminderIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  reminderInfo: { flex: 1 },
  reminderInvoice: { fontSize: 14, fontWeight: '500' as const },
  reminderType: { fontSize: 12, marginTop: 2 },
  reminderEmail: { fontSize: 11, marginTop: 2 },
  reminderStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  reminderStatusText: { fontSize: 11, fontWeight: '600' as const },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  formSection: { gap: 12 },
  formSectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  dateFieldRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  dateInput: { flex: 1, fontSize: 14, outlineStyle: 'none' as never },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  todayBtnText: { fontSize: 12, fontWeight: '600' as const },
  emailInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  emailBodyInput: { height: 160, textAlignVertical: 'top' as const },
  partialInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600' as const, textAlign: 'center' as const },
});
