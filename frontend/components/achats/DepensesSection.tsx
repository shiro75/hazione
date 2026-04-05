/**
 * components/achats/DepensesSection.tsx
 * Section Notes de frais / Dépenses.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Search, Plus, FileText, X, Trash2, ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrency } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import DatePickerField from '@/components/DatePickerField';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import { Download } from 'lucide-react-native';
import type { ExpenseType, ExpenseStatus } from '@/types';
import { styles } from './achatsStyles';

const EXPENSE_TYPES: { value: ExpenseType; labelKey: string }[] = [
  { value: 'note_de_frais', labelKey: 'expenses.noteDefrais' },
  { value: 'salaire', labelKey: 'expenses.salaire' },
  { value: 'loyer', labelKey: 'expenses.loyer' },
  { value: 'assurance', labelKey: 'expenses.assurance' },
  { value: 'fournitures', labelKey: 'expenses.fournitures' },
  { value: 'transport', labelKey: 'expenses.transport' },
  { value: 'marketing', labelKey: 'expenses.marketing' },
  { value: 'abonnement', labelKey: 'expenses.abonnement' },
  { value: 'taxes', labelKey: 'expenses.taxes' },
  { value: 'autre', labelKey: 'expenses.autre' },
];

const EXPENSE_STATUSES: { value: ExpenseStatus; labelKey: string }[] = [
  { value: 'pending', labelKey: 'expenses.pending' },
  { value: 'approved', labelKey: 'expenses.approved' },
  { value: 'paid', labelKey: 'expenses.paid' },
  { value: 'rejected', labelKey: 'expenses.rejected' },
];

const EXPENSE_PAYMENT_METHODS = [
  { value: 'cash', label: 'Espèces' }, { value: 'card', label: 'Carte bancaire' },
  { value: 'transfer', label: 'Virement' }, { value: 'check', label: 'Chèque' },
  { value: 'other', label: 'Autre' },
];

export default function DepensesSection() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activeExpenses, createExpense, updateExpense, deleteExpense, company } = useData();
  const cur = company.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [_formError, setFormError] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [form, setForm] = useState({
    expenseType: 'autre' as ExpenseType,
    description: '', amount: 0, vatAmount: 0, vatRate: 20,
    date: new Date().toISOString(), supplierName: '', reference: '',
    paymentMethod: 'cash', status: 'pending' as ExpenseStatus, notes: '',
  });

  const filtered = useMemo(() => {
    let list = activeExpenses;
    if (search) { const q = search.toLowerCase(); list = list.filter((e) => e.description.toLowerCase().includes(q) || e.supplierName.toLowerCase().includes(q) || e.reference.toLowerCase().includes(q)); }
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeExpenses, search]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ expenseType: 'autre', description: '', amount: 0, vatAmount: 0, vatRate: 20, date: new Date().toISOString(), supplierName: '', reference: '', paymentMethod: 'cash', status: 'pending', notes: '' });
    setFormError(''); setFormVisible(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    const e = activeExpenses.find((exp) => exp.id === id);
    if (!e) return;
    setEditingId(id);
    setForm({ expenseType: e.expenseType, description: e.description, amount: e.amount, vatAmount: e.vatAmount, vatRate: e.vatRate, date: e.date, supplierName: e.supplierName, reference: e.reference, paymentMethod: e.paymentMethod, status: e.status, notes: e.notes });
    setFormError(''); setFormVisible(true);
  }, [activeExpenses]);

  const handleSubmit = useCallback(() => {
    const result = editingId ? updateExpense(editingId, form) : createExpense(form);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createExpense, updateExpense]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { deleteExpense(deleteConfirm); setDeleteConfirm(null); }
  }, [deleteConfirm, deleteExpense]);

  const getTypeLabel = useCallback((type: ExpenseType) => {
    const found = EXPENSE_TYPES.find((et) => et.value === type);
    return found ? t(found.labelKey) : type;
  }, [t]);

  const getStatusLabel = useCallback((status: ExpenseStatus) => {
    const found = EXPENSE_STATUSES.find((s) => s.value === status);
    return found ? t(found.labelKey) : status;
  }, [t]);

  const totalExpenses = useMemo(() => activeExpenses.reduce((s, e) => s + e.amount, 0), [activeExpenses]);

  return (
    <>
      {/* KPIs */}
      <View style={[styles.searchRow, { marginBottom: 8 }]}>
        <View style={[{ backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }]}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Total dépenses</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.danger }}>{formatCurrency(totalExpenses, cur)}</Text>
        </View>
        <View style={[{ backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }]}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Nombre</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{activeExpenses.length}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder={t('expenses.search')} placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
          {search.length > 0 ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><X size={16} color={colors.textTertiary} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => { const cols: ExportColumn<Record<string, unknown>>[] = [{ key: 'description', label: 'Description' }, { key: 'expenseType', label: 'Type' }, { key: 'amount', label: 'Montant' }, { key: 'date', label: 'Date' }, { key: 'supplierName', label: 'Fournisseur' }, { key: 'status', label: 'Statut' }]; void exportToCSV(activeExpenses.map((e) => ({ ...e } as unknown as Record<string, unknown>)), cols, `depenses_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.primary }]} onPress={openCreate}><Plus size={16} color="#FFF" /></TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><FileText size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{search ? 'Aucun résultat' : t('expenses.noExpenses')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{search ? 'Essayez un autre terme' : t('expenses.addFirst')}</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((expense, idx) => (
            <TouchableOpacity key={expense.id} style={[styles.listRow, idx < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(expense.id)} activeOpacity={0.7}>
              <View style={styles.listRowMain}>
                <View style={styles.listRowInfo}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]}>{expense.description || 'Sans description'}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textSecondary }]}>{getTypeLabel(expense.expenseType)}{expense.supplierName ? ` — ${expense.supplierName}` : ''}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{new Date(expense.date).toLocaleDateString('fr-FR')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.listRowValue, { color: colors.danger }]}>{formatCurrency(expense.amount, cur)}</Text>
                  <StatusBadge status={getStatusLabel(expense.status)} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Formulaire CRUD dépense */}
      <FormModal visible={formVisible} onClose={() => setFormVisible(false)} title={editingId ? t('expenses.edit') : t('expenses.new')} onSubmit={handleSubmit}
        headerActions={editingId ? <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={{ padding: 6 }}><Trash2 size={18} color={colors.danger} /></TouchableOpacity> : undefined}
      >
        {/* Type */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>{t('expenses.type')}</Text>
          <TouchableOpacity style={[styles.formPickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setShowTypePicker((p) => !p)}>
            <Text style={{ color: colors.text, fontSize: 14 }}>{getTypeLabel(form.expenseType)}</Text>
            <ChevronDown size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          {showTypePicker ? (
            <View style={[styles.formPickerDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              {EXPENSE_TYPES.map((et) => (
                <TouchableOpacity key={et.value} style={[styles.formPickerOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setForm((p) => ({ ...p, expenseType: et.value })); setShowTypePicker(false); }}>
                  <Text style={{ fontSize: 13, color: form.expenseType === et.value ? colors.primary : colors.text }}>{t(et.labelKey)}</Text>
                  {form.expenseType === et.value ? <Check size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
        <FormField label={t('expenses.description')} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} required />
        <FormField label={t('expenses.amount')} value={form.amount > 0 ? String(form.amount) : ''} onChangeText={(v) => setForm((p) => ({ ...p, amount: parseFloat(v.replace(/,/g, '.')) || 0 }))} keyboardType="decimal-pad" />
        <FormField label={t('expenses.vatRate')} value={String(form.vatRate)} onChangeText={(v) => setForm((p) => ({ ...p, vatRate: parseFloat(v.replace(/,/g, '.')) || 0 }))} keyboardType="decimal-pad" />
        <FormField label={t('expenses.vatAmount')} value={form.vatAmount > 0 ? String(form.vatAmount) : ''} onChangeText={(v) => setForm((p) => ({ ...p, vatAmount: parseFloat(v.replace(/,/g, '.')) || 0 }))} keyboardType="decimal-pad" />
        <DatePickerField label={t('expenses.date')} value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} />
        <FormField label={t('expenses.supplier')} value={form.supplierName} onChangeText={(v) => setForm((p) => ({ ...p, supplierName: v }))} />
        <FormField label={t('expenses.reference')} value={form.reference} onChangeText={(v) => setForm((p) => ({ ...p, reference: v }))} />
        {/* Mode de paiement */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>{t('expenses.paymentMethod')}</Text>
          <TouchableOpacity style={[styles.formPickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setShowPaymentPicker((p) => !p)}>
            <Text style={{ color: colors.text, fontSize: 14 }}>{EXPENSE_PAYMENT_METHODS.find((m) => m.value === form.paymentMethod)?.label || form.paymentMethod}</Text>
            <ChevronDown size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          {showPaymentPicker ? (
            <View style={[styles.formPickerDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              {EXPENSE_PAYMENT_METHODS.map((pm) => (
                <TouchableOpacity key={pm.value} style={[styles.formPickerOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setForm((p) => ({ ...p, paymentMethod: pm.value })); setShowPaymentPicker(false); }}>
                  <Text style={{ fontSize: 13, color: form.paymentMethod === pm.value ? colors.primary : colors.text }}>{pm.label}</Text>
                  {form.paymentMethod === pm.value ? <Check size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
        {/* Statut */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>{t('expenses.status')}</Text>
          <TouchableOpacity style={[styles.formPickerBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={() => setShowStatusPicker((p) => !p)}>
            <Text style={{ color: colors.text, fontSize: 14 }}>{getStatusLabel(form.status)}</Text>
            <ChevronDown size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          {showStatusPicker ? (
            <View style={[styles.formPickerDropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
              {EXPENSE_STATUSES.map((st) => (
                <TouchableOpacity key={st.value} style={[styles.formPickerOption, { borderBottomColor: colors.borderLight }]} onPress={() => { setForm((p) => ({ ...p, status: st.value })); setShowStatusPicker(false); }}>
                  <Text style={{ fontSize: 13, color: form.status === st.value ? colors.primary : colors.text }}>{t(st.labelKey)}</Text>
                  {form.status === st.value ? <Check size={14} color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
        <FormField label={t('expenses.notes')} value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal visible={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t('expenses.delete')} message={t('expenses.deleteMsg')} onConfirm={handleDelete} confirmLabel="Supprimer" destructive />
    </>
  );
}