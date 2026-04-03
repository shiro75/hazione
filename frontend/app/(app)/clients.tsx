/**
 * @fileoverview Client management screen with list, detail panel, and CRUD forms.
 * Displays client cards with contact info, revenue stats, and quick actions.
 *
 * NOTE: String-based conditional rendering uses ternary (value ? <JSX> : null)
 * to avoid React Native Web "Unexpected text node" errors.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { Search, Plus, Mail, Phone, MapPin, Building, User, Pencil, Trash2, X, Clock, FileText, CreditCard, Bell, Upload, Copy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import CSVImportModal from '@/components/CSVImportModal';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField, { SelectField } from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import DropdownPicker from '@/components/DropdownPicker';
import type { Client } from '@/types';
import { useI18n } from '@/contexts/I18nContext';

const EMPTY_FORM = {
  type: 'company' as 'company' | 'individual',
  companyName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'France',
  vatNumber: '',
  siret: '',
  notes: '',
  discountPercent: '',
  discountCategory: '',
};

type SortOption = 'name_asc' | 'name_desc' | 'ca_desc' | 'last_activity' | 'unpaid';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Nom A→Z' },
  { value: 'name_desc', label: 'Nom Z→A' },
  { value: 'ca_desc', label: 'CA décroissant' },
  { value: 'last_activity', label: 'Dernière activité' },
  { value: 'unpaid', label: 'Impayés en premier' },
];

export default function ClientsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const router = useRouter();
  const { activeClients, createClient, updateClient, deleteClient, company, invoices, sales, quotes, reminderLogs, creditNotes, cashMovements, importClients, discountCategories, addDiscountCategory } = useData();
  const cur = company.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [csvImportVisible, setCsvImportVisible] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');


  const getClientCA = useCallback((clientId: string) => {
    let rev = 0;
    invoices.filter(i => i.status === 'paid' && i.clientId === clientId).forEach(i => { rev += i.totalTTC; });
    sales.filter(s => s.status === 'paid' && s.clientId === clientId && (!s.convertedToInvoiceId || !invoices.some(i => i.id === s.convertedToInvoiceId && i.status === 'paid'))).forEach(s => { rev += s.totalTTC; });
    return rev;
  }, [invoices, sales]);

  const getClientLastActivity = useCallback((clientId: string) => {
    let latest = '';
    invoices.filter(i => i.clientId === clientId).forEach(i => { if (i.createdAt > latest) latest = i.createdAt; });
    quotes.filter(q => q.clientId === clientId).forEach(q => { if (q.createdAt > latest) latest = q.createdAt; });
    sales.filter(s => s.clientId === clientId).forEach(s => { if (s.createdAt > latest) latest = s.createdAt; });
    return latest;
  }, [invoices, quotes, sales]);

  const getClientUnpaid = useCallback((clientId: string) => {
    return invoices
      .filter(i => i.clientId === clientId && i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
      .reduce((s, i) => s + i.totalTTC - i.paidAmount, 0);
  }, [invoices]);

  const filteredClients = useMemo(() => {
    let result = activeClients;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          (c.companyName?.toLowerCase().includes(q)) ||
          c.email.toLowerCase().includes(q) ||
          (c.vatNumber?.toLowerCase().includes(q))
      );
    }
    const sorted = [...result];
    switch (sortBy) {
      case 'name_asc':
        sorted.sort((a, b) => (a.companyName || `${a.firstName} ${a.lastName}`).localeCompare(b.companyName || `${b.firstName} ${b.lastName}`));
        break;
      case 'name_desc':
        sorted.sort((a, b) => (b.companyName || `${b.firstName} ${b.lastName}`).localeCompare(a.companyName || `${a.firstName} ${a.lastName}`));
        break;
      case 'ca_desc':
        sorted.sort((a, b) => getClientCA(b.id) - getClientCA(a.id));
        break;
      case 'last_activity':
        sorted.sort((a, b) => (getClientLastActivity(b.id) || '').localeCompare(getClientLastActivity(a.id) || ''));
        break;
      case 'unpaid':
        sorted.sort((a, b) => getClientUnpaid(b.id) - getClientUnpaid(a.id));
        break;
    }
    return sorted;
  }, [search, activeClients, sortBy, getClientCA, getClientLastActivity, getClientUnpaid]);

  const selected = useMemo(
    () => activeClients.find((c) => c.id === selectedClient),
    [selectedClient, activeClients]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedClient((prev) => (prev === id ? null : id));
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditingId(client.id);
    setForm({
      type: client.type,
      companyName: client.companyName || '',
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      postalCode: client.postalCode,
      country: client.country,
      vatNumber: client.vatNumber || '',
      siret: client.siret || '',
      notes: client.notes,
      discountPercent: client.discountPercent ? String(client.discountPercent) : '',
      discountCategory: client.discountCategory || '',
    });
    setFormError('');
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (form.type === 'company' && !form.companyName.trim()) {
      setFormError('Le nom de l\'entreprise est requis');
      return;
    }
    if (form.type === 'individual' && (!form.firstName.trim() || !form.lastName.trim())) {
      setFormError('Le prénom et le nom sont requis');
      return;
    }

    const data = {
      type: form.type,
      companyName: form.type === 'company' ? form.companyName.trim() : undefined,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      vatNumber: form.vatNumber.trim() || undefined,
      siret: form.siret.trim() || undefined,
      notes: form.notes.trim(),
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      discountCategory: form.discountCategory || undefined,
    };

    let result;
    if (editingId) {
      result = updateClient(editingId, data);
    } else {
      result = createClient(data);
    }

    if (!result.success) {
      setFormError(result.error || 'Erreur inconnue');
      return;
    }

    setFormVisible(false);
    setFormError('');
  }, [form, editingId, createClient, updateClient]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteClient(deleteConfirm);
      if (selectedClient === deleteConfirm) setSelectedClient(null);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteClient, selectedClient]);

  const handleDuplicate = useCallback(() => {
    if (!editingId) return;
    const client = activeClients.find(c => c.id === editingId);
    if (!client) return;
    const nameSuffix = ' - Copy';
    const data = {
      type: client.type,
      companyName: client.companyName ? client.companyName + nameSuffix : '',
      firstName: client.firstName + (client.type === 'individual' ? nameSuffix : ''),
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      postalCode: client.postalCode,
      country: client.country,
      vatNumber: client.vatNumber || undefined,
      siret: client.siret || undefined,
      notes: client.notes,
      discountPercent: client.discountPercent,
      discountCategory: client.discountCategory || undefined,
    };
    const result = createClient(data);
    if (result.success) {
      setFormVisible(false);
    }
  }, [editingId, activeClients, createClient]);

  const updateField = useCallback(<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('clients.title')}
        action={
          <View style={{ flexDirection: 'row' as const, gap: 6 }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setCsvImportVisible(true)}>
              <Upload size={16} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary }} onPress={openCreate} testID="create-client-btn">
              <Plus size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        }
      />
      <View style={styles.body}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher par nom, email, TVA..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            testID="client-search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.sortChip,
                {
                  backgroundColor: sortBy === opt.value ? colors.primary : colors.card,
                  borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder,
                },
              ]}
              onPress={() => setSortBy(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredClients.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
              <Building size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {search ? 'Aucun résultat' : 'Aucun client pour l’instant'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>
              {search ? 'Essayez un autre terme de recherche' : 'Commencez par ajouter votre premier client !'}
            </Text>
            {!search && (
              <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]} onPress={openCreate} activeOpacity={0.7}>
                <Plus size={14} color="#FFF" />
                <Text style={styles.emptyActionBtnText}>Nouveau client</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={[styles.mainContent, isMobile && { flexDirection: 'column' }]}>
          <ScrollView style={[styles.listSection, isMobile && selected ? { maxHeight: 300 } : undefined]} showsVerticalScrollIndicator={false}>
            {filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.clientCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: selectedClient === client.id ? colors.primary : colors.cardBorder,
                  },
                ]}
                onPress={() => handleSelect(client.id)}
                activeOpacity={0.7}
                testID={`client-card-${client.id}`}
              >
                <View style={styles.clientHeader}>
                  <View style={[styles.avatar, { backgroundColor: client.type === 'company' ? colors.primaryLight : colors.successLight }]}>
                    {client.type === 'company' ? (
                      <Building size={16} color={colors.primary} />
                    ) : (
                      <User size={16} color={colors.success} />
                    )}
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={[styles.clientName, { color: colors.text }]}>
                      {client.companyName || `${client.firstName} ${client.lastName}`}
                    </Text>
                    {client.companyName ? (
                      <Text style={[styles.clientContact, { color: colors.textSecondary }]}>
                        {client.firstName} {client.lastName}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => openEdit(client)} style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]} hitSlop={6}>
                      <Pencil size={13} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeleteConfirm(client.id)} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]} hitSlop={6}>
                      <Trash2 size={13} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.clientMeta}>
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                    {client.totalOrders} commandes
                  </Text>
                  <Text style={[styles.metaValue, { color: colors.text }]}>
                    {formatCurrency((() => {
                      let rev = 0;
                      invoices.filter(i => i.status === 'paid' && i.clientId === client.id).forEach(i => { rev += i.totalTTC; });
                      sales.filter(s => s.status === 'paid' && s.clientId === client.id && (!s.convertedToInvoiceId || !invoices.some(i => i.id === s.convertedToInvoiceId && i.status === 'paid'))).forEach(s => { rev += s.totalTTC; });
                      return rev;
                    })(), cur)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selected && (
            <View style={[styles.detailPanel, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailAvatar, { backgroundColor: selected.type === 'company' ? colors.primaryLight : colors.successLight }]}>
                  {selected.type === 'company' ? (
                    <Building size={24} color={colors.primary} />
                  ) : (
                    <User size={24} color={colors.success} />
                  )}
                </View>
                <Text style={[styles.detailName, { color: colors.text }]}>
                  {selected.companyName || `${selected.firstName} ${selected.lastName}`}
                </Text>
                {selected.companyName ? (
                  <Text style={[styles.detailContact, { color: colors.textSecondary }]}>
                    Contact: {selected.firstName} {selected.lastName}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>COORDONNÉES</Text>
                <View style={styles.detailRow}>
                  <Mail size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.text }]}>{selected.email || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Phone size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.text }]}>{formatPhone(selected.phone)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text style={[styles.detailText, { color: colors.text }]}>
                    {selected.address ? `${selected.address}, ${selected.postalCode} ${selected.city}` : '—'}
                  </Text>
                </View>
              </View>

              {(selected.vatNumber || selected.siret) ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>INFORMATIONS FISCALES</Text>
                  {selected.vatNumber ? <Text style={[styles.detailText, { color: colors.text }]}>TVA: {selected.vatNumber}</Text> : null}
                  {selected.siret ? <Text style={[styles.detailText, { color: colors.text, marginTop: 4 }]}>SIRET: {selected.siret}</Text> : null}
                </View>
              ) : null}

              <View style={styles.detailSection}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>STATISTIQUES</Text>
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                    <Text style={[styles.statBoxValue, { color: colors.text }]}>{selected.totalOrders}</Text>
                    <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>Commandes</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.background }]}>
                    <Text style={[styles.statBoxValue, { color: colors.text }]}>{formatCurrency((() => {
                      let rev = 0;
                      invoices.filter(i => i.status === 'paid' && i.clientId === selected.id).forEach(i => { rev += i.totalTTC; });
                      sales.filter(s => s.status === 'paid' && s.clientId === selected.id && (!s.convertedToInvoiceId || !invoices.some(i => i.id === s.convertedToInvoiceId && i.status === 'paid'))).forEach(s => { rev += s.totalTTC; });
                      return rev;
                    })(), cur)}</Text>
                    <Text style={[styles.statBoxLabel, { color: colors.textSecondary }]}>CA total</Text>
                  </View>
                </View>
              </View>

              {selected.notes ? (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>NOTES</Text>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>{selected.notes}</Text>
                </View>
              ) : null}

              <Text style={[styles.createdAt, { color: colors.textTertiary }]}>
                Client depuis le {formatDate(selected.createdAt)}
              </Text>

              <View style={styles.detailActions}>
                <TouchableOpacity style={[styles.detailBtn, { backgroundColor: colors.primary }]} onPress={() => openEdit(selected)}>
                  <Pencil size={14} color="#FFF" />
                  <Text style={styles.detailBtnText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detailBtn, { backgroundColor: '#0369A1' }]} onPress={() => setHistoryVisible(true)}>
                  <Clock size={14} color="#FFF" />
                  <Text style={styles.detailBtnText}>Historique</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.detailBtn, { backgroundColor: colors.danger }]} onPress={() => setDeleteConfirm(selected.id)}>
                  <Trash2 size={14} color="#FFF" />
                  <Text style={styles.detailBtnText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier le client' : 'Nouveau client'}
        subtitle={editingId ? 'Mettre à jour les informations du client' : 'Remplissez les informations du nouveau client'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer le client'}
        headerActions={editingId ? (
          <>
            <TouchableOpacity onPress={handleDuplicate} style={[styles.iconBtn, { backgroundColor: '#E0F2FE' }]} hitSlop={6}>
              <Copy size={15} color="#0369A1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]} hitSlop={6}>
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

        <SelectField
          label="Type de client"
          value={form.type}
          options={[
            { label: 'Entreprise', value: 'company' },
            { label: 'Particulier', value: 'individual' },
          ]}
          onSelect={(v) => updateField('type', v as 'company' | 'individual')}
          required
        />

        {form.type === 'company' && (
          <FormField
            label="Raison sociale"
            value={form.companyName}
            onChangeText={(v) => updateField('companyName', v)}
            placeholder="Ex: Acme SAS"
            required
            testID="client-company-name"
          />
        )}

        {form.type === 'individual' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <FormField
                label="Prénom"
                value={form.firstName}
                onChangeText={(v) => updateField('firstName', v)}
                placeholder="Prénom"
                required
                testID="client-first-name"
              />
            </View>
            <View style={styles.formCol}>
              <FormField
                label="Nom"
                value={form.lastName}
                onChangeText={(v) => updateField('lastName', v)}
                placeholder="Nom"
                required
                testID="client-last-name"
              />
            </View>
          </View>
        )}

        {form.type === 'company' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <FormField
                label="Prénom contact (optionnel)"
                value={form.firstName}
                onChangeText={(v) => updateField('firstName', v)}
                placeholder="Prénom"
                testID="client-contact-first"
              />
            </View>
            <View style={styles.formCol}>
              <FormField
                label="Nom contact (optionnel)"
                value={form.lastName}
                onChangeText={(v) => updateField('lastName', v)}
                placeholder="Nom"
                testID="client-contact-last"
              />
            </View>
          </View>
        )}

        <FormField
          label="Email"
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          placeholder="email@example.com"
          keyboardType="email-address"
          testID="client-email"
        />

        <PhoneField
          value={form.phone}
          onChangeText={(v) => updateField('phone', v)}
          testID="client-phone"
        />

        <AddressFields
          address={form.address}
          postalCode={form.postalCode}
          city={form.city}
          country={form.country}
          onAddressChange={(v) => updateField('address', v)}
          onPostalCodeChange={(v) => updateField('postalCode', v)}
          onCityChange={(v) => updateField('city', v)}
          onCountryChange={(v) => updateField('country', v)}
        />

        {form.type === 'company' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <FormField
                label="N° TVA"
                value={form.vatNumber}
                onChangeText={(v) => updateField('vatNumber', v)}
                placeholder="FR12345678901"
              />
            </View>
            <View style={styles.formCol}>
              <FormField
                label="SIRET"
                value={form.siret}
                onChangeText={(v) => updateField('siret', v)}
                placeholder="123 456 789 00012"
              />
            </View>
          </View>
        )}

        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <FormField
              label="Remise client (%)"
              value={form.discountPercent}
              onChangeText={(v) => updateField('discountPercent', v)}
              placeholder="Ex: 10"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.formCol}>
            <DropdownPicker
              label="Catégorie de remise"
              value={form.discountCategory || ''}
              options={discountCategories.map(c => ({ label: c, value: c }))}
              onSelect={(v) => updateField('discountCategory', v)}
              placeholder="Sélectionner..."
              onAddNew={addDiscountCategory}
              addLabel="Nouvelle catégorie"
            />
          </View>
        </View>

        <FormField
          label="Notes"
          value={form.notes}
          onChangeText={(v) => updateField('notes', v)}
          placeholder="Notes internes..."
          multiline
          numberOfLines={3}
        />
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer ce client ?"
        message="Le client sera marqué comme supprimé. Cette action peut être annulée par un administrateur."
        confirmLabel="Supprimer"
        destructive
      />

      {selected && (
        <ClientHistoryModal
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
          client={selected}
          invoices={invoices}
          quotes={quotes}
          sales={sales}
          reminderLogs={reminderLogs}
          creditNotes={creditNotes}
          cashMovements={cashMovements}
          currency={cur}
          onNavigate={(route: string) => {
            setHistoryVisible(false);
            router.push(route as any);
          }}
        />
      )}

      <CSVImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        type="clients"
        appFields={[
          { key: 'companyName', label: 'Raison sociale' },
          { key: 'firstName', label: 'Prénom', required: true },
          { key: 'lastName', label: 'Nom', required: true },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Téléphone' },
          { key: 'address', label: 'Adresse' },
          { key: 'city', label: 'Ville' },
          { key: 'postalCode', label: 'Code postal' },
          { key: 'country', label: 'Pays' },
          { key: 'notes', label: 'Notes' },
        ]}
        onImport={(rows) => {
          const clientsData = rows.map((row) => ({
            type: (row.companyName ? 'company' : 'individual') as 'company' | 'individual',
            companyName: row.companyName || undefined,
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            email: row.email || '',
            phone: row.phone || '',
            address: row.address || '',
            city: row.city || '',
            postalCode: row.postalCode || '',
            country: row.country || 'France',
            notes: row.notes || '',
          }));
          return importClients(clientsData);
        }}
      />
    </View>
  );
}

function ClientHistoryModal({
  visible, onClose, client, invoices, quotes, sales, reminderLogs, creditNotes, cashMovements, currency, onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  client: Client;
  invoices: any[];
  quotes: any[];
  sales: any[];
  reminderLogs: any[];
  creditNotes: any[];
  cashMovements: any[];
  currency: string;
  onNavigate?: (route: string) => void;
}) {
  const { colors } = useTheme();

  const timeline = useMemo(() => {
    const events: Array<{ id: string; date: string; type: string; icon: string; title: string; subtitle: string; amount?: number }> = [];
    invoices.filter((i: any) => i.clientId === client.id).forEach((inv: any) => {
      events.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt || inv.issueDate,
        type: 'invoice',
        icon: 'invoice',
        title: `Facture ${inv.invoiceNumber || 'Brouillon'}`,
        subtitle: `Statut: ${inv.status === 'paid' ? 'Payée' : inv.status === 'validated' ? 'Validée' : inv.status === 'sent' ? 'Envoyée' : inv.status === 'late' ? 'En retard' : 'Brouillon'}`,
        amount: inv.totalTTC,
      });
    });
    quotes.filter((q: any) => q.clientId === client.id).forEach((qt: any) => {
      events.push({
        id: `qt-${qt.id}`,
        date: qt.createdAt || qt.issueDate,
        type: 'quote',
        icon: 'quote',
        title: `Devis ${qt.quoteNumber}`,
        subtitle: `Statut: ${qt.status === 'accepted' ? 'Accepté' : qt.status === 'refused' ? 'Refusé' : qt.status === 'sent' ? 'Envoyé' : 'Brouillon'}`,
        amount: qt.totalTTC,
      });
    });
    sales.filter((s: any) => s.clientId === client.id).forEach((s: any) => {
      events.push({
        id: `sale-${s.id}`,
        date: s.createdAt,
        type: 'sale',
        icon: 'sale',
        title: `Vente ${s.saleNumber}`,
        subtitle: s.status === 'refunded' ? 'Remboursée' : 'Payée',
        amount: s.totalTTC,
      });
    });
    cashMovements.filter((cm: any) => cm.description?.includes(client.companyName || `${client.firstName} ${client.lastName}`)).forEach((cm: any) => {
      events.push({
        id: `cm-${cm.id}`,
        date: cm.date || cm.createdAt,
        type: 'payment',
        icon: 'payment',
        title: cm.type === 'income' ? 'Paiement reçu' : 'Décaissement',
        subtitle: cm.description,
        amount: cm.amount,
      });
    });
    reminderLogs.filter((r: any) => r.clientName === (client.companyName || `${client.firstName} ${client.lastName}`)).forEach((r: any) => {
      events.push({
        id: `rem-${r.id}`,
        date: r.sentAt || r.createdAt,
        type: 'reminder',
        icon: 'reminder',
        title: `Relance niveau ${r.level}`,
        subtitle: `Facture ${r.invoiceNumber || r.invoiceId}`,
      });
    });
    creditNotes.filter((cn: any) => cn.clientId === client.id).forEach((cn: any) => {
      events.push({
        id: `cn-${cn.id}`,
        date: cn.createdAt || cn.issueDate,
        type: 'credit_note',
        icon: 'credit_note',
        title: `Avoir ${cn.creditNoteNumber}`,
        subtitle: `Facture ${cn.invoiceNumber}`,
        amount: cn.totalTTC,
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [client, invoices, quotes, sales, cashMovements, reminderLogs, creditNotes]);

  const getEventColor = useCallback((type: string) => {
    switch (type) {
      case 'invoice': return colors.primary;
      case 'quote': return '#7C3AED';
      case 'sale': return colors.success;
      case 'payment': return '#059669';
      case 'reminder': return colors.warning;
      case 'credit_note': return colors.danger;
      default: return colors.textTertiary;
    }
  }, [colors]);

  const getEventIcon = useCallback((type: string) => {
    switch (type) {
      case 'invoice': return <FileText size={14} color="#FFF" />;
      case 'quote': return <FileText size={14} color="#FFF" />;
      case 'sale': return <CreditCard size={14} color="#FFF" />;
      case 'payment': return <CreditCard size={14} color="#FFF" />;
      case 'reminder': return <Bell size={14} color="#FFF" />;
      case 'credit_note': return <FileText size={14} color="#FFF" />;
      default: return <Clock size={14} color="#FFF" />;
    }
  }, []);

  const clientName = client.companyName || `${client.firstName} ${client.lastName}`;

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={`Historique — ${clientName}`}
      subtitle={`${timeline.length} événement(s)`}
      showCancel={false}
      width={600}
    >
      {timeline.length === 0 ? (
        <View style={histStyles.empty}>
          <Clock size={32} color={colors.textTertiary} />
          <Text style={[histStyles.emptyText, { color: colors.textTertiary }]}>Aucun historique</Text>
        </View>
      ) : (
        <View style={histStyles.timeline}>
          <View style={[histStyles.tableHeader, { borderBottomColor: colors.border }]}>
            <Text style={[histStyles.colDate, histStyles.headerText, { color: colors.textTertiary }]}>Date</Text>
            <Text style={[histStyles.colType, histStyles.headerText, { color: colors.textTertiary }]}>Document</Text>
            <Text style={[histStyles.colStatus, histStyles.headerText, { color: colors.textTertiary }]}>Statut</Text>
            <Text style={[histStyles.colAmount, histStyles.headerText, { color: colors.textTertiary }]}>Montant</Text>
          </View>
          {timeline.map((event, idx) => (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.6}
              onPress={() => {
                if (!onNavigate) return;
                const rawId = event.id;
                switch (event.type) {
                  case 'invoice': {
                    const invId = rawId.replace('inv-', '');
                    onNavigate(`/ventes?tab=factures&selectedId=${invId}`);
                    break;
                  }
                  case 'quote': {
                    const qtId = rawId.replace('qt-', '');
                    onNavigate(`/ventes?tab=devis&selectedId=${qtId}`);
                    break;
                  }
                  case 'sale': {
                    const saleId = rawId.replace('sale-', '');
                    onNavigate(`/sales?selectedId=${saleId}`);
                    break;
                  }
                  case 'credit_note': {
                    const cnId = rawId.replace('cn-', '');
                    onNavigate(`/ventes?tab=avoirs&selectedId=${cnId}`);
                    break;
                  }
                  case 'payment': onNavigate('/cashflow'); break;
                  case 'reminder': onNavigate('/ventes?tab=relances'); break;
                }
              }}
              style={[
                histStyles.tableRow,
                { borderBottomColor: colors.borderLight },
                idx % 2 === 0 && { backgroundColor: colors.background + '40' },
              ]}
            >
              <View style={histStyles.colDate}>
                <Text style={[histStyles.dateText, { color: colors.textSecondary }]}>{formatDate(event.date)}</Text>
              </View>
              <View style={[histStyles.colType, { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }]}>
                <View style={[histStyles.typeDot, { backgroundColor: getEventColor(event.type) }]}>
                  {getEventIcon(event.type)}
                </View>
                <Text style={[histStyles.typeText, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
              </View>
              <View style={histStyles.colStatus}>
                <Text style={[histStyles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>{event.subtitle}</Text>
              </View>
              <View style={histStyles.colAmount}>
                {event.amount !== undefined ? (
                  <Text style={[histStyles.amountText, { color: event.type === 'credit_note' ? colors.danger : colors.text }]}>
                    {event.type === 'credit_note' ? '-' : ''}{formatCurrency(event.amount, currency)}
                  </Text>
                ) : (
                  <Text style={[histStyles.amountText, { color: colors.textTertiary }]}>—</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </FormModal>
  );
}

const histStyles = StyleSheet.create({
  empty: { alignItems: 'center' as const, paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14 },
  timeline: { gap: 0 },
  tableHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  headerText: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  tableRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  colDate: { width: 80 },
  colType: { flex: 2, paddingRight: 8 },
  colStatus: { flex: 2, paddingRight: 8 },
  colAmount: { width: 90, alignItems: 'flex-end' as const },
  dateText: { fontSize: 12 },
  typeDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  typeText: { fontSize: 13, fontWeight: '500' as const, flex: 1 },
  statusText: { fontSize: 12 },
  amountText: { fontSize: 13, fontWeight: '600' as const },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, padding: 24, gap: 16 },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' as never },
  mainContent: { flex: 1, flexDirection: 'row' as const, gap: 16 },
  listSection: { flex: 1 },
  clientCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  clientHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: '600' as const },
  clientContact: { fontSize: 12, marginTop: 1 },
  clientMeta: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  metaText: { fontSize: 12 },
  metaValue: { fontSize: 14, fontWeight: '600' as const },
  cardActions: { flexDirection: 'row' as const, gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6 },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  detailPanel: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 24, maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  detailHeader: { alignItems: 'center' as const, marginBottom: 20 },
  detailAvatar: { width: 56, height: 56, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 },
  detailName: { fontSize: 18, fontWeight: '700' as const, textAlign: 'center' as const },
  detailContact: { fontSize: 13, marginTop: 4, textAlign: 'center' as const },
  detailDivider: { height: 1, marginBottom: 16 },
  detailSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 10 },
  detailRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 8 },
  detailText: { fontSize: 13, flex: 1 },
  statsGrid: { flexDirection: 'row' as const, gap: 10 },
  statBox: { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' as const },
  statBoxValue: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  statBoxLabel: { fontSize: 11, marginTop: 4, opacity: 0.7 },
  createdAt: { fontSize: 11, textAlign: 'center' as const, marginTop: 8 },
  detailActions: { flexDirection: 'row' as const, gap: 8, marginTop: 16 },
  detailBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 10, borderRadius: 8, gap: 6 },
  detailBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const },
  emptyDesc: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  emptyActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, marginTop: 8 },
  emptyActionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  formRow: { flexDirection: 'row' as const, gap: 12 },
  formCol: { flex: 1 },
  sortRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  sortChipText: { fontSize: 12, fontWeight: '500' as const },
});
