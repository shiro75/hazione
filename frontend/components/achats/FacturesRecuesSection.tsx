/**
 * components/achats/FacturesRecuesSection.tsx
 * Factures reçues des fournisseurs :
 * - Import OCR (InvoiceImportSection)
 * - Upload pièce jointe vers Supabase Storage
 * - Paiement via cashflow
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Platform, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Search, Plus, FileText, Check, Clock, ChevronDown, ChevronUp,
  Download, Paperclip, Upload, UserPlus, CreditCard,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import StatusBadge from '@/components/StatusBadge';
import DatePickerField from '@/components/DatePickerField';
import InvoiceImportSection, { OcrFieldIndicator } from '@/components/InvoiceImportSection';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import { supabase } from '@/services/supabase';
import type { ParsedInvoiceData } from '@/services/ocrService';
import SupplierDropdown from './SupplierDropdown';
import { styles } from './achatsStyles';

export default function FacturesRecuesSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    activeSupplierInvoices, activeSuppliers, activePurchaseOrders,
    createSupplierInvoice, updateSupplierInvoice, createSupplier, showToast, company,
  } = useData();
  const cur = company.currency || 'EUR';

  const [expandedSiId, setExpandedSiId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importedDocs, setImportedDocs] = useState<Record<string, string>>({});

  // ── Formulaire nouvelle facture ────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPoId, setFormPoId] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('20');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState('');

  // ── OCR ────────────────────────────────────────────────────────────────────
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [ocrFileUri, setOcrFileUri] = useState<string | null>(null);
  const [ocrFileName, setOcrFileName] = useState<string | null>(null);
  const [ocrSupplierName, setOcrSupplierName] = useState<string | null>(null);

  const STATUS_FILTERS = [
    { label: 'Tous', value: 'all' }, { label: 'Reçue', value: 'received' },
    { label: 'À payer', value: 'to_pay' }, { label: 'Payée', value: 'paid' }, { label: 'En retard', value: 'late' },
  ];

  const filtered = useMemo(() => {
    let list = activeSupplierInvoices;
    if (statusFilter !== 'all') list = list.filter((si) => si.status === statusFilter);
    if (search) { const q = search.toLowerCase(); list = list.filter((si) => si.number.toLowerCase().includes(q) || (si.supplierName?.toLowerCase().includes(q))); }
    return list;
  }, [activeSupplierInvoices, search, statusFilter]);

  const getSupplierName = useCallback((supplierId: string) => activeSuppliers.find((s) => s.id === supplierId)?.companyName || 'Inconnu', [activeSuppliers]);

  const supplierPOs = useMemo(() => {
    if (!formSupplierId) return [];
    return activePurchaseOrders.filter((po) => po.supplierId === formSupplierId && ['received', 'sent', 'partial'].includes(po.status));
  }, [activePurchaseOrders, formSupplierId]);

  const totalToPay = useMemo(() => activeSupplierInvoices.filter((si) => si.status === 'to_pay' || si.status === 'received').reduce((s, si) => s + si.total, 0), [activeSupplierInvoices]);

  const openCreate = useCallback(() => {
    setFormSupplierId(activeSuppliers.length > 0 ? activeSuppliers[0].id : '');
    setFormPoId('');
    const due = new Date(); due.setDate(due.getDate() + 30);
    setFormDueDate(due.toISOString().split('T')[0]);
    setFormNotes(''); setFormDescription(''); setFormAmount(''); setFormTaxRate('20'); setFormError('');
    setOcrFilledFields(new Set()); setOcrFileUri(null); setOcrFileName(null); setOcrSupplierName(null);
    setFormInvoiceNumber(''); setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormVisible(true);
  }, [activeSuppliers]);

  const handleOcrData = useCallback((data: ParsedInvoiceData, fileUri: string, fileName: string) => {
    const filled = new Set<string>();
    setOcrFileUri(fileUri); setOcrFileName(fileName);
    if (data.supplier_name) {
      setOcrSupplierName(data.supplier_name);
      const q = data.supplier_name.toLowerCase().trim();
      const match = activeSuppliers.find((s) => s.companyName.toLowerCase().includes(q) || q.includes(s.companyName.toLowerCase()));
      if (match) { setFormSupplierId(match.id); filled.add('supplier'); }
    }
    if (data.total_ht !== null) { setFormAmount(String(data.total_ht)); filled.add('amount'); }
    else if (data.total_ttc !== null && data.tva_rate !== null) { setFormAmount(String(Math.round(data.total_ttc / (1 + data.tva_rate / 100) * 100) / 100)); filled.add('amount'); }
    else if (data.total_ttc !== null) { setFormAmount(String(Math.round(data.total_ttc / 1.2 * 100) / 100)); filled.add('amount'); }
    if (data.tva_rate !== null) { setFormTaxRate(String(data.tva_rate)); filled.add('taxRate'); }
    if (data.due_date) { setFormDueDate(data.due_date); filled.add('dueDate'); }
    if (data.invoice_date) { setFormInvoiceDate(data.invoice_date); filled.add('invoiceDate'); }
    if (data.invoice_number) { setFormInvoiceNumber(data.invoice_number); filled.add('invoiceNumber'); }
    if (data.lines && data.lines.length > 0) { setFormDescription(data.lines.map((l) => `${l.description} (x${l.quantity} @ ${l.unit_price})`).join(', ')); filled.add('description'); }
    const noteParts: string[] = [];
    if (data.invoice_number) noteParts.push(`N° fournisseur: ${data.invoice_number}`);
    if (data.total_ttc !== null) noteParts.push(`Total TTC: ${data.total_ttc}`);
    if (data.supplier_name) noteParts.push(`Fournisseur détecté: ${data.supplier_name}`);
    if (noteParts.length > 0) { setFormNotes(noteParts.join(' | ')); filled.add('notes'); }
    setOcrFilledFields(filled);
  }, [activeSuppliers]);

  const handleCreateSupplierFromOcr = useCallback(() => {
    if (!ocrSupplierName) return;
    const result = createSupplier({ companyName: ocrSupplierName, email: '', phone: '', address: '', city: '', postalCode: '', country: 'France', notes: '', paymentConditions: '' });
    if (result.success) {
      setTimeout(() => { const created = activeSuppliers.find((s) => s.companyName === ocrSupplierName); if (created) setFormSupplierId(created.id); }, 200);
      setOcrSupplierName(null);
    }
  }, [ocrSupplierName, createSupplier, activeSuppliers]);

  const uploadAttachment = useCallback(async (fileUri: string, invoiceId: string): Promise<string | null> => {
    try {
      if (Platform.OS !== 'web') return null;
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const ext = ocrFileName?.endsWith('.pdf') ? 'pdf' : 'jpg';
      const filePath = `${company.id || 'default'}/${invoiceId}.${ext}`;
      const { error } = await supabase.storage.from('purchase-invoices').upload(filePath, blob, { contentType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg', upsert: true });
      if (error) return null;
      const { data: urlData } = supabase.storage.from('purchase-invoices').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch { return null; }
  }, [ocrFileName, company.id]);

  const handleSubmitInvoice = useCallback(async () => {
    if (!formSupplierId) { setFormError('Sélectionnez un fournisseur'); return; }
    if (!formAmount || parseFloat(formAmount) <= 0) { setFormError('Le montant est requis'); return; }
    if (!formDueDate) { setFormError('La date d\'échéance est requise'); return; }
    const amount = parseFloat(formAmount) || 0;
    const taxRate = parseFloat(formTaxRate) || 20;
    const items = [{ id: `sii_${Date.now()}`, supplierInvoiceId: '', description: formDescription || 'Facture fournisseur', quantity: 1, unitPrice: amount, taxRate: taxRate as import('@/types').VATRate, total: amount * (1 + taxRate / 100) }];
    const result = createSupplierInvoice(formSupplierId, items, formDueDate, formNotes, formPoId || undefined);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    if (result.siId) {
      const updates: Record<string, unknown> = {};
      if (formInvoiceNumber) updates.supplierInvoiceNumber = formInvoiceNumber;
      if (ocrFileUri) { const attachUrl = await uploadAttachment(ocrFileUri, result.siId); if (attachUrl) updates.attachmentUrl = attachUrl; }
      if (Object.keys(updates).length > 0) updateSupplierInvoice(result.siId, updates as any);
    }
    setFormVisible(false);
  }, [formSupplierId, formAmount, formTaxRate, formDescription, formDueDate, formNotes, formPoId, formInvoiceNumber, createSupplierInvoice, updateSupplierInvoice, ocrFileUri, uploadAttachment]);

  const handleImportDoc = useCallback(async (invoiceId: string) => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*,application/pdf';
        input.onchange = (e: any) => { const file = e.target?.files?.[0]; if (file) { setImportedDocs((prev) => ({ ...prev, [invoiceId]: URL.createObjectURL(file) })); showToast('Document importé avec succès'); } };
        input.click(); return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets?.length > 0) { setImportedDocs((prev) => ({ ...prev, [invoiceId]: result.assets[0].uri })); showToast('Document importé avec succès'); }
    } catch { showToast('Erreur lors de l\'import', 'error'); }
  }, [showToast]);

  return (
    <>
      {/* KPIs résumés */}
      <View style={[styles.summaryRow, isMobile ? { flexDirection: 'column' } : {}]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.warningLight }]}><Clock size={20} color={colors.warning} /></View>
          <View style={styles.summaryInfo}><Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(totalToPay, cur)}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>À payer</Text></View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}><Check size={20} color={colors.success} /></View>
          <View style={styles.summaryInfo}><Text style={[styles.summaryValue, { color: colors.text }]}>{activeSupplierInvoices.filter((si) => si.status === 'paid').length}</Text><Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Payées</Text></View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Rechercher une facture reçue..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => { const cols: ExportColumn<Record<string, unknown>>[] = [{ key: 'number', label: 'N° Facture' }, { key: 'supplierName', label: 'Fournisseur' }, { key: 'status', label: 'Statut' }, { key: 'date', label: 'Date' }, { key: 'dueDate', label: 'Échéance' }, { key: 'subtotal', label: 'Sous-total HT' }, { key: 'taxAmount', label: 'TVA' }, { key: 'total', label: 'Total TTC' }]; void exportToCSV(activeSupplierInvoices.map((si) => ({ ...si } as unknown as Record<string, unknown>)), cols, `factures_recues_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}><Plus size={16} color="#FFF" />{!isMobile && <Text style={styles.addBtnText}>Nouvelle facture</Text>}</TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity key={f.value} style={[styles.filterChip, { backgroundColor: statusFilter === f.value ? colors.primary : colors.card, borderColor: statusFilter === f.value ? colors.primary : colors.cardBorder }]} onPress={() => setStatusFilter(f.value)}>
            <Text style={[styles.filterChipText, { color: statusFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.invoiceSummaryBar}>
        <Text style={styles.invoiceSummaryText}>
          Total : <Text style={styles.invoiceSummaryBold}>{activeSupplierInvoices.length} factures</Text> | <Text style={[styles.invoiceSummaryBold, { color: '#1E40AF' }]}>{formatCurrency(activeSupplierInvoices.reduce((s, si) => s + si.total, 0), cur)}</Text> | <Text style={[styles.invoiceSummaryBold, { color: '#D97706' }]}>{activeSupplierInvoices.filter((si) => ['to_pay', 'received', 'late'].includes(si.status)).length} à payer</Text>
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><FileText size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture reçue</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les factures de vos fournisseurs apparaîtront ici</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((si, i) => {
            const isExpanded = expandedSiId === si.id;
            const linkedPO = si.purchaseOrderId ? activePurchaseOrders.find((po) => po.id === si.purchaseOrderId) : null;
            return (
              <View key={si.id}>
                <TouchableOpacity style={[styles.listRow, i < filtered.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => setExpandedSiId(isExpanded ? null : si.id)} activeOpacity={0.7}>
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{si.number}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{si.supplierName || getSupplierName(si.supplierId)} · Éch: {formatDate(si.dueDate)}</Text>
                    </View>
                    <StatusBadge status={si.status} />
                    <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(si.total, cur)}</Text>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Fournisseur</Text><Text style={[styles.detailValue, { color: colors.text }]}>{si.supplierName || getSupplierName(si.supplierId)}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(si.date)}</Text></View>
                      <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Échéance</Text><Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(si.dueDate)}</Text></View>
                    </View>
                    {si.supplierInvoiceNumber ? <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>N° facture fournisseur</Text><Text style={[styles.detailValue, { color: colors.text }]}>{si.supplierInvoiceNumber}</Text></View> : null}
                    {linkedPO ? <View style={styles.detailInfoCol}><Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Commande liée</Text><Text style={[styles.detailValue, { color: colors.primary }]}>{linkedPO.number}</Text></View> : null}
                    {si.items && si.items.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
                        {si.items.map((item) => (
                          <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[styles.detailLineName, { color: colors.text }]}>{item.description || item.productName || 'Article'}</Text>
                            <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{item.quantity} × {formatCurrency(item.unitPrice, cur)} HT · TVA {item.taxRate}%</Text>
                            <Text style={[styles.detailLineTotal, { color: colors.text }]}>{formatCurrency(item.total, cur)}</Text>
                          </View>
                        ))}
                      </>
                    )}
                    <View style={[styles.detailTotals, { borderTopColor: colors.border }]}>
                      <View style={styles.detailTotalRow}><Text style={{ fontSize: 13, color: colors.textSecondary }}>Sous-total HT</Text><Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(si.subtotal, cur)}</Text></View>
                      <View style={styles.detailTotalRow}><Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text><Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(si.taxAmount, cur)}</Text></View>
                      <View style={[styles.detailTotalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }]}><Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Total TTC</Text><Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{formatCurrency(si.total, cur)}</Text></View>
                    </View>
                    {si.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{si.notes}</Text> : null}
                    <View style={styles.detailActionsRow}>
                      {si.attachmentUrl ? (
                        <TouchableOpacity onPress={() => { if (Platform.OS === 'web') window.open(si.attachmentUrl, '_blank'); else void Linking.openURL(si.attachmentUrl!); }} style={[styles.detailActionBtn, { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success + '30' }]}><Paperclip size={13} color={colors.success} /><Text style={[styles.detailActionBtnText, { color: colors.success }]}>Voir pièce jointe</Text></TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => handleImportDoc(si.id)} style={[styles.detailActionBtn, { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30' }]}><Upload size={13} color={colors.primary} /><Text style={[styles.detailActionBtnText, { color: colors.primary }]}>Importer document</Text></TouchableOpacity>
                      )}
                      {['received', 'to_pay', 'late'].includes(si.status) && (
                        <TouchableOpacity onPress={() => { router.push(`/cashflow?action=pay&supplierInvoiceId=${si.id}&amount=${si.total}&supplier=${encodeURIComponent(si.supplierName || getSupplierName(si.supplierId))}` as never); }} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}><CreditCard size={13} color="#FFF" /><Text style={[styles.detailActionBtnText, { color: '#FFF' }]}>Payer</Text></TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                {!isExpanded && (importedDocs[si.id] || si.attachmentUrl) && (
                  <View style={[styles.importedDocBadge, { backgroundColor: colors.successLight, marginLeft: 16, marginBottom: 8 }]}><Paperclip size={12} color={colors.success} /><Text style={[styles.importedDocText, { color: colors.success }]}>{si.attachmentUrl ? 'Facture originale jointe' : 'Document importé'}</Text></View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Formulaire nouvelle facture ── */}
      <FormModal visible={formVisible} onClose={() => setFormVisible(false)} title="Nouvelle facture reçue" subtitle="Enregistrer une facture fournisseur" onSubmit={handleSubmitInvoice} submitLabel="Créer" width={560}>
        <InvoiceImportSection onDataExtracted={handleOcrData} />
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        {ocrSupplierName && !ocrFilledFields.has('supplier') && (
          <View style={[styles.ocrSupplierBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning + '30' }]}>
            <Text style={[styles.ocrSupplierText, { color: colors.warning }]}>Fournisseur détecté : "{ocrSupplierName}" — aucune correspondance</Text>
            <TouchableOpacity style={[styles.ocrCreateSupplierBtn, { backgroundColor: colors.warning }]} onPress={handleCreateSupplierFromOcr}><UserPlus size={13} color="#FFF" /><Text style={styles.ocrCreateSupplierBtnText}>Créer ce fournisseur</Text></TouchableOpacity>
          </View>
        )}
        <View style={styles.formFieldGroup}>
          <View style={styles.formLabelRow}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Fournisseur *</Text>
            {ocrFilledFields.has('supplier') && <OcrFieldIndicator />}
          </View>
          <SupplierDropdown suppliers={activeSuppliers} selectedId={formSupplierId} onSelect={(id) => { setFormSupplierId(id); setFormPoId(''); }} colors={colors} />
        </View>
        {supplierPOs.length > 0 && (
          <View style={styles.formFieldGroup}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Commande liée (optionnel)</Text>
            <View style={styles.selectRow}>
              <TouchableOpacity style={[styles.selectChip, { backgroundColor: !formPoId ? colors.primary : colors.inputBg, borderColor: !formPoId ? colors.primary : colors.inputBorder }]} onPress={() => setFormPoId('')}><Text style={[styles.selectChipText, { color: !formPoId ? '#FFF' : colors.text }]}>Aucune</Text></TouchableOpacity>
              {supplierPOs.map((po) => (<TouchableOpacity key={po.id} style={[styles.selectChip, { backgroundColor: formPoId === po.id ? colors.primary : colors.inputBg, borderColor: formPoId === po.id ? colors.primary : colors.inputBorder }]} onPress={() => setFormPoId(po.id)}><Text style={[styles.selectChipText, { color: formPoId === po.id ? '#FFF' : colors.text }]}>{po.number}</Text></TouchableOpacity>))}
            </View>
          </View>
        )}
        <View style={styles.formLabelRow}><FormField label="N° facture fournisseur" value={formInvoiceNumber} onChangeText={setFormInvoiceNumber} placeholder="Ex: FA-2024-001" />{ocrFilledFields.has('invoiceNumber') && <OcrFieldIndicator />}</View>
        <View style={styles.formRow}>
          <View style={styles.formCol}><View style={styles.formLabelRow}><DatePickerField label="Date facture" value={formInvoiceDate} onChange={setFormInvoiceDate} />{ocrFilledFields.has('invoiceDate') && <OcrFieldIndicator />}</View></View>
          <View style={styles.formCol}><View style={styles.formLabelRow}><DatePickerField label="Date d'échéance *" value={formDueDate} onChange={setFormDueDate} required />{ocrFilledFields.has('dueDate') && <OcrFieldIndicator />}</View></View>
        </View>
        <View style={styles.formLabelRow}><FormField label="Description" value={formDescription} onChangeText={setFormDescription} placeholder="Description de la facture" />{ocrFilledFields.has('description') && <OcrFieldIndicator />}</View>
        <View style={styles.formRow}>
          <View style={styles.formCol}><View style={styles.formLabelRow}><FormField label="Montant HT *" value={formAmount} onChangeText={setFormAmount} placeholder="0.00" keyboardType="decimal-pad" required />{ocrFilledFields.has('amount') && <OcrFieldIndicator />}</View></View>
          <View style={styles.formCol}><View style={styles.formLabelRow}><FormField label="TVA %" value={formTaxRate} onChangeText={setFormTaxRate} placeholder="20" keyboardType="decimal-pad" />{ocrFilledFields.has('taxRate') && <OcrFieldIndicator />}</View></View>
        </View>
        <View style={styles.formLabelRow}><FormField label="Notes" value={formNotes} onChangeText={setFormNotes} placeholder="Notes..." multiline numberOfLines={2} />{ocrFilledFields.has('notes') && <OcrFieldIndicator />}</View>
        {ocrFileUri ? <View style={[styles.ocrAttachmentBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}><Paperclip size={14} color={colors.primary} /><Text style={[styles.ocrAttachmentText, { color: colors.primary }]} numberOfLines={1}>{ocrFileName || 'Fichier joint'}</Text></View> : null}
      </FormModal>
    </>
  );
}