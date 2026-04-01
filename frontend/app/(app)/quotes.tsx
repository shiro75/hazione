import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Plus, FileText, ArrowRight, Clock, CheckCircle, XCircle, Send, Pencil, Download, Mail, Printer, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate, daysUntil } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
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
import type { QuoteStatus, QuoteItem } from '@/types';
import { generateQuoteHTML, generateAndSharePDF, printPDF } from '@/services/pdfService';
import { sendEmail, buildQuoteEmailBody } from '@/services/emailService';

type QuoteFilterStatus = QuoteStatus | 'all';

const STATUS_FILTERS: { label: string; value: QuoteFilterStatus }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'Brouillon', value: 'draft' },
  { label: 'Envoyés', value: 'sent' },
  { label: 'Acceptés', value: 'accepted' },
  { label: 'Refusés', value: 'refused' },
  { label: 'Expirés', value: 'expired' },
];

export default function QuotesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const {
    quotes, activeClients, company,
    createQuote, updateQuote, sendQuote, acceptQuote, refuseQuote, convertQuoteToInvoice, showToast,
    duplicateQuote, deleteQuote,
  } = useData();
  const cur = company.currency || 'EUR';

  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteFilterStatus>('all');
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formClientId, setFormClientId] = useState('');
  const [formItems, setFormItems] = useState<LineItem[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [sendConfirm, setSendConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [emailAttachment, setEmailAttachment] = useState('');

  const handleDownloadPDF = useCallback(async (quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt) return;
    setPdfLoading(true);
    try {
      const client = activeClients.find((c) => c.id === qt.clientId);
      const html = generateQuoteHTML(qt, company, client);
      const success = await generateAndSharePDF(html, `Devis_${qt.quoteNumber}.pdf`);
      if (success) showToast('PDF généré avec succès');
      else showToast('Erreur lors de la génération du PDF', 'error');
    } catch {
      showToast('Erreur lors de la génération du PDF', 'error');
    } finally {
      setPdfLoading(false);
    }
  }, [quotes, company, activeClients, showToast]);

  const handlePrintPDF = useCallback(async (quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt) return;
    const client = activeClients.find((c) => c.id === qt.clientId);
    const html = generateQuoteHTML(qt, company, client);
    await printPDF(html);
  }, [quotes, company, activeClients]);

  const handleOpenEmail = useCallback((quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt) return;
    const client = activeClients.find((c) => c.id === qt.clientId);
    const { subject, body } = buildQuoteEmailBody({
      companyName: company.name,
      clientName: qt.clientName,
      quoteNumber: qt.quoteNumber,
      totalTTC: qt.totalTTC,
      expirationDate: qt.expirationDate,
      currency: company.currency || 'EUR',
    });
    setEmailTo(client?.email || '');
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailAttachment(`DEVIS_${qt.quoteNumber}.pdf`);
    setEmailModalVisible(true);
  }, [quotes, activeClients, company]);

  const handleDeleteQuote = useCallback(() => {
    if (!deleteConfirm) return;
    const result = deleteQuote(deleteConfirm);
    if (!result.success) {
      showToast(result.error || 'Erreur', 'error');
    }
    if (selectedQuote === deleteConfirm) setSelectedQuote(null);
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteQuote, showToast, selectedQuote]);

  const handleSendEmail = useCallback(async () => {
    if (!emailTo) { showToast('Email destinataire requis', 'error'); return; }
    const success = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    if (success) showToast('Email ouvert dans votre client mail');
    else showToast('Impossible d\'ouvrir le client mail', 'error');
    setEmailModalVisible(false);
  }, [emailTo, emailSubject, emailBody, showToast]);

  const filteredQuotes = useMemo(() => {
    let result = quotes;
    if (statusFilter !== 'all') {
      result = result.filter((q) => q.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (qt) =>
          qt.quoteNumber.toLowerCase().includes(q) ||
          qt.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, statusFilter, quotes]);

  const selected = useMemo(
    () => quotes.find((q) => q.id === selectedQuote),
    [selectedQuote, quotes]
  );

  const summary = useMemo(() => {
    const accepted = quotes.filter((q) => q.status === 'accepted').length;
    const total = quotes.length;
    const totalValue = quotes.reduce((s, q) => s + q.totalTTC, 0);
    const acceptedValue = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + q.totalTTC, 0);
    return { accepted, total, totalValue, acceptedValue, rate: total > 0 ? (accepted / total) * 100 : 0 };
  }, [quotes]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormClientId(activeClients.length > 0 ? activeClients[0].id : '');
    setFormItems([]);
    setFormNotes('');
    setFormError('');
    setFormVisible(true);
  }, [activeClients]);

  const openEdit = useCallback((quoteId: string) => {
    const qt = quotes.find((q) => q.id === quoteId);
    if (!qt || qt.status !== 'draft') {
      showToast('Seuls les devis en brouillon peuvent être modifiés', 'error');
      return;
    }
    setEditingId(qt.id);
    setFormClientId(qt.clientId);
    setFormItems(qt.items.map((i) => ({
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
    setFormNotes(qt.notes);
    setFormError('');
    setFormVisible(true);
  }, [quotes, showToast]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Veuillez sélectionner un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }

    const quoteItems: QuoteItem[] = formItems.map((li) => ({
      id: li.id,
      quoteId: editingId || '',
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
      const result = updateQuote(editingId, { clientId: formClientId, items: quoteItems, notes: formNotes });
      if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    } else {
      const result = createQuote(formClientId, quoteItems, 30, formNotes);
      if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    }
    setFormVisible(false);
  }, [formClientId, formItems, formNotes, editingId, createQuote, updateQuote]);

  const handleConvert = useCallback(() => {
    if (!convertConfirm) return;
    const result = convertQuoteToInvoice(convertConfirm);
    if (!result.success) {
      showToast(result.error || 'Erreur', 'error');
    }
    setConvertConfirm(null);
  }, [convertConfirm, convertQuoteToInvoice, showToast]);

  const handleSend = useCallback(() => {
    if (!sendConfirm) return;
    sendQuote(sendConfirm);
    setSendConfirm(null);
  }, [sendConfirm, sendQuote]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title="Devis"
        action={
          <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate} testID="create-quote-btn">
            <Plus size={18} color="#FFF" />
          </TouchableOpacity>
        }
      />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryRow, isMobile && { flexDirection: 'column' }]}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight }]}>
              <FileText size={18} color={colors.primary} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{summary.total}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total devis</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}>
              <CheckCircle size={18} color={colors.success} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{summary.accepted}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Acceptés</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.warningLight }]}>
              <Clock size={18} color={colors.warning} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(summary.totalValue, cur)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Valeur totale</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}>
              <ArrowRight size={18} color={colors.success} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary.acceptedValue, cur)}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Converti</Text>
            </View>
          </View>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un devis..."
          testID="quote-search"
        />

        <FilterChips options={STATUS_FILTERS} value={statusFilter} onSelect={setStatusFilter} />

        {filteredQuotes.length === 0 && (
          <EmptyState
            icon={<FileText size={40} color={colors.textTertiary} />}
            title="Aucun devis trouvé"
          />
        )}

        <View style={[styles.mainContent, isMobile && { flexDirection: 'column' }]}>
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {filteredQuotes.map((quote) => {
              const remaining = daysUntil(quote.expirationDate);
              const isExpiring = remaining > 0 && remaining <= 7 && quote.status === 'sent';
              return (
                <TouchableOpacity
                  key={quote.id}
                  style={[
                    styles.quoteRow,
                    { borderBottomColor: colors.borderLight },
                    selectedQuote === quote.id && { backgroundColor: colors.surfaceHover },
                  ]}
                  onPress={() => setSelectedQuote(selectedQuote === quote.id ? null : quote.id)}
                  activeOpacity={0.7}
                  testID={`quote-row-${quote.id}`}
                >
                  <View style={styles.quoteMain}>
                    <View style={styles.quoteLeft}>
                      <Text style={[styles.quoteNum, { color: colors.text }]}>{quote.quoteNumber}</Text>
                      <Text style={[styles.quoteClient, { color: colors.textSecondary }]}>{quote.clientName}</Text>
                    </View>
                    <View style={styles.quoteRight}>
                      <StatusBadge status={quote.status} />
                      <Text style={[styles.quoteAmount, { color: colors.text }]}>{formatCurrency(quote.totalTTC, cur)}</Text>
                    </View>
                  </View>
                  <View style={styles.quoteMeta}>
                    <Text style={[styles.quoteDate, { color: colors.textTertiary }]}>
                      Émis le {formatDate(quote.issueDate)} · Expire le {formatDate(quote.expirationDate)}
                    </Text>
                    <View style={styles.quoteActions}>
                      {quote.status === 'draft' && (
                        <>
                          <TouchableOpacity onPress={() => openEdit(quote.id)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
                            <Pencil size={12} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setDeleteConfirm(quote.id)} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
                            <XCircle size={12} color={colors.danger} />
                          </TouchableOpacity>
                        </>
                      )}
                      {isExpiring && (
                        <View style={[styles.expiringBadge, { backgroundColor: colors.warningLight }]}>
                          <Text style={[styles.expiringText, { color: colors.warning }]}>
                            Expire dans {remaining}j
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {quote.status === 'accepted' && quote.convertedToInvoiceId && (
                    <View style={[styles.convertedBadge, { backgroundColor: colors.successLight }]}>
                      <CheckCircle size={12} color={colors.success} />
                      <Text style={[styles.convertedText, { color: colors.success }]}>Converti en facture</Text>
                    </View>
                  )}
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
                <Text style={[styles.detailNum, { color: colors.text }]}>{selected.quoteNumber}</Text>
                <StatusBadge status={selected.status} />
              </View>

              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>CLIENT</Text>
                <Text style={[styles.detailText, { color: colors.text }]}>{selected.clientName}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>VALIDITÉ</Text>
                <Text style={[styles.detailText, { color: colors.text }]}>
                  Du {formatDate(selected.issueDate)} au {formatDate(selected.expirationDate)}
                </Text>
                {selected.acceptedAt && (
                  <Text style={[styles.acceptedInfo, { color: colors.success }]}>
                    Accepté le {formatDate(selected.acceptedAt)} {selected.acceptedBy ? `par ${selected.acceptedBy}` : ''}
                  </Text>
                )}
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
              </View>

              {selected.notes ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>NOTES</Text>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>{selected.notes}</Text>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                {selected.status === 'draft' && (
                  <>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => openEdit(selected.id)}>
                      <Pencil size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => setSendConfirm(selected.id)}>
                      <Send size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Envoyer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => setDeleteConfirm(selected.id)}>
                      <XCircle size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Supprimer</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selected.status === 'sent' && (
                  <>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => acceptQuote(selected.id)}>
                      <CheckCircle size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => refuseQuote(selected.id)}>
                      <XCircle size={14} color="#FFF" />
                      <Text style={styles.actionBtnText}>Refuser</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selected.status === 'accepted' && selected.convertedToInvoiceId && (
                  <View style={[styles.actionBtn, { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success + '40' }]}>
                    <CheckCircle size={14} color={colors.success} />
                    <Text style={[styles.actionBtnText, { color: colors.success }]}>Facture créée</Text>
                  </View>
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
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                  onPress={() => duplicateQuote(selected.id)}
                >
                  <Copy size={14} color={colors.text} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Dupliquer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier le devis' : 'Nouveau devis'}
        subtitle={editingId ? 'Modifier le brouillon de devis' : 'Créez un nouveau devis pour un client'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer le devis'}
        width={600}
      >
        <ErrorBanner message={formError} />

        <ClientPicker
          selectedClientId={formClientId}
          onSelect={setFormClientId}
          required
        />

        <View style={{ gap: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>LIGNES DE DEVIS</Text>
          <LineItemsEditor
            items={formItems}
            onItemsChange={setFormItems}
            idPrefix="qi"
            allowedProductTypes={SALES_ALLOWED_TYPES}
          />
          <TotalsSummary items={formItems} compact />
        </View>

        <FormField
          label="Notes"
          value={formNotes}
          onChangeText={setFormNotes}
          placeholder="Notes internes ou conditions..."
          multiline
          numberOfLines={3}
        />
      </FormModal>

      <ConfirmModal
        visible={convertConfirm !== null}
        onClose={() => setConvertConfirm(null)}
        onConfirm={handleConvert}
        title="Convertir en facture ?"
        message="Les lignes du devis seront dupliquées dans une nouvelle facture brouillon. Le devis sera marqué comme converti."
        confirmLabel="Convertir"
      />

      <ConfirmModal
        visible={sendConfirm !== null}
        onClose={() => setSendConfirm(null)}
        onConfirm={handleSend}
        title="Envoyer le devis ?"
        message="Le statut du devis passera à 'Envoyé'. Le client pourra l'accepter ou le refuser."
        confirmLabel="Envoyer"
      />

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteQuote}
        title="Supprimer ce devis ?"
        message="Le devis en brouillon sera définitivement supprimé. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
      />

      <EmailModal
        visible={emailModalVisible}
        onClose={() => { setEmailModalVisible(false); setEmailAttachment(''); }}
        onSubmit={handleSendEmail}
        subtitle="Envoyer ce devis par email au client"
        emailTo={emailTo}
        onEmailToChange={setEmailTo}
        emailSubject={emailSubject}
        onEmailSubjectChange={setEmailSubject}
        emailBody={emailBody}
        onEmailBodyChange={setEmailBody}
        attachment={emailAttachment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16 },
  summaryRow: { flexDirection: 'row' as const, gap: 12 },
  summaryCard: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, padding: 16, gap: 12 },
  summaryIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: '700' as const },
  summaryLabel: { fontSize: 12, marginTop: 2 },

  mainContent: { flex: 1, flexDirection: 'row' as const, gap: 16 },
  tableCard: { flex: 1, borderWidth: 1, borderRadius: 12, overflow: 'hidden' as const },

  quoteRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  quoteMain: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const },
  quoteLeft: { flex: 1 },
  quoteNum: { fontSize: 14, fontWeight: '600' as const },
  quoteClient: { fontSize: 13, marginTop: 2 },
  quoteRight: { alignItems: 'flex-end' as const, gap: 6 },
  quoteAmount: { fontSize: 15, fontWeight: '700' as const },
  quoteMeta: { marginTop: 8, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  quoteDate: { fontSize: 12 },
  quoteActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6 },
  expiringBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  expiringText: { fontSize: 11, fontWeight: '600' as const },
  convertedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' as const },
  convertedText: { fontSize: 11, fontWeight: '600' as const },
  detailPanel: { width: 380, borderWidth: 1, borderRadius: 12, padding: 24 },
  detailHeader: { alignItems: 'center' as const, marginBottom: 20, gap: 8 },
  detailIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  detailNum: { fontSize: 18, fontWeight: '700' as const },
  detailDivider: { height: 1, marginBottom: 16 },
  detailSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 8 },
  detailText: { fontSize: 14, fontWeight: '500' as const },
  acceptedInfo: { fontSize: 12, fontWeight: '500' as const, marginTop: 4 },
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
  actionRow: { flexDirection: 'row' as const, gap: 8 },
  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, flex: 1, justifyContent: 'center' as const },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },

});
