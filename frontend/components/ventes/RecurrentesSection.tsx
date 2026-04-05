/**
 * components/ventes/RecurrentesSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Plus, RefreshCw, Check, X, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ClientPicker from '@/components/ClientPicker';
import LineItemsEditor, { type LineItem } from '@/components/LineItemsEditor';
import TotalsSummary from '@/components/TotalsSummary';
import DropdownPicker from '@/components/DropdownPicker';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import type { OrderItem, RecurringFrequency } from '@/types';
import { styles } from './ventesStyles';

const FREQ_OPTIONS: { label: string; value: RecurringFrequency }[] = [
  { label: 'Mensuelle', value: 'monthly' },
  { label: 'Trimestrielle', value: 'quarterly' },
  { label: 'Annuelle', value: 'yearly' },
];

const getFreqLabel = (f: string) => {
  switch (f) {
    case 'monthly': return 'Mensuelle';
    case 'quarterly': return 'Trimestrielle';
    case 'yearly': return 'Annuelle';
    default: return f;
  }
};

export default function RecurrentesSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { recurringInvoices, createRecurringInvoice, toggleRecurringInvoice, generateRecurringInvoice, deleteRecurringInvoice, activeClients, showToast, company } = useData();
  const cur = company.currency || 'EUR';
  const [formVisible, setFormVisible] = useState(false);
  const [formClientId, setFormClientId] = useState('');
  const [formItems, setFormItems] = useState<LineItem[]>([]);
  const [formFrequency, setFormFrequency] = useState<RecurringFrequency>('monthly');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const openCreate = useCallback(() => {
    setFormClientId(activeClients.length > 0 ? activeClients[0].id : '');
    setFormItems([]); setFormFrequency('monthly'); setFormStartDate(new Date().toISOString().slice(0, 10)); setFormNotes(''); setFormError('');
    setFormVisible(true);
  }, [activeClients]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Sélectionnez un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }
    const items: OrderItem[] = formItems.map((li) => ({ id: li.id, orderId: '', productId: li.productId, productName: li.productName, quantity: li.quantity, unitPrice: li.unitPrice, vatRate: li.vatRate, totalHT: li.totalHT, totalTVA: li.totalTVA, totalTTC: li.totalTTC }));
    const result = createRecurringInvoice({ clientId: formClientId, items, frequency: formFrequency, startDate: formStartDate, notes: formNotes });
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formClientId, formItems, formFrequency, formStartDate, formNotes, createRecurringInvoice]);

  return (
    <View testID="recurrentes-section">
      <View style={styles.searchRow}>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" /><Text style={styles.addBtnText}>Nouvelle récurrence</Text>
        </TouchableOpacity>
      </View>

      {recurringInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><RefreshCw size={28} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture récurrente</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Automatisez vos factures périodiques</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {recurringInvoices.map((ri, i) => (
            <View key={ri.id} style={[styles.listRow, i < recurringInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
              <View style={styles.listRowMain}>
                <View style={styles.listRowInfo}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]}>{ri.clientName}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{getFreqLabel(ri.frequency)} · Prochaine : {formatDate(ri.nextGenerationDate)}</Text>
                </View>
                <View style={[styles.convertedBadge, { backgroundColor: ri.status === 'active' ? colors.successLight : colors.warningLight }]}>
                  <Text style={[styles.convertedBadgeText, { color: ri.status === 'active' ? colors.success : colors.warning }]}>{ri.status === 'active' ? 'Active' : 'Pausée'}</Text>
                </View>
                <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(ri.totalTTC, cur)}</Text>
                <View style={styles.listRowActions}>
                  <TouchableOpacity onPress={() => toggleRecurringInvoice(ri.id)} style={[styles.iconBtn, { backgroundColor: ri.status === 'active' ? colors.warningLight : colors.successLight }]}>
                    {ri.status === 'active' ? <X size={13} color={colors.warning} /> : <Check size={13} color={colors.success} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const r = generateRecurringInvoice(ri.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.validateBtn, { backgroundColor: colors.primary }]}>
                    <Plus size={13} color="#FFF" /><Text style={styles.validateBtnText}>Générer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRecurringInvoice(ri.id)} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
                    <Trash2 size={13} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <FormModal visible={formVisible} onClose={() => setFormVisible(false)} title="Nouvelle facture récurrente" subtitle="Modèle de facturation périodique" onSubmit={handleSubmit} submitLabel="Créer le modèle" width={600}>
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        <ClientPicker selectedClientId={formClientId} onSelect={setFormClientId} required />
        <DropdownPicker label="Fréquence" value={formFrequency} options={FREQ_OPTIONS.map((o) => ({ label: o.label, value: o.value }))} onSelect={(v) => setFormFrequency(v as RecurringFrequency)} required />
        <FormField label="Date de début" value={formStartDate} onChangeText={setFormStartDate} placeholder="AAAA-MM-JJ" />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
          <LineItemsEditor items={formItems} onItemsChange={setFormItems} idPrefix="ri" allowedProductTypes={SALES_ALLOWED_TYPES} />
          <TotalsSummary items={formItems} compact />
        </View>
        <FormField label="Notes" value={formNotes} onChangeText={setFormNotes} placeholder="Notes..." multiline numberOfLines={2} />
      </FormModal>
    </View>
  );
}