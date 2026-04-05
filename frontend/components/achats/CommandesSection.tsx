/**
 * components/achats/FournisseursSection.tsx
 * Section Fournisseurs — CRUD, tri, import/export CSV, historique.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Search, Plus, Truck, ArrowUpDown, X, Clock, Trash2, Upload, Download, Copy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatPhone } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import UniversalImportModal from '@/components/UniversalImportModal';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import type { Supplier } from '@/types';
import SupplierHistoryModal from './SupplierHistoryModal';
import { styles } from './achatsStyles';

type SupplierSortKey = 'az' | 'za' | 'date' | 'amount';
const SUPPLIER_SORT_OPTIONS: { value: SupplierSortKey; label: string }[] = [
  { value: 'az', label: 'A → Z' }, { value: 'za', label: 'Z → A' },
  { value: 'date', label: 'Date' }, { value: 'amount', label: 'Montant' },
];

export default function FournisseursSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    activeSuppliers, createSupplier, updateSupplier, deleteSupplier,
    activePurchaseOrders, activeSupplierInvoices, cashMovements, company,
  } = useData();
  const cur = company.currency || 'EUR';

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SupplierSortKey>('az');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [csvImportVisible, setCsvImportVisible] = useState(false);
  const [form, setForm] = useState({
    companyName: '', email: '', phone: '', address: '', city: '',
    postalCode: '', country: 'France', vatNumber: '', siret: '',
    notes: '', paymentConditions: '',
  });

  const supplierOrderCount = useMemo(() => {
    const counts: Record<string, number> = {};
    activePurchaseOrders.forEach((po) => { counts[po.supplierId] = (counts[po.supplierId] || 0) + 1; });
    return counts;
  }, [activePurchaseOrders]);

  const supplierTotalAmount = useMemo(() => {
    const totals: Record<string, number> = {};
    activePurchaseOrders.forEach((po) => { totals[po.supplierId] = (totals[po.supplierId] || 0) + po.total; });
    return totals;
  }, [activePurchaseOrders]);

  const filtered = useMemo(() => {
    let list = activeSuppliers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.companyName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'az': return a.companyName.localeCompare(b.companyName);
        case 'za': return b.companyName.localeCompare(a.companyName);
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'amount': return (supplierTotalAmount[b.id] || 0) - (supplierTotalAmount[a.id] || 0);
        default: return 0;
      }
    });
  }, [activeSuppliers, search, sortBy, supplierTotalAmount]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ companyName: '', email: '', phone: '', address: '', city: '', postalCode: '', country: 'France', vatNumber: '', siret: '', notes: '', paymentConditions: '' });
    setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    const s = activeSuppliers.find((sup) => sup.id === id);
    if (!s) return;
    setEditingId(id);
    setForm({ companyName: s.companyName, email: s.email, phone: s.phone, address: s.address, city: s.city, postalCode: s.postalCode, country: s.country, vatNumber: s.vatNumber || '', siret: s.siret || '', notes: s.notes, paymentConditions: s.paymentConditions });
    setFormError('');
    setFormVisible(true);
  }, [activeSuppliers]);

  const handleSubmit = useCallback(() => {
    const result = editingId ? updateSupplier(editingId, form) : createSupplier(form);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createSupplier, updateSupplier]);

  const handleDuplicate = useCallback(() => {
    if (!editingId) return;
    const supplier = activeSuppliers.find((s) => s.id === editingId);
    if (!supplier) return;
    const result = createSupplier({ ...form, companyName: supplier.companyName + ' - Copy' });
    if (result.success) setFormVisible(false);
  }, [editingId, activeSuppliers, form, createSupplier]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { deleteSupplier(deleteConfirm); setDeleteConfirm(null); }
  }, [deleteConfirm, deleteSupplier]);

  return (
    <>
      {/* Barre recherche + actions */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Rechercher un fournisseur..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><X size={16} color={colors.textTertiary} /></TouchableOpacity>}
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setCsvImportVisible(true)}><Upload size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => { const cols: ExportColumn<Record<string, unknown>>[] = [{ key: 'companyName', label: 'Nom entreprise' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Téléphone' }, { key: 'address', label: 'Adresse' }, { key: 'city', label: 'Ville' }, { key: 'postalCode', label: 'Code postal' }, { key: 'country', label: 'Pays' }, { key: 'vatNumber', label: 'N° TVA' }, { key: 'siret', label: 'SIRET' }, { key: 'paymentConditions', label: 'Conditions paiement' }]; void exportToCSV(activeSuppliers.map((s) => ({ ...s } as unknown as Record<string, unknown>)), cols, `fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`); }}><Download size={16} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.primary }]} onPress={openCreate}><Plus size={16} color="#FFF" /></TouchableOpacity>
      </View>

      {/* Tri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDown size={13} color={colors.textTertiary} />
        {SUPPLIER_SORT_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Truck size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{search ? 'Aucun résultat' : 'Aucun fournisseur pour l\'instant'}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{search ? 'Essayez un autre terme de recherche' : 'Ajoutez vos fournisseurs pour gérer vos achats'}</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile && (
            <View style={[styles.supplierHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.supplierColHeader, { flex: 2, color: colors.textTertiary }]}>Fournisseur</Text>
              <Text style={[styles.supplierColHeader, { flex: 2, color: colors.textTertiary }]}>Contact</Text>
              <Text style={[styles.supplierColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' }]}>Commandes</Text>
              <Text style={[styles.supplierColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' }]}>Total</Text>
            </View>
          )}
          {filtered.map((supplier, i) => {
            const orderCount = supplierOrderCount[supplier.id] || 0;
            const totalAmount = supplierTotalAmount[supplier.id] || 0;
            return isMobile ? (
              <TouchableOpacity key={supplier.id} style={[styles.listRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(supplier.id)} activeOpacity={0.7}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{supplier.companyName}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{supplier.email || '—'} · {formatPhone(supplier.phone)}</Text>
                  </View>
                </View>
                <View style={styles.supplierMobileStats}>
                  <Text style={[styles.supplierMobileStatText, { color: colors.textTertiary }]}>{orderCount} cmd.</Text>
                  <Text style={[styles.supplierMobileStatText, { color: colors.success, fontWeight: '600' }]}>{formatCurrency(totalAmount, cur)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={supplier.id} style={[styles.supplierRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(supplier.id)} activeOpacity={0.7}>
                <View style={{ flex: 2 }}><Text style={[styles.listRowTitle, { color: colors.text }]} numberOfLines={1}>{supplier.companyName}</Text><Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{supplier.city || '—'}</Text></View>
                <View style={{ flex: 2 }}><Text style={[styles.supplierContactText, { color: colors.text }]} numberOfLines={1}>{supplier.email || '—'}</Text><Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{formatPhone(supplier.phone)}</Text></View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}><View style={[styles.supplierStatBadge, { backgroundColor: colors.primaryLight }]}><Text style={[styles.supplierStatText, { color: colors.primary }]}>{orderCount}</Text></View></View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[styles.supplierAmountText, { color: colors.success }]}>{formatCurrency(totalAmount, cur)}</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Formulaire */}
      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer'}
        headerActions={editingId ? (
          <>
            <TouchableOpacity onPress={handleDuplicate} style={[styles.iconBtn, { backgroundColor: '#E8F5E9' }]}><Copy size={15} color="#2E7D32" /></TouchableOpacity>
            <TouchableOpacity onPress={() => { const s = activeSuppliers.find((sup) => sup.id === editingId); if (s) { setFormVisible(false); setHistorySupplier(s); setHistoryVisible(true); } }} style={[styles.iconBtn, { backgroundColor: '#E0F2FE' }]}><Clock size={15} color="#0369A1" /></TouchableOpacity>
            <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}><Trash2 size={15} color={colors.danger} /></TouchableOpacity>
          </>
        ) : undefined}
      >
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        <FormField label="Nom de l'entreprise" value={form.companyName} onChangeText={(v) => setForm((p) => ({ ...p, companyName: v }))} placeholder="Nom du fournisseur" required />
        <FormField label="Email" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" />
        <PhoneField value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />
        <AddressFields address={form.address} postalCode={form.postalCode} city={form.city} country={form.country} onAddressChange={(v) => setForm((p) => ({ ...p, address: v }))} onPostalCodeChange={(v) => setForm((p) => ({ ...p, postalCode: v }))} onCityChange={(v) => setForm((p) => ({ ...p, city: v }))} onCountryChange={(v) => setForm((p) => ({ ...p, country: v }))} />
        <View style={styles.formRow}>
          <View style={styles.formCol}><FormField label="N° TVA" value={form.vatNumber} onChangeText={(v) => setForm((p) => ({ ...p, vatNumber: v }))} placeholder="FR12345678901" /></View>
          <View style={styles.formCol}><FormField label="SIRET" value={form.siret} onChangeText={(v) => setForm((p) => ({ ...p, siret: v }))} placeholder="12345678901234" /></View>
        </View>
        <FormField label="Conditions de paiement" value={form.paymentConditions} onChangeText={(v) => setForm((p) => ({ ...p, paymentConditions: v }))} placeholder="ex: 30 jours net" />
        <FormField label="Notes" value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Notes..." multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal visible={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="Supprimer ce fournisseur ?" message="Le fournisseur sera marqué comme supprimé." confirmLabel="Supprimer" destructive />

      <UniversalImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        title="Importer des fournisseurs"
        entityLabel="fournisseur"
        fields={[
          { key: 'companyName', label: 'Nom entreprise', required: true, aliases: ['entreprise', 'société', 'raison sociale'] },
          { key: 'email', label: 'Email', aliases: ['e-mail', 'mail'] },
          { key: 'phone', label: 'Téléphone', aliases: ['tel', 'portable'] },
          { key: 'address', label: 'Adresse', aliases: ['rue'] },
          { key: 'city', label: 'Ville' }, { key: 'postalCode', label: 'Code postal', aliases: ['cp', 'zip'] },
          { key: 'country', label: 'Pays' }, { key: 'vatNumber', label: 'N° TVA', aliases: ['tva', 'vat'] },
          { key: 'siret', label: 'SIRET' }, { key: 'notes', label: 'Notes', aliases: ['commentaire'] },
          { key: 'paymentConditions', label: 'Conditions paiement', aliases: ['conditions', 'paiement'] },
        ]}
        pastePlaceholder={"Nom entreprise;Email;Téléphone;Adresse;Ville;Code postal;Pays\nFournisseur A;contact@fournisseur.com;+33612345678;10 rue Nationale;Lyon;69001;France"}
        onImport={(rows) => {
          let imported = 0;
          const errors: string[] = [];
          rows.forEach((row, idx) => {
            if (!row.companyName?.trim()) { errors.push(`Ligne ${idx + 1}: Nom entreprise requis`); return; }
            const result = createSupplier({ companyName: row.companyName.trim(), email: row.email || '', phone: row.phone || '', address: row.address || '', city: row.city || '', postalCode: row.postalCode || '', country: row.country || 'France', vatNumber: row.vatNumber || '', siret: row.siret || '', notes: row.notes || '', paymentConditions: row.paymentConditions || '' });
            if (result.success) imported++;
            else errors.push(`Ligne ${idx + 1}: ${result.error || 'Erreur'}`);
          });
          return { imported, errors };
        }}
      />

      {historySupplier && (
        <SupplierHistoryModal
          visible={historyVisible}
          onClose={() => { setHistoryVisible(false); setHistorySupplier(null); }}
          supplier={historySupplier}
          purchaseOrders={activePurchaseOrders}
          supplierInvoices={activeSupplierInvoices}
          cashMovements={cashMovements}
          currency={cur}
          onNavigate={(route) => { setHistoryVisible(false); setHistorySupplier(null); router.push(route as any); }}
        />
      )}
    </>
  );
}