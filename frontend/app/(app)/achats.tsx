/**
 * @fileoverview Purchases management screen with tabs: Suppliers, Purchase Orders,
 * and Expense tracking. Supports OCR invoice import, supplier CRUD, and expense categorization.
 *
 * NOTE: String-based conditional rendering uses ternary (value ? <JSX> : null)
 * to avoid React Native Web "Unexpected text node" errors.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions, Platform, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Search, Plus, Truck, FileText, ShoppingCart, X, Trash2,
  Check, ArrowRight, PackageCheck, Clock, ChevronDown, ChevronUp, Upload, Download, ArrowUpDown, Paperclip, UserPlus, Ban, Copy,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import type { Supplier } from '@/types';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import DatePickerField from '@/components/DatePickerField';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import InvoiceImportSection, { OcrFieldIndicator } from '@/components/InvoiceImportSection';
import type { ParsedInvoiceData } from '@/services/ocrService';
import { supabase } from '@/services/supabase';
import { useI18n } from '@/contexts/I18nContext';
import UniversalImportModal from '@/components/UniversalImportModal';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';

type AchatsTab = 'fournisseurs' | 'commandes' | 'factures';

const TAB_KEYS: { key: AchatsTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'fournisseurs', labelKey: 'purchases.suppliers', icon: Truck },
  { key: 'commandes', labelKey: 'purchases.orders', icon: ShoppingCart },
  { key: 'factures', labelKey: 'purchases.receivedInvoices', icon: FileText },
];

export default function AchatsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { canAccess } = useRole();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string; selectedId?: string }>();
  const [activeTab, setActiveTab] = useState<AchatsTab>('fournisseurs');
  const [_highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  if (!canAccess('achats')) {
    return <AccessDenied />;
  }

  useEffect(() => {
    if (params.tab && TAB_KEYS.some(tk => tk.key === params.tab)) {
      setActiveTab(params.tab as AchatsTab);
    }
    if (params.selectedId) {
      setHighlightedId(params.selectedId);
    }
  }, [params.tab, params.selectedId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title={t('purchases.title')} />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{t(tab.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'fournisseurs' && <FournisseursSection isMobile={isMobile} />}
        {activeTab === 'commandes' && <CommandesSection isMobile={isMobile} />}
        {activeTab === 'factures' && <FacturesRecuesSection isMobile={isMobile} />}
      </ScrollView>
    </View>
  );
}

type SupplierSortKey = 'az' | 'za' | 'date' | 'amount';
const SUPPLIER_SORT_OPTIONS: { value: SupplierSortKey; label: string }[] = [
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Montant' },
];

function FournisseursSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { activeSuppliers, createSupplier, updateSupplier, deleteSupplier, activePurchaseOrders, activeSupplierInvoices, cashMovements, company } = useData();
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
    activePurchaseOrders.forEach(po => { counts[po.supplierId] = (counts[po.supplierId] || 0) + 1; });
    return counts;
  }, [activePurchaseOrders]);

  const supplierTotalAmount = useMemo(() => {
    const totals: Record<string, number> = {};
    activePurchaseOrders.forEach(po => { totals[po.supplierId] = (totals[po.supplierId] || 0) + po.total; });
    return totals;
  }, [activePurchaseOrders]);

  const filtered = useMemo(() => {
    let list = activeSuppliers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.companyName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
      );
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
    setForm({
      companyName: s.companyName, email: s.email, phone: s.phone, address: s.address,
      city: s.city, postalCode: s.postalCode, country: s.country,
      vatNumber: s.vatNumber || '', siret: s.siret || '', notes: s.notes,
      paymentConditions: s.paymentConditions,
    });
    setFormError('');
    setFormVisible(true);
  }, [activeSuppliers]);

  const handleSubmit = useCallback(() => {
    const result = editingId
      ? updateSupplier(editingId, form)
      : createSupplier(form);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createSupplier, updateSupplier]);

  const handleDuplicate = useCallback(() => {
    if (!editingId) return;
    const supplier = activeSuppliers.find(s => s.id === editingId);
    if (!supplier) return;
    const data = {
      companyName: supplier.companyName + ' - Copy',
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      postalCode: supplier.postalCode,
      country: supplier.country,
      vatNumber: supplier.vatNumber || '',
      siret: supplier.siret || '',
      notes: supplier.notes,
      paymentConditions: supplier.paymentConditions,
    };
    const result = createSupplier(data);
    if (result.success) {
      setFormVisible(false);
    }
  }, [editingId, activeSuppliers, createSupplier]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteSupplier(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteSupplier]);

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher un fournisseur..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setCsvImportVisible(true)}>
          <Upload size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'companyName', label: 'Nom entreprise' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Téléphone' },
              { key: 'address', label: 'Adresse' },
              { key: 'city', label: 'Ville' },
              { key: 'postalCode', label: 'Code postal' },
              { key: 'country', label: 'Pays' },
              { key: 'vatNumber', label: 'N° TVA' },
              { key: 'siret', label: 'SIRET' },
              { key: 'paymentConditions', label: 'Conditions paiement' },
            ];
            const data = activeSuppliers.map(s => ({ ...s } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `fournisseurs_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDown size={13} color={colors.textTertiary} />
        {SUPPLIER_SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setSortBy(opt.value)}
          >
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Truck size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {search ? 'Aucun résultat' : 'Aucun fournisseur pour l’instant'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            {search ? 'Essayez un autre terme de recherche' : 'Ajoutez vos fournisseurs pour gérer vos achats'}
          </Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile && (
            <View style={[styles.supplierHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.supplierColHeader, { flex: 2, color: colors.textTertiary }]}>Fournisseur</Text>
              <Text style={[styles.supplierColHeader, { flex: 2, color: colors.textTertiary }]}>Contact</Text>
              <Text style={[styles.supplierColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' as const }]}>Commandes</Text>
              <Text style={[styles.supplierColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' as const }]}>Total</Text>
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
                  <Text style={[styles.supplierMobileStatText, { color: colors.success, fontWeight: '600' as const }]}>{formatCurrency(totalAmount, cur)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={supplier.id} style={[styles.supplierRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(supplier.id)} activeOpacity={0.7}>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]} numberOfLines={1}>{supplier.companyName}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{supplier.city || '—'}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.supplierContactText, { color: colors.text }]} numberOfLines={1}>{supplier.email || '—'}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{formatPhone(supplier.phone)}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' as const }}>
                  <View style={[styles.supplierStatBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.supplierStatText, { color: colors.primary }]}>{orderCount}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' as const }}>
                  <Text style={[styles.supplierAmountText, { color: colors.success }]}>{formatCurrency(totalAmount, cur)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer'}
        headerActions={editingId ? (
          <>
            <TouchableOpacity onPress={handleDuplicate} style={[styles.iconBtn, { backgroundColor: '#E8F5E9' }]}>
              <Copy size={15} color="#2E7D32" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const s = activeSuppliers.find(sup => sup.id === editingId); if (s) { setFormVisible(false); setHistorySupplier(s); setHistoryVisible(true); } }} style={[styles.iconBtn, { backgroundColor: '#E0F2FE' }]}>
              <Clock size={15} color="#0369A1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
              <Trash2 size={15} color={colors.danger} />
            </TouchableOpacity>
          </>
        ) : undefined}
      >
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}
        <FormField label="Nom de l'entreprise" value={form.companyName} onChangeText={(v) => setForm((p) => ({ ...p, companyName: v }))} placeholder="Nom du fournisseur" required />
        <FormField label="Email" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" />
        <PhoneField value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />
        <AddressFields
          address={form.address}
          postalCode={form.postalCode}
          city={form.city}
          country={form.country}
          onAddressChange={(v) => setForm((p) => ({ ...p, address: v }))}
          onPostalCodeChange={(v) => setForm((p) => ({ ...p, postalCode: v }))}
          onCityChange={(v) => setForm((p) => ({ ...p, city: v }))}
          onCountryChange={(v) => setForm((p) => ({ ...p, country: v }))}
        />
        <View style={styles.formRow}>
          <View style={styles.formCol}><FormField label="N° TVA" value={form.vatNumber} onChangeText={(v) => setForm((p) => ({ ...p, vatNumber: v }))} placeholder="FR12345678901" /></View>
          <View style={styles.formCol}><FormField label="SIRET" value={form.siret} onChangeText={(v) => setForm((p) => ({ ...p, siret: v }))} placeholder="12345678901234" /></View>
        </View>
        <FormField label="Conditions de paiement" value={form.paymentConditions} onChangeText={(v) => setForm((p) => ({ ...p, paymentConditions: v }))} placeholder="ex: 30 jours net" />
        <FormField label="Notes" value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Notes..." multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer ce fournisseur ?"
        message="Le fournisseur sera marqué comme supprimé."
        confirmLabel="Supprimer"
        destructive
      />

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
          { key: 'city', label: 'Ville' },
          { key: 'postalCode', label: 'Code postal', aliases: ['cp', 'zip'] },
          { key: 'country', label: 'Pays' },
          { key: 'vatNumber', label: 'N° TVA', aliases: ['tva', 'vat'] },
          { key: 'siret', label: 'SIRET' },
          { key: 'notes', label: 'Notes', aliases: ['commentaire'] },
          { key: 'paymentConditions', label: 'Conditions paiement', aliases: ['conditions', 'paiement'] },
        ]}
        pastePlaceholder={"Nom entreprise;Email;Téléphone;Adresse;Ville;Code postal;Pays\nFournisseur A;contact@fournisseur.com;+33612345678;10 rue Nationale;Lyon;69001;France"}
        onImport={(rows: Record<string, string>[]) => {
          let imported = 0;
          const errors: string[] = [];
          rows.forEach((row: Record<string, string>, idx: number) => {
            if (!row.companyName?.trim()) { errors.push(`Ligne ${idx + 1}: Nom entreprise requis`); return; }
            const result = createSupplier({
              companyName: row.companyName.trim(),
              email: row.email || '',
              phone: row.phone || '',
              address: row.address || '',
              city: row.city || '',
              postalCode: row.postalCode || '',
              country: row.country || 'France',
              vatNumber: row.vatNumber || '',
              siret: row.siret || '',
              notes: row.notes || '',
              paymentConditions: row.paymentConditions || '',
            });
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
          onNavigate={(route: string) => {
            setHistoryVisible(false);
            setHistorySupplier(null);
            router.push(route as any);
          }}
        />
      )}
    </>
  );
}

function SupplierHistoryModal({
  visible, onClose, supplier, purchaseOrders, supplierInvoices, cashMovements, currency, onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  supplier: Supplier;
  purchaseOrders: any[];
  supplierInvoices: any[];
  cashMovements: any[];
  currency: string;
  onNavigate?: (route: string) => void;
}) {
  const { colors } = useTheme();

  const timeline = useMemo(() => {
    const events: Array<{ id: string; date: string; type: string; title: string; subtitle: string; amount?: number }> = [];
    purchaseOrders.filter((po: any) => po.supplierId === supplier.id).forEach((po: any) => {
      const statusLabel = po.status === 'received' ? 'Reçue' : po.status === 'sent' ? 'Envoyée' : po.status === 'draft' ? 'Brouillon' : po.status === 'cancelled' ? 'Annulée' : po.status;
      events.push({
        id: `po-${po.id}`,
        date: po.date || po.createdAt,
        type: 'purchase_order',
        title: `Commande ${po.number}`,
        subtitle: statusLabel,
        amount: po.total,
      });
    });
    supplierInvoices.filter((si: any) => si.supplierId === supplier.id).forEach((si: any) => {
      const statusLabel = si.status === 'paid' ? 'Payée' : si.status === 'to_pay' ? 'À payer' : si.status === 'received' ? 'Reçue' : si.status === 'late' ? 'En retard' : si.status;
      events.push({
        id: `si-${si.id}`,
        date: si.date || si.createdAt,
        type: 'supplier_invoice',
        title: `Facture ${si.number}`,
        subtitle: statusLabel,
        amount: si.total,
      });
    });
    cashMovements.filter((cm: any) => cm.description?.includes(supplier.companyName)).forEach((cm: any) => {
      events.push({
        id: `cm-${cm.id}`,
        date: cm.date || cm.createdAt,
        type: 'payment',
        title: cm.type === 'expense' ? 'Paiement effectué' : 'Encaissement',
        subtitle: cm.description,
        amount: cm.amount,
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplier, purchaseOrders, supplierInvoices, cashMovements]);

  const getEventColor = useCallback((type: string) => {
    switch (type) {
      case 'purchase_order': return colors.primary;
      case 'supplier_invoice': return '#D97706';
      case 'payment': return colors.success;
      default: return colors.textTertiary;
    }
  }, [colors]);

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={`Historique — ${supplier.companyName}`}
      subtitle={`${timeline.length} événement(s)`}
      showCancel={false}
      width={600}
    >
      {timeline.length === 0 ? (
        <View style={suppHistStyles.empty}>
          <Clock size={32} color={colors.textTertiary} />
          <Text style={[suppHistStyles.emptyText, { color: colors.textTertiary }]}>Aucun historique</Text>
        </View>
      ) : (
        <View style={suppHistStyles.timeline}>
          {timeline.map((event, idx) => (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.6}
              onPress={() => {
                if (!onNavigate) return;
                const rawId = event.id;
                switch (event.type) {
                  case 'purchase_order': {
                    const poId = rawId.replace('po-', '');
                    onNavigate(`/achats?tab=commandes&selectedId=${poId}`);
                    break;
                  }
                  case 'supplier_invoice': {
                    const siId = rawId.replace('si-', '');
                    onNavigate(`/achats?tab=factures&selectedId=${siId}`);
                    break;
                  }
                  case 'payment': onNavigate('/cashflow'); break;
                }
              }}
              style={[
                suppHistStyles.eventRow,
                { borderBottomColor: colors.borderLight },
                idx % 2 === 0 && { backgroundColor: colors.background + '40' },
              ]}
            >
              <View style={[suppHistStyles.eventDot, { backgroundColor: getEventColor(event.type) }]}>
                {event.type === 'purchase_order' ? <ShoppingCart size={12} color="#FFF" /> :
                 event.type === 'supplier_invoice' ? <FileText size={12} color="#FFF" /> :
                 <Check size={12} color="#FFF" />}
              </View>
              <View style={suppHistStyles.eventInfo}>
                <Text style={[suppHistStyles.eventTitle, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
                <Text style={[suppHistStyles.eventSub, { color: colors.textSecondary }]}>{event.subtitle}</Text>
              </View>
              <View style={suppHistStyles.eventRight}>
                {event.amount !== undefined && (
                  <Text style={[suppHistStyles.eventAmount, { color: colors.text }]}>{formatCurrency(event.amount, currency)}</Text>
                )}
                <Text style={[suppHistStyles.eventDate, { color: colors.textTertiary }]}>{formatDate(event.date)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </FormModal>
  );
}

const suppHistStyles = StyleSheet.create({
  empty: { alignItems: 'center' as const, paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14 },
  timeline: { gap: 0 },
  eventRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, gap: 12 },
  eventDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600' as const },
  eventSub: { fontSize: 11, marginTop: 1 },
  eventRight: { alignItems: 'flex-end' as const },
  eventAmount: { fontSize: 13, fontWeight: '600' as const },
  eventDate: { fontSize: 11, marginTop: 1 },
});

function CommandesSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { activePurchaseOrders, activeSuppliers, activeProducts, receivePurchaseOrder, convertPOToSupplierInvoice, createPurchaseOrder, updatePurchaseOrder, createProduct, activeSupplierInvoices, duplicatePurchaseOrder, company: cmdCompany, showToast } = useData();
  const [refusePoId, setRefusePoId] = useState<string | null>(null);
  const [refuseComment, setRefuseComment] = useState('');
  const cur = cmdCompany.currency || 'EUR';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status' | 'supplier'>('date');
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formExpectedDate, setFormExpectedDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formItems, setFormItems] = useState<{ productId: string; productName: string; quantity: string; unitPrice: string; taxRate: string }[]>([]);
  const [lineSearches, setLineSearches] = useState<Record<number, string>>({});
  const [lineDropdownOpen, setLineDropdownOpen] = useState<number | null>(null);
  const [quickProductVisible, setQuickProductVisible] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');
  const [quickProductSalePrice, setQuickProductSalePrice] = useState('');
  const [quickProductError, setQuickProductError] = useState('');
  const [quickProductTargetIdx, setQuickProductTargetIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let list = activePurchaseOrders;
    if (statusFilter !== 'all') {
      list = list.filter((po) => po.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((po) => po.number.toLowerCase().includes(q) || (po.supplierName?.toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'amount': return b.total - a.total;
        case 'status': return a.status.localeCompare(b.status);
        case 'supplier': return (a.supplierName || '').localeCompare(b.supplierName || '');
        default: return 0;
      }
    });
  }, [activePurchaseOrders, search, statusFilter, sortBy]);

  const getSupplierName = useCallback((supplierId: string) => {
    return activeSuppliers.find((s) => s.id === supplierId)?.companyName || 'Inconnu';
  }, [activeSuppliers]);

  const getFilteredProductsForLine = useCallback((idx: number) => {
    const prods = activeProducts.filter((p) => ['matiere_premiere', 'consommable', 'produit_revendu'].includes(p.type));
    const q = (lineSearches[idx] || '').toLowerCase();
    if (!q) return prods.slice(0, 30);
    return prods.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 30);
  }, [activeProducts, lineSearches]);

  const openCreate = useCallback(() => {
    setFormSupplierId(activeSuppliers.length > 0 ? activeSuppliers[0].id : '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormExpectedDate('');
    setFormNotes('');
    setFormItems([]);
    setFormError('');
    setLineSearches({});
    setLineDropdownOpen(null);
    setFormVisible(true);
  }, [activeSuppliers]);

  const openQuickProduct = useCallback((targetIdx: number) => {
    setQuickProductName('');
    setQuickProductPrice('');
    setQuickProductSalePrice('');
    setQuickProductError('');
    setQuickProductTargetIdx(targetIdx);
    setQuickProductVisible(true);
  }, []);


  const addFormItem = useCallback(() => {
    setFormItems((prev) => [...prev, { productId: '', productName: '', quantity: '1', unitPrice: '0', taxRate: '20' }]);
  }, []);

  const removeFormItem = useCallback((index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateFormItem = useCallback((index: number, field: string, value: string) => {
    setFormItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'productId') {
        const product = activeProducts.find((p) => p.id === value);
        if (product) {
          updated.productName = product.name;
          updated.unitPrice = String(product.purchasePrice);
          updated.taxRate = String(product.vatRate);
        }
      }
      return updated;
    }));
  }, [activeProducts]);

  const handleQuickProductSubmit = useCallback(() => {
    if (!quickProductName.trim()) { setQuickProductError('Le nom est requis'); return; }
    const purchasePrice = parseFloat(quickProductPrice) || 0;
    const salePrice = parseFloat(quickProductSalePrice) || purchasePrice;
    if (salePrice <= 0) { setQuickProductError('Le prix de vente doit être positif'); return; }
    const result = createProduct({
      name: quickProductName.trim(),
      description: '',
      sku: '',
      purchasePrice,
      salePrice,
      vatRate: 20,
      stockQuantity: 0,
      lowStockThreshold: 0,
      unit: 'pièce',
      type: 'matiere_premiere' as const,
      isActive: true,
    });
    if (!result.success) { setQuickProductError(result.error || 'Erreur'); return; }
    setQuickProductVisible(false);
    setTimeout(() => {
      const newProd = activeProducts.find((p) => p.name === quickProductName.trim());
      if (newProd && quickProductTargetIdx !== null) {
        updateFormItem(quickProductTargetIdx, 'productId', newProd.id);
      }
    }, 100);
  }, [quickProductName, quickProductPrice, quickProductSalePrice, quickProductTargetIdx, createProduct, activeProducts, updateFormItem]);

  const handleSubmitPO = useCallback(() => {
    if (!formSupplierId) { setFormError('Sélectionnez un fournisseur'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }
    const items = formItems.map((fi, idx) => ({
      id: `poi_${Date.now()}_${idx}`,
      purchaseOrderId: '',
      productId: fi.productId,
      productName: fi.productName || 'Produit',
      quantity: parseInt(fi.quantity, 10) || 1,
      unitPrice: parseFloat(fi.unitPrice) || 0,
      taxRate: (parseFloat(fi.taxRate) || 20) as import('@/types').VATRate,
      total: (parseInt(fi.quantity, 10) || 1) * (parseFloat(fi.unitPrice) || 0),
    }));
    const result = createPurchaseOrder(formSupplierId, items, formNotes, formExpectedDate || undefined);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formSupplierId, formItems, formNotes, formExpectedDate, createPurchaseOrder]);

  const sendPO = useCallback((poId: string) => {
    updatePurchaseOrder(poId, { status: 'sent' });
  }, [updatePurchaseOrder]);

  const STATUS_FILTERS = [
    { label: 'Tous', value: 'all' },
    { label: 'Brouillon', value: 'draft' },
    { label: 'Envoyée', value: 'sent' },
    { label: 'Reçue', value: 'received' },
    { label: 'Annulée', value: 'cancelled' },
  ];

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher une commande..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'number', label: 'N° Commande' },
              { key: 'supplierName', label: 'Fournisseur' },
              { key: 'status', label: 'Statut' },
              { key: 'date', label: 'Date' },
              { key: 'subtotal', label: 'Sous-total HT' },
              { key: 'taxAmount', label: 'TVA' },
              { key: 'total', label: 'Total TTC' },
            ];
            const data = activePurchaseOrders.map(po => ({ ...po } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `commandes_achats_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, { backgroundColor: statusFilter === f.value ? colors.primary : colors.card, borderColor: statusFilter === f.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: statusFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDown size={13} color={colors.textTertiary} />
        {([{ value: 'date' as const, label: 'Date' }, { value: 'amount' as const, label: 'Montant' }, { value: 'status' as const, label: 'Statut' }, { value: 'supplier' as const, label: 'Fournisseur' }]).map((opt) => (
          <TouchableOpacity key={opt.value} style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]} onPress={() => setSortBy(opt.value)}>
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <ShoppingCart size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune commande pour l’instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez une commande fournisseur pour suivre vos approvisionnements</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((po, i) => {
            const linkedInvoices = activeSupplierInvoices.filter(si => si.purchaseOrderId === po.id);
            return (
              <View key={po.id}>
                <TouchableOpacity
                  style={[styles.listRow, i < filtered.length - 1 && selectedPOId !== po.id && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  onPress={() => setSelectedPOId(selectedPOId === po.id ? null : po.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{po.number}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                        {po.supplierName || getSupplierName(po.supplierId)} · {formatDate(po.date)}
                      </Text>
                    </View>
                    <StatusBadge status={po.status} />
                    <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(po.total, cur)}</Text>
                    <View style={styles.listRowActions}>
                      {po.status === 'draft' && (
                        <TouchableOpacity onPress={() => sendPO(po.id)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
                          <ArrowRight size={13} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      {(po.status === 'sent' || po.status === 'partial') && (
                        <TouchableOpacity onPress={() => receivePurchaseOrder(po.id)} style={[styles.iconBtn, { backgroundColor: colors.successLight }]}>
                          <PackageCheck size={13} color={colors.success} />
                        </TouchableOpacity>
                      )}
                      {po.status === 'received' && (
                        linkedInvoices.length > 0 ? (
                          <View style={[styles.invoiceCreatedBadge, { backgroundColor: colors.successLight }]}>
                            <Check size={11} color={colors.success} />
                            <Text style={[styles.invoiceCreatedText, { color: colors.success }]}>Facture créée</Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => convertPOToSupplierInvoice(po.id)} style={[styles.createInvoiceBtn, { backgroundColor: colors.primary }]}>
                            <FileText size={13} color="#FFF" />
                            {!isMobile && <Text style={styles.createInvoiceBtnText}>Créer facture</Text>}
                          </TouchableOpacity>
                        )
                      )}
                      {selectedPOId === po.id ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                    </View>
                  </View>
                </TouchableOpacity>
                {selectedPOId === po.id && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Fournisseur</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{po.supplierName || getSupplierName(po.supplierId)}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(po.date)}</Text>
                      </View>
                      {po.expectedDate ? (
                        <View style={styles.detailInfoCol}>
                          <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Livraison prévue</Text>
                          <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(po.expectedDate)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
                    {po.items.map((item) => (
                      <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                        <Text style={[styles.detailLineName, { color: colors.text }]}>{item.productName}</Text>
                        <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{item.quantity} × {formatCurrency(item.unitPrice, cur)} HT · TVA {item.taxRate}%</Text>
                        <Text style={[styles.detailLineTotal, { color: colors.text }]}>{formatCurrency(item.total, cur)}</Text>
                      </View>
                    ))}
                    <View style={[styles.detailTotals, { borderTopColor: colors.border }]}>
                      <View style={styles.detailTotalRow}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(po.subtotal, cur)}</Text>
                      </View>
                      <View style={styles.detailTotalRow}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(po.taxAmount, cur)}</Text>
                      </View>
                      <View style={[styles.detailTotalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700' as const, color: colors.text }}>Total TTC</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800' as const, color: colors.primary }}>{formatCurrency(po.total, cur)}</Text>
                      </View>
                    </View>
                    {linkedInvoices.length > 0 && (
                      <View>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>FACTURES ASSOCIÉES</Text>
                        {linkedInvoices.map(si => (
                          <View key={si.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[styles.detailLineName, { color: colors.text }]}>{si.number}</Text>
                            <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{formatCurrency(si.total, cur)} · {si.status === 'paid' ? 'Payée' : si.status === 'to_pay' ? 'À payer' : si.status}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {po.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{po.notes}</Text> : null}
                    <View style={styles.detailActionsRow}>
                      {po.status === 'draft' && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              updatePurchaseOrder(po.id, { status: 'received' as any });
                              setTimeout(() => {
                                const r = convertPOToSupplierInvoice(po.id);
                                if (r.success) showToast('Commande valid\u00e9e, facture cr\u00e9\u00e9e');
                                else showToast('Commande valid\u00e9e');
                              }, 100);
                            }}
                            style={[styles.detailActionBtn, { backgroundColor: colors.success }]}
                          >
                            <Check size={13} color="#FFF" />
                            <Text style={[styles.detailActionBtnText, { color: '#FFF' }]}>Accepter</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { setRefusePoId(po.id); setRefuseComment(''); }}
                            style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}
                          >
                            <Ban size={13} color="#FFF" />
                            <Text style={[styles.detailActionBtnText, { color: '#FFF' }]}>Refuser</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => { updatePurchaseOrder(po.id, { isDeleted: true } as any); setSelectedPOId(null); showToast('Commande supprim\u00e9e'); }}
                            style={[styles.detailActionBtn, { backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger + '30' }]}
                          >
                            <Trash2 size={13} color={colors.danger} />
                            <Text style={[styles.detailActionBtnText, { color: colors.danger }]}>Supprimer</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => duplicatePurchaseOrder(po.id)}
                        style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}
                      >
                        <ShoppingCart size={13} color={colors.text} />
                        <Text style={[styles.detailActionBtnText, { color: colors.text }]}>Dupliquer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title="Nouvelle commande fournisseur"
        onSubmit={handleSubmitPO}
        submitLabel="Créer la commande"
        width={600}
      >
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}

        <View style={styles.formFieldGroup}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Fournisseur *</Text>
          <View style={styles.selectRow}>
            {activeSuppliers.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.selectChip, { backgroundColor: formSupplierId === s.id ? colors.primary : colors.inputBg, borderColor: formSupplierId === s.id ? colors.primary : colors.inputBorder }]}
                onPress={() => setFormSupplierId(s.id)}
              >
                <Text style={[styles.selectChipText, { color: formSupplierId === s.id ? '#FFF' : colors.text }]}>{s.companyName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <DatePickerField label="Date de commande" value={formDate} onChange={setFormDate} required />
          </View>
          <View style={styles.formCol}>
            <DatePickerField label="Date livraison prévue" value={formExpectedDate} onChange={setFormExpectedDate} placeholder="Sélectionner" />
          </View>
        </View>

        <View style={styles.formFieldGroup}>
          <View style={styles.formFieldHeader}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Lignes de commande</Text>
            <TouchableOpacity style={[styles.addLineBtn, { backgroundColor: colors.primaryLight }]} onPress={addFormItem}>
              <Plus size={14} color={colors.primary} />
              <Text style={[styles.addLineBtnText, { color: colors.primary }]}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {formItems.map((item, idx) => {
            const lineProducts = getFilteredProductsForLine(idx);
            const isDropdownOpen = lineDropdownOpen === idx;
            return (
              <View key={idx} style={[styles.lineItemRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <View style={styles.lineItemTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.lineProductHeader}>
                      <Text style={[styles.lineItemLabel, { color: colors.textTertiary }]}>Produit</Text>
                      <TouchableOpacity onPress={() => openQuickProduct(idx)} style={[styles.quickCreateBtn, { backgroundColor: colors.primaryLight }]}>
                        <Plus size={12} color={colors.primary} />
                        <Text style={[styles.quickCreateBtnText, { color: colors.primary }]}>Créer</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[styles.productSelectBtn, { backgroundColor: colors.card, borderColor: item.productId ? colors.primary : colors.inputBorder }]}
                      onPress={() => setLineDropdownOpen(isDropdownOpen ? null : idx)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.productSelectText, { color: item.productId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                        {item.productName || 'Sélectionner un produit...'}
                      </Text>
                      <ChevronDown size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                    {isDropdownOpen && (
                      <View style={[styles.productDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.productDropdownSearch, { borderBottomColor: colors.borderLight }]}>
                          <Search size={14} color={colors.textTertiary} />
                          <TextInput
                            style={[styles.productDropdownSearchInput, { color: colors.text }]}
                            placeholder="Rechercher..."
                            placeholderTextColor={colors.textTertiary}
                            value={lineSearches[idx] || ''}
                            onChangeText={(v) => setLineSearches((prev) => ({ ...prev, [idx]: v }))}
                            autoFocus
                          />
                          {(lineSearches[idx] || '').length > 0 && (
                            <TouchableOpacity onPress={() => setLineSearches((prev) => ({ ...prev, [idx]: '' }))} hitSlop={8}>
                              <X size={12} color={colors.textTertiary} />
                            </TouchableOpacity>
                          )}
                        </View>
                        <ScrollView style={styles.productDropdownList} nestedScrollEnabled>
                          {lineProducts.map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={[styles.productDropdownItem, { borderBottomColor: colors.borderLight }, item.productId === p.id && { backgroundColor: colors.primaryLight }]}
                              onPress={() => {
                                updateFormItem(idx, 'productId', p.id);
                                setLineDropdownOpen(null);
                                setLineSearches((prev) => ({ ...prev, [idx]: '' }));
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.productDropdownName, { color: colors.text }]}>{p.name}</Text>
                                <Text style={[styles.productDropdownSku, { color: colors.textTertiary }]}>{p.sku || 'Sans réf.'} · Achat: {formatCurrency(p.purchasePrice, cur)}</Text>
                              </View>
                              {item.productId === p.id && <Check size={14} color={colors.primary} />}
                            </TouchableOpacity>
                          ))}
                          {lineProducts.length === 0 && (
                            <Text style={[styles.productDropdownEmpty, { color: colors.textTertiary }]}>Aucun produit trouvé</Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeFormItem(idx)} style={{ padding: 4 }}>
                    <X size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={styles.lineItemBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemLabel, { color: colors.textTertiary }]}>Qté</Text>
                    <TextInput
                      style={[styles.lineInput, { color: colors.text, borderColor: colors.inputBorder }]}
                      value={item.quantity}
                      onChangeText={(v) => updateFormItem(idx, 'quantity', v)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemLabel, { color: colors.textTertiary }]}>Prix unit. HT</Text>
                    <TextInput
                      style={[styles.lineInput, { color: colors.text, borderColor: colors.inputBorder }]}
                      value={item.unitPrice}
                      onChangeText={(v) => updateFormItem(idx, 'unitPrice', v)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemLabel, { color: colors.textTertiary }]}>TVA %</Text>
                    <TextInput
                      style={[styles.lineInput, { color: colors.text, borderColor: colors.inputBorder }]}
                      value={item.taxRate}
                      onChangeText={(v) => updateFormItem(idx, 'taxRate', v)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            );
          })}
          {formItems.length > 0 && (
            <View style={[styles.poTotalRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.poTotalLabel, { color: colors.textSecondary }]}>Total estimé HT</Text>
              <Text style={[styles.poTotalValue, { color: colors.text }]}>
                {formatCurrency(formItems.reduce((s, fi) => s + (parseInt(fi.quantity, 10) || 0) * (parseFloat(fi.unitPrice) || 0), 0))}
              </Text>
            </View>
          )}
        </View>

        <FormField label="Notes" value={formNotes} onChangeText={setFormNotes} placeholder="Notes..." multiline numberOfLines={2} />
      </FormModal>

      <FormModal
        visible={quickProductVisible}
        onClose={() => setQuickProductVisible(false)}
        title="Création rapide de produit"
        subtitle="Le produit sera automatiquement sélectionné"
        onSubmit={handleQuickProductSubmit}
        submitLabel="Créer et sélectionner"
      >
        {quickProductError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{quickProductError}</Text>
          </View>
        ) : null}
        <FormField label="Nom du produit" value={quickProductName} onChangeText={setQuickProductName} placeholder="Nom" required />
        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <FormField label="Prix d'achat HT" value={quickProductPrice} onChangeText={setQuickProductPrice} placeholder="0.00" keyboardType="decimal-pad" />
          </View>
          <View style={styles.formCol}>
            <FormField label="Prix de vente HT" value={quickProductSalePrice} onChangeText={setQuickProductSalePrice} placeholder="0.00" keyboardType="decimal-pad" required />
          </View>
        </View>
      </FormModal>

      <FormModal
        visible={refusePoId !== null}
        onClose={() => { setRefusePoId(null); setRefuseComment(''); }}
        title="Refuser la commande"
        subtitle="Ajoutez un commentaire pour justifier le refus"
        onSubmit={() => {
          if (refusePoId) {
            updatePurchaseOrder(refusePoId, { status: 'cancelled' as any, notes: refuseComment || 'Commande refus\u00e9e' });
            showToast('Commande refus\u00e9e');
            setSelectedPOId(null);
          }
          setRefusePoId(null);
          setRefuseComment('');
        }}
        submitLabel="Confirmer le refus"
      >
        <FormField
          label="Commentaire"
          value={refuseComment}
          onChangeText={setRefuseComment}
          placeholder="Raison du refus..."
          multiline
          numberOfLines={3}
          required
        />
      </FormModal>
    </>
  );
}

function FacturesRecuesSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const {
    activeSupplierInvoices, activeSuppliers, activePurchaseOrders,
    markSupplierInvoicePaid, createSupplierInvoice, updateSupplierInvoice, createSupplier, showToast, company: factCompany,
  } = useData();
  const [expandedSiId, setExpandedSiId] = useState<string | null>(null);
  const cur = factCompany.currency || 'EUR';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formVisible, setFormVisible] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPoId, setFormPoId] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('20');
  const [importedDocs, setImportedDocs] = useState<Record<string, string>>({});
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<string>>(new Set());
  const [ocrFileUri, setOcrFileUri] = useState<string | null>(null);
  const [ocrFileName, setOcrFileName] = useState<string | null>(null);
  const [ocrSupplierName, setOcrSupplierName] = useState<string | null>(null);
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState('');

  const filtered = useMemo(() => {
    let list = activeSupplierInvoices;
    if (statusFilter !== 'all') {
      list = list.filter((si) => si.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((si) => si.number.toLowerCase().includes(q) || (si.supplierName?.toLowerCase().includes(q)));
    }
    return list;
  }, [activeSupplierInvoices, search, statusFilter]);

  const getSupplierName = useCallback((supplierId: string) => {
    return activeSuppliers.find((s) => s.id === supplierId)?.companyName || 'Inconnu';
  }, [activeSuppliers]);

  const supplierPOs = useMemo(() => {
    if (!formSupplierId) return [];
    return activePurchaseOrders.filter((po) => po.supplierId === formSupplierId && (po.status === 'received' || po.status === 'sent' || po.status === 'partial'));
  }, [activePurchaseOrders, formSupplierId]);

  const openCreate = useCallback(() => {
    setFormSupplierId(activeSuppliers.length > 0 ? activeSuppliers[0].id : '');
    setFormPoId('');
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setFormDueDate(due.toISOString().split('T')[0]);
    setFormNotes('');
    setFormDescription('');
    setFormAmount('');
    setFormTaxRate('20');
    setFormError('');
    setOcrFilledFields(new Set());
    setOcrFileUri(null);
    setOcrFileName(null);
    setOcrSupplierName(null);
    setFormInvoiceNumber('');
    setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormVisible(true);
  }, [activeSuppliers]);

  const handleOcrData = useCallback((data: ParsedInvoiceData, fileUri: string, fileName: string) => {
    const filled = new Set<string>();
    setOcrFileUri(fileUri);
    setOcrFileName(fileName);

    if (data.supplier_name) {
      setOcrSupplierName(data.supplier_name);
      const q = data.supplier_name.toLowerCase().trim();
      const match = activeSuppliers.find(s =>
        s.companyName.toLowerCase().includes(q) || q.includes(s.companyName.toLowerCase())
      );
      if (match) {
        setFormSupplierId(match.id);
        filled.add('supplier');
      }
    }
    if (data.total_ht !== null) {
      setFormAmount(String(data.total_ht));
      filled.add('amount');
    } else if (data.total_ttc !== null && data.tva_rate !== null) {
      const ht = data.total_ttc / (1 + data.tva_rate / 100);
      setFormAmount(String(Math.round(ht * 100) / 100));
      filled.add('amount');
    } else if (data.total_ttc !== null) {
      setFormAmount(String(Math.round(data.total_ttc / 1.2 * 100) / 100));
      filled.add('amount');
    }
    if (data.tva_rate !== null) {
      setFormTaxRate(String(data.tva_rate));
      filled.add('taxRate');
    }
    if (data.due_date) {
      setFormDueDate(data.due_date);
      filled.add('dueDate');
    }
    if (data.invoice_date) {
      setFormInvoiceDate(data.invoice_date);
      filled.add('invoiceDate');
    }
    if (data.invoice_number) {
      setFormInvoiceNumber(data.invoice_number);
      filled.add('invoiceNumber');
    }
    if (data.lines && data.lines.length > 0) {
      const desc = data.lines.map(l => `${l.description} (x${l.quantity} @ ${l.unit_price})`).join(', ');
      setFormDescription(desc);
      filled.add('description');
    }
    const noteParts: string[] = [];
    if (data.invoice_number) noteParts.push(`N° fournisseur: ${data.invoice_number}`);
    if (data.total_ttc !== null) noteParts.push(`Total TTC: ${data.total_ttc}`);
    if (data.supplier_name) noteParts.push(`Fournisseur détecté: ${data.supplier_name}`);
    if (noteParts.length > 0) {
      setFormNotes(noteParts.join(' | '));
      filled.add('notes');
    }
    setOcrFilledFields(filled);
  }, [activeSuppliers]);

  const handleCreateSupplierFromOcr = useCallback(() => {
    if (!ocrSupplierName) return;
    const result = createSupplier({
      companyName: ocrSupplierName,
      email: '', phone: '', address: '', city: '',
      postalCode: '', country: 'France', notes: '',
      paymentConditions: '',
    });
    if (result.success) {
      setTimeout(() => {
        const created = activeSuppliers.find(s => s.companyName === ocrSupplierName);
        if (created) setFormSupplierId(created.id);
      }, 200);
      setOcrSupplierName(null);
    }
  }, [ocrSupplierName, createSupplier, activeSuppliers]);

  const uploadAttachment = useCallback(async (fileUri: string, invoiceId: string): Promise<string | null> => {
    try {
      if (Platform.OS !== 'web') return null;
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const ext = ocrFileName?.endsWith('.pdf') ? 'pdf' : 'jpg';
      const filePath = `${factCompany.id || 'default'}/${invoiceId}.${ext}`;
      const { error } = await supabase.storage
        .from('purchase-invoices')
        .upload(filePath, blob, {
          contentType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
          upsert: true,
        });
      if (error) {
        return null;
      }
      const { data: urlData } = supabase.storage
        .from('purchase-invoices')
        .getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  }, [ocrFileName, factCompany.id]);

  const handleSubmitInvoice = useCallback(async () => {
    if (!formSupplierId) { setFormError('Sélectionnez un fournisseur'); return; }
    if (!formAmount || parseFloat(formAmount) <= 0) { setFormError('Le montant est requis'); return; }
    if (!formDueDate) { setFormError('La date d’échéance est requise'); return; }
    const amount = parseFloat(formAmount) || 0;
    const taxRate = parseFloat(formTaxRate) || 20;
    const items = [{
      id: `sii_${Date.now()}`,
      supplierInvoiceId: '',
      description: formDescription || 'Facture fournisseur',
      quantity: 1,
      unitPrice: amount,
      taxRate: taxRate as import('@/types').VATRate,
      total: amount * (1 + taxRate / 100),
    }];
    const result = createSupplierInvoice(
      formSupplierId,
      items,
      formDueDate,
      formNotes,
      formPoId || undefined
    );
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }

    if (result.siId) {
      const updates: Record<string, unknown> = {};
      if (formInvoiceNumber) updates.supplierInvoiceNumber = formInvoiceNumber;
      if (ocrFileUri) {
        const attachUrl = await uploadAttachment(ocrFileUri, result.siId);
        if (attachUrl) updates.attachmentUrl = attachUrl;
      }
      if (Object.keys(updates).length > 0) {
        updateSupplierInvoice(result.siId, updates as any);
      }
    }

    setFormVisible(false);
  }, [formSupplierId, formAmount, formTaxRate, formDescription, formDueDate, formNotes, formPoId, formInvoiceNumber, createSupplierInvoice, updateSupplierInvoice, ocrFileUri, uploadAttachment]);

  const handleImportDoc = useCallback(async (invoiceId: string) => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const uri = URL.createObjectURL(file);
            setImportedDocs((prev) => ({ ...prev, [invoiceId]: uri }));
            showToast('Document importé avec succès');
          }
        };
        input.click();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImportedDocs((prev) => ({ ...prev, [invoiceId]: result.assets[0].uri }));
        showToast('Document importé avec succès');
      }
    } catch {
      showToast('Erreur lors de l’import', 'error');
    }
  }, [showToast]);

  const STATUS_FILTERS = [
    { label: 'Tous', value: 'all' },
    { label: 'Reçue', value: 'received' },
    { label: 'À payer', value: 'to_pay' },
    { label: 'Payée', value: 'paid' },
    { label: 'En retard', value: 'late' },
  ];

  const totalToPay = useMemo(() =>
    activeSupplierInvoices.filter((si) => si.status === 'to_pay' || si.status === 'received').reduce((s, si) => s + si.total, 0),
    [activeSupplierInvoices]
  );

  return (
    <>
      <View style={[styles.summaryRow, _isMobile ? { flexDirection: 'column' as const } : {}]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.warningLight }]}>
            <Clock size={20} color={colors.warning} />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(totalToPay, cur)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>À payer</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}>
            <Check size={20} color={colors.success} />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{activeSupplierInvoices.filter((si) => si.status === 'paid').length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Payées</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher une facture reçue..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'number', label: 'N° Facture' },
              { key: 'supplierName', label: 'Fournisseur' },
              { key: 'status', label: 'Statut' },
              { key: 'date', label: 'Date' },
              { key: 'dueDate', label: 'Échéance' },
              { key: 'subtotal', label: 'Sous-total HT' },
              { key: 'taxAmount', label: 'TVA' },
              { key: 'total', label: 'Total TTC' },
            ];
            const data = activeSupplierInvoices.map(si => ({ ...si } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `factures_recues_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
          {!_isMobile && <Text style={styles.addBtnText}>Nouvelle facture</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, { backgroundColor: statusFilter === f.value ? colors.primary : colors.card, borderColor: statusFilter === f.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: statusFilter === f.value ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.invoiceSummaryBar}>
        <Text style={styles.invoiceSummaryText}>
          Total : <Text style={styles.invoiceSummaryBold}>{activeSupplierInvoices.length} factures</Text> | <Text style={[styles.invoiceSummaryBold, { color: '#1E40AF' }]}>{formatCurrency(activeSupplierInvoices.reduce((s, si) => s + si.total, 0), cur)}</Text> | <Text style={[styles.invoiceSummaryBold, { color: '#D97706' }]}>{activeSupplierInvoices.filter(si => si.status === 'to_pay' || si.status === 'received' || si.status === 'late').length} à payer</Text>
        </Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <FileText size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture reçue</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les factures de vos fournisseurs apparaîtront ici</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((si, i) => {
            const isExpanded = expandedSiId === si.id;
            const linkedPO = si.purchaseOrderId ? activePurchaseOrders.find(po => po.id === si.purchaseOrderId) : null;
            return (
              <View key={si.id}>
                <TouchableOpacity
                  style={[styles.listRow, i < filtered.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  onPress={() => setExpandedSiId(isExpanded ? null : si.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{si.number}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                        {si.supplierName || getSupplierName(si.supplierId)} · Éch: {formatDate(si.dueDate)}
                      </Text>
                    </View>
                    <StatusBadge status={si.status} />
                    <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(si.total, cur)}</Text>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Fournisseur</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{si.supplierName || getSupplierName(si.supplierId)}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(si.date)}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Échéance</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(si.dueDate)}</Text>
                      </View>
                    </View>
                    {si.supplierInvoiceNumber ? (
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>N° facture fournisseur</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{si.supplierInvoiceNumber}</Text>
                      </View>
                    ) : null}
                    {linkedPO ? (
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Commande liée</Text>
                        <Text style={[styles.detailValue, { color: colors.primary }]}>{linkedPO.number}</Text>
                      </View>
                    ) : null}
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
                      <View style={styles.detailTotalRow}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>Sous-total HT</Text>
                        <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(si.subtotal, cur)}</Text>
                      </View>
                      <View style={styles.detailTotalRow}>
                        <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                        <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(si.taxAmount, cur)}</Text>
                      </View>
                      <View style={[styles.detailTotalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={{ fontSize: 15, fontWeight: '700' as const, color: colors.text }}>Total TTC</Text>
                        <Text style={{ fontSize: 16, fontWeight: '800' as const, color: colors.primary }}>{formatCurrency(si.total, cur)}</Text>
                      </View>
                    </View>
                    {si.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{si.notes}</Text> : null}
                    <View style={styles.detailActionsRow}>
                      {si.attachmentUrl ? (
                        <TouchableOpacity onPress={() => { if (Platform.OS === 'web') { window.open(si.attachmentUrl, '_blank'); } else { void Linking.openURL(si.attachmentUrl!); } }} style={[styles.detailActionBtn, { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success + '30' }]}>
                          <Paperclip size={13} color={colors.success} />
                          <Text style={[styles.detailActionBtnText, { color: colors.success }]}>Voir pièce jointe</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity onPress={() => handleImportDoc(si.id)} style={[styles.detailActionBtn, { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30' }]}>
                          <Upload size={13} color={colors.primary} />
                          <Text style={[styles.detailActionBtnText, { color: colors.primary }]}>Importer document</Text>
                        </TouchableOpacity>
                      )}
                      {(si.status === 'received' || si.status === 'to_pay' || si.status === 'late') && (
                        <TouchableOpacity onPress={() => { markSupplierInvoicePaid(si.id); setExpandedSiId(null); }} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                          <Check size={13} color="#FFF" />
                          <Text style={[styles.detailActionBtnText, { color: '#FFF' }]}>Marquer payée</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                {!isExpanded && (importedDocs[si.id] || si.attachmentUrl) && (
                  <View style={[styles.importedDocBadge, { backgroundColor: colors.successLight, marginLeft: 16, marginBottom: 8 }]}>
                    <Paperclip size={12} color={colors.success} />
                    <Text style={[styles.importedDocText, { color: colors.success }]}>{si.attachmentUrl ? 'Facture originale jointe' : 'Document importé'}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title="Nouvelle facture reçue"
        subtitle="Enregistrer une facture fournisseur"
        onSubmit={handleSubmitInvoice}
        submitLabel="Créer"
        width={560}
      >
        <InvoiceImportSection onDataExtracted={handleOcrData} />

        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}

        {ocrSupplierName && !ocrFilledFields.has('supplier') && (
          <View style={[styles.ocrSupplierBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning + '30' }]}>
            <Text style={[styles.ocrSupplierText, { color: colors.warning }]}>
              Fournisseur détecté : "{ocrSupplierName}" — aucune correspondance
            </Text>
            <TouchableOpacity
              style={[styles.ocrCreateSupplierBtn, { backgroundColor: colors.warning }]}
              onPress={handleCreateSupplierFromOcr}
            >
              <UserPlus size={13} color="#FFF" />
              <Text style={styles.ocrCreateSupplierBtnText}>Créer ce fournisseur</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formFieldGroup}>
          <View style={styles.formLabelRow}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Fournisseur *</Text>
            {ocrFilledFields.has('supplier') && <OcrFieldIndicator />}
          </View>
          <View style={styles.selectRow}>
            {activeSuppliers.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.selectChip, { backgroundColor: formSupplierId === s.id ? colors.primary : colors.inputBg, borderColor: formSupplierId === s.id ? colors.primary : colors.inputBorder }]}
                onPress={() => { setFormSupplierId(s.id); setFormPoId(''); }}
              >
                <Text style={[styles.selectChipText, { color: formSupplierId === s.id ? '#FFF' : colors.text }]}>{s.companyName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {supplierPOs.length > 0 && (
          <View style={styles.formFieldGroup}>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Commande liée (optionnel)</Text>
            <View style={styles.selectRow}>
              <TouchableOpacity
                style={[styles.selectChip, { backgroundColor: !formPoId ? colors.primary : colors.inputBg, borderColor: !formPoId ? colors.primary : colors.inputBorder }]}
                onPress={() => setFormPoId('')}
              >
                <Text style={[styles.selectChipText, { color: !formPoId ? '#FFF' : colors.text }]}>Aucune</Text>
              </TouchableOpacity>
              {supplierPOs.map((po) => (
                <TouchableOpacity
                  key={po.id}
                  style={[styles.selectChip, { backgroundColor: formPoId === po.id ? colors.primary : colors.inputBg, borderColor: formPoId === po.id ? colors.primary : colors.inputBorder }]}
                  onPress={() => setFormPoId(po.id)}
                >
                  <Text style={[styles.selectChipText, { color: formPoId === po.id ? '#FFF' : colors.text }]}>{po.number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <View style={styles.formLabelRow}>
          <FormField label="N° facture fournisseur" value={formInvoiceNumber} onChangeText={setFormInvoiceNumber} placeholder="Ex: FA-2024-001" />
          {ocrFilledFields.has('invoiceNumber') && <OcrFieldIndicator />}
        </View>
        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <View style={styles.formLabelRow}>
              <DatePickerField label="Date facture" value={formInvoiceDate} onChange={setFormInvoiceDate} />
              {ocrFilledFields.has('invoiceDate') && <OcrFieldIndicator />}
            </View>
          </View>
          <View style={styles.formCol}>
            <View style={styles.formLabelRow}>
              <DatePickerField label="Date d'échéance *" value={formDueDate} onChange={setFormDueDate} required />
              {ocrFilledFields.has('dueDate') && <OcrFieldIndicator />}
            </View>
          </View>
        </View>
        <View style={styles.formLabelRow}>
          <FormField label="Description" value={formDescription} onChangeText={setFormDescription} placeholder="Description de la facture" />
          {ocrFilledFields.has('description') && <OcrFieldIndicator />}
        </View>
        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <View style={styles.formLabelRow}>
              <FormField label="Montant HT *" value={formAmount} onChangeText={setFormAmount} placeholder="0.00" keyboardType="decimal-pad" required />
              {ocrFilledFields.has('amount') && <OcrFieldIndicator />}
            </View>
          </View>
          <View style={styles.formCol}>
            <View style={styles.formLabelRow}>
              <FormField label="TVA %" value={formTaxRate} onChangeText={setFormTaxRate} placeholder="20" keyboardType="decimal-pad" />
              {ocrFilledFields.has('taxRate') && <OcrFieldIndicator />}
            </View>
          </View>
        </View>
        <View style={styles.formLabelRow}>
          <FormField label="Notes" value={formNotes} onChangeText={setFormNotes} placeholder="Notes..." multiline numberOfLines={2} />
          {ocrFilledFields.has('notes') && <OcrFieldIndicator />}
        </View>
        {ocrFileUri ? (
          <View style={[styles.ocrAttachmentBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
            <Paperclip size={14} color={colors.primary} />
            <Text style={[styles.ocrAttachmentText, { color: colors.primary }]} numberOfLines={1}>
              {ocrFileName || 'Fichier joint'}
            </Text>
          </View>
        ) : null}
      </FormModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16, paddingBottom: 40 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBar: { flexDirection: 'row' as const, gap: 0 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  searchRow: { flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const },
  searchBar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' as never },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '500' as const },
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  listRow: { paddingHorizontal: 16, paddingVertical: 14 },
  listRowMain: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  listRowInfo: { flex: 1 },
  listRowTitle: { fontSize: 14, fontWeight: '600' as const },
  listRowSub: { fontSize: 12, marginTop: 2 },
  listRowValue: { fontSize: 14, fontWeight: '600' as const },
  listRowActions: { flexDirection: 'row' as const, gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6 },
  emptyState: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  formRow: { flexDirection: 'row' as const, gap: 12 },
  formCol: { flex: 1 },
  summaryRow: { flexDirection: 'row' as const, gap: 12 },
  summaryCard: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  condBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  condBadgeText: { fontSize: 11, fontWeight: '500' as const },
  formFieldGroup: { gap: 10 },
  formFieldHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  formLabel: { fontSize: 13, fontWeight: '500' as const },
  selectRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  selectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  selectChipText: { fontSize: 13, fontWeight: '500' as const },
  addLineBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addLineBtnText: { fontSize: 12, fontWeight: '600' as const },
  lineItemRow: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  lineItemTop: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8 },
  lineItemBottom: { flexDirection: 'row' as const, gap: 8 },
  lineItemLabel: { fontSize: 11, fontWeight: '500' as const, marginBottom: 4 },
  lineInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  productChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  productChipText: { fontSize: 12, fontWeight: '500' as const },
  poTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: 12, borderRadius: 8, borderWidth: 1 },
  poTotalLabel: { fontSize: 13, fontWeight: '500' as const },
  poTotalValue: { fontSize: 16, fontWeight: '700' as const },
  lineProductHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 },
  quickCreateBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 3 },
  quickCreateBtnText: { fontSize: 11, fontWeight: '600' as const },
  productSearchInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, marginBottom: 6 },
  productSelectBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  productSelectText: { flex: 1, fontSize: 13, fontWeight: '500' as const },
  productDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: 'hidden' as const },
  productDropdownSearch: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 8, gap: 6, borderBottomWidth: 1 },
  productDropdownSearchInput: { flex: 1, fontSize: 13, outlineStyle: 'none' as never },
  productDropdownList: { maxHeight: 160 },
  productDropdownItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  productDropdownName: { fontSize: 13, fontWeight: '500' as const },
  productDropdownSku: { fontSize: 11, marginTop: 1 },
  productDropdownEmpty: { padding: 16, textAlign: 'center' as const, fontSize: 13 },
  importedDocBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const },
  importedDocText: { fontSize: 11, fontWeight: '600' as const },
  invoiceCreatedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, gap: 3 },
  invoiceCreatedText: { fontSize: 11, fontWeight: '600' as const },
  createInvoiceBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  createInvoiceBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  sortRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' as const },
  supplierHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  supplierColHeader: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  supplierRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  supplierContactText: { fontSize: 13, fontWeight: '500' as const },
  supplierMobileStats: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  supplierMobileStatText: { fontSize: 12 },
  supplierStats: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  supplierStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  supplierStatText: { fontSize: 11, fontWeight: '600' as const },
  supplierAmountText: { fontSize: 13, fontWeight: '600' as const },
  detailPanel: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  detailInfoRow: { flexDirection: 'row' as const, gap: 16, flexWrap: 'wrap' as const },
  detailInfoCol: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  detailValue: { fontSize: 13, fontWeight: '500' as const },
  detailSectionTitle: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 4 },
  detailLineItem: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  detailLineName: { fontSize: 13, fontWeight: '600' as const },
  detailLineMeta: { fontSize: 11 },
  detailLineTotal: { fontSize: 13, fontWeight: '600' as const },
  detailTotals: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  detailTotalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  detailNotes: { fontSize: 12, fontStyle: 'italic' as const },
  detailActionsRow: { flexDirection: 'row' as const, gap: 8, marginTop: 10, flexWrap: 'wrap' as const },
  detailActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  detailActionBtnText: { fontSize: 12, fontWeight: '600' as const },
  invoiceSummaryBar: { backgroundColor: '#F0F9FF', borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  invoiceSummaryText: { fontSize: 13, color: '#374151' },
  invoiceSummaryBold: { fontWeight: '700' as const, color: '#1E40AF' },
  formLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1 },
  ocrSupplierBanner: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  ocrSupplierText: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  ocrCreateSupplierBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 6, marginTop: 2 },
  ocrCreateSupplierBtnText: { fontSize: 12, fontWeight: '600' as const, color: '#FFF' },
  ocrAttachmentBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  ocrAttachmentText: { fontSize: 13, fontWeight: '500' as const, flex: 1 },
});
