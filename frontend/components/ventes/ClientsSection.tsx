/**
 * components/ventes/ClientsSection.tsx
 *
 * Section Clients de l'écran Ventes.
 * Responsabilités :
 *   - Liste triée/filtrée des clients avec CA et nombre de factures
 *   - CRUD client (création, édition, suppression)
 *   - Historique client (factures, devis, ventes, avoirs, relances)
 *   - Import CSV via UniversalImportModal
 *   - Export CSV
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import {
  Search, Plus, Users, ArrowUpDown, X, Clock, Trash2, Upload, Download,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import UniversalImportModal from '@/components/UniversalImportModal';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import DropdownPicker from '@/components/DropdownPicker';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import { FileText } from 'lucide-react-native';
import { styles } from './ventesStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSortKey = 'az' | 'za' | 'date' | 'revenue';

const CLIENT_SORT_OPTIONS: { value: ClientSortKey; label: string }[] = [
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'date', label: 'Date' },
  { value: 'revenue', label: 'CA' },
];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ClientsSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    activeClients, createClient, updateClient, deleteClient,
    invoices, company, sales,
    discountCategories, discountCategoryRates,
    addDiscountCategory, updateDiscountCategoryRate, removeDiscountCategory,
    quotes, reminderLogs, creditNotes,
  } = useData();
  const cur = company.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ClientSortKey>('az');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [csvImportVisible, setCsvImportVisible] = useState(false);

  const [form, setForm] = useState({
    type: 'company' as 'company' | 'individual',
    companyName: '', firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', postalCode: '', country: 'France',
    vatNumber: '', siret: '', notes: '', discountPercent: '', discountCategory: '',
  });

  // ── Calculs CA et nombre de factures par client ────────────────────────────

  const clientInvoiceCount = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((inv) => { counts[inv.clientId] = (counts[inv.clientId] || 0) + 1; });
    return counts;
  }, [invoices]);

  const clientRevenue = useMemo(() => {
    const rev: Record<string, number> = {};
    invoices.filter((i) => i.status === 'paid').forEach((inv) => {
      rev[inv.clientId] = (rev[inv.clientId] || 0) + inv.totalTTC;
    });
    sales.filter((s) => s.status === 'paid' && s.clientId).forEach((s) => {
      if (s.clientId) {
        const alreadyCounted = s.convertedToInvoiceId && invoices.some((i) => i.id === s.convertedToInvoiceId && i.status === 'paid');
        if (!alreadyCounted) rev[s.clientId] = (rev[s.clientId] || 0) + s.totalTTC;
      }
    });
    return rev;
  }, [invoices, sales]);

  const filtered = useMemo(() => {
    let list = activeClients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.companyName?.toLowerCase().includes(q)) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const nameA = (a.companyName || `${a.firstName} ${a.lastName}`).toLowerCase();
      const nameB = (b.companyName || `${b.firstName} ${b.lastName}`).toLowerCase();
      switch (sortBy) {
        case 'az': return nameA.localeCompare(nameB);
        case 'za': return nameB.localeCompare(nameA);
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'revenue': return (clientRevenue[b.id] || 0) - (clientRevenue[a.id] || 0);
        default: return 0;
      }
    });
  }, [activeClients, search, sortBy, clientRevenue]);

  // ── Handlers formulaire ────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm({ type: 'company', companyName: '', firstName: '', lastName: '', email: '', phone: '', address: '', city: '', postalCode: '', country: 'France', vatNumber: '', siret: '', notes: '', discountPercent: '', discountCategory: '' });
    setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    const c = activeClients.find((cl) => cl.id === id);
    if (!c) return;
    setEditingId(id);
    setForm({
      type: c.type, companyName: c.companyName || '', firstName: c.firstName,
      lastName: c.lastName, email: c.email, phone: c.phone, address: c.address,
      city: c.city, postalCode: c.postalCode, country: c.country,
      vatNumber: c.vatNumber || '', siret: c.siret || '', notes: c.notes,
      discountPercent: c.discountPercent ? String(c.discountPercent) : '',
      discountCategory: c.discountCategory || '',
    });
    setFormError('');
    setFormVisible(true);
  }, [activeClients]);

  const handleSubmit = useCallback(() => {
    const submitData = {
      ...form,
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      discountCategory: form.discountCategory || undefined,
    };
    const result = editingId ? updateClient(editingId, submitData) : createClient(submitData);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createClient, updateClient]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { deleteClient(deleteConfirm); setDeleteConfirm(null); }
  }, [deleteConfirm, deleteClient]);

  // ── Historique client ──────────────────────────────────────────────────────

  const renderClientHistory = () => {
    if (!historyClientId) return null;
    const histClient = activeClients.find((c) => c.id === historyClientId);
    if (!histClient) return null;
    const clientName = histClient.companyName || `${histClient.firstName} ${histClient.lastName}`;

    const events: Array<{ id: string; date: string; type: string; title: string; subtitle: string; amount?: number }> = [];
    invoices.filter((inv) => inv.clientId === historyClientId).forEach((inv) => {
      events.push({ id: `inv-${inv.id}`, date: inv.createdAt || inv.issueDate, type: 'invoice', title: `Facture ${inv.invoiceNumber || 'Brouillon'}`, subtitle: inv.status === 'paid' ? 'Payée' : inv.status === 'validated' ? 'Validée' : inv.status === 'sent' ? 'Envoyée' : inv.status === 'late' ? 'En retard' : 'Brouillon', amount: inv.totalTTC });
    });
    quotes.filter((q) => q.clientId === historyClientId).forEach((q) => {
      events.push({ id: `qt-${q.id}`, date: q.createdAt || q.issueDate, type: 'quote', title: `Devis ${q.quoteNumber}`, subtitle: q.status === 'accepted' ? 'Accepté' : q.status === 'refused' ? 'Refusé' : 'Envoyé', amount: q.totalTTC });
    });
    sales.filter((s) => s.clientId === historyClientId).forEach((s) => {
      events.push({ id: `sale-${s.id}`, date: s.createdAt, type: 'sale', title: `Vente ${s.saleNumber}`, subtitle: s.status === 'refunded' ? 'Remboursée' : 'Payée', amount: s.totalTTC });
    });
    creditNotes.filter((cn) => cn.clientId === historyClientId).forEach((cn) => {
      events.push({ id: `cn-${cn.id}`, date: cn.createdAt || cn.issueDate, type: 'credit_note', title: `Avoir ${cn.creditNoteNumber}`, subtitle: `Facture ${cn.invoiceNumber}`, amount: cn.totalTTC });
    });
    reminderLogs.filter((r) => r.clientName === clientName).forEach((r) => {
      events.push({ id: `rem-${r.id}`, date: r.sentAt || r.createdAt, type: 'reminder', title: `Relance niveau ${r.level}`, subtitle: `Facture ${r.invoiceNumber || r.invoiceId}` });
    });
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const getColor = (type: string) => type === 'invoice' ? colors.primary : type === 'quote' ? '#7C3AED' : type === 'sale' ? colors.success : type === 'reminder' ? colors.warning : type === 'credit_note' ? colors.danger : colors.textTertiary;

    return (
      <FormModal
        visible
        onClose={() => setHistoryClientId(null)}
        title={`Historique — ${clientName}`}
        subtitle={`${events.length} événement(s)`}
        showCancel={false}
        width={500}
      >
        {events.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
            <Clock size={32} color={colors.textTertiary} />
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>Aucun historique</Text>
          </View>
        ) : (
          <View style={{ gap: 0 }}>
            {events.map((event, idx) => (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.6}
                onPress={() => {
                  setHistoryClientId(null);
                  const rawId = event.id;
                  switch (event.type) {
                    case 'invoice': router.push(`/ventes?tab=factures&selectedId=${rawId.replace('inv-', '')}` as any); break;
                    case 'quote': router.push(`/ventes?tab=devis&selectedId=${rawId.replace('qt-', '')}` as any); break;
                    case 'sale': router.push(`/sales?selectedId=${rawId.replace('sale-', '')}` as any); break;
                    case 'credit_note': router.push('/ventes?tab=avoirs' as any); break;
                    case 'reminder': router.push('/ventes?tab=relances' as any); break;
                    case 'payment': router.push('/cashflow' as any); break;
                  }
                }}
                style={{ flexDirection: 'row', gap: 12, minHeight: 60 }}
              >
                <View style={{ alignItems: 'center', width: 32 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: getColor(event.type), alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <FileText size={14} color="#FFF" />
                  </View>
                  {idx < events.length - 1 && <View style={{ width: 2, flex: 1, marginTop: 4, backgroundColor: colors.border }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{event.title}</Text>
                    {event.amount !== undefined && (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: event.type === 'credit_note' ? colors.danger : colors.text }}>
                        {event.type === 'credit_note' ? '-' : ''}{formatCurrency(event.amount, cur)}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, marginTop: 2, color: colors.textSecondary }}>{event.subtitle}</Text>
                  <Text style={{ fontSize: 11, marginTop: 2, color: colors.textTertiary }}>{formatDate(event.date)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </FormModal>
    );
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Barre recherche + actions */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Rechercher un client..." placeholderTextColor={colors.textTertiary} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}><X size={16} color={colors.textTertiary} /></TouchableOpacity>}
        </View>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setCsvImportVisible(true)}>
          <Upload size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconActionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'companyName', label: 'Raison sociale' }, { key: 'firstName', label: 'Prénom' },
              { key: 'lastName', label: 'Nom' }, { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Téléphone' }, { key: 'address', label: 'Adresse' },
              { key: 'city', label: 'Ville' }, { key: 'postalCode', label: 'Code postal' },
              { key: 'country', label: 'Pays' },
            ];
            void exportToCSV(activeClients.map((c) => ({ ...c } as unknown as Record<string, unknown>)), cols, `clients_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        <ArrowUpDown size={13} color={colors.textTertiary} />
        {CLIENT_SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.sortChip, { backgroundColor: sortBy === opt.value ? colors.primary : colors.card, borderColor: sortBy === opt.value ? colors.primary : colors.cardBorder }]}
            onPress={() => setSortBy(opt.value)}
          >
            <Text style={[styles.sortChipText, { color: sortBy === opt.value ? '#FFF' : colors.textSecondary }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Users size={28} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{search ? 'Aucun résultat' : 'Aucun client pour l\'instant'}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>{search ? 'Essayez un autre terme' : 'Ajoutez votre premier client pour commencer'}</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile && (
            <View style={[styles.clientHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.clientColHeader, { flex: 2, color: colors.textTertiary }]}>Client</Text>
              <Text style={[styles.clientColHeader, { flex: 2, color: colors.textTertiary }]}>Contact</Text>
              <Text style={[styles.clientColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' }]}>Factures</Text>
              <Text style={[styles.clientColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' }]}>CA total</Text>
            </View>
          )}
          {filtered.map((client, i) => {
            const name = client.companyName || `${client.firstName} ${client.lastName}`;
            const invCount = clientInvoiceCount[client.id] || 0;
            const revenue = clientRevenue[client.id] || 0;
            return isMobile ? (
              <TouchableOpacity key={client.id} style={[styles.listRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(client.id)} activeOpacity={0.7}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{client.email || '—'}</Text>
                  </View>
                </View>
                <View style={styles.clientMobileStats}>
                  <Text style={[styles.clientMobileStatText, { color: colors.textTertiary }]}>{formatPhone(client.phone)} · {client.city || '—'}</Text>
                  <Text style={[styles.clientMobileStatText, { color: colors.textTertiary }]}>{invCount} fact.</Text>
                  <Text style={[styles.clientMobileStatText, { color: colors.success, fontWeight: '600' }]}>{formatCurrency(revenue, cur)}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={client.id} style={[styles.clientRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => openEdit(client.id)} activeOpacity={0.7}>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.listRowTitle, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{client.email || '—'}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.clientContactText, { color: colors.text }]} numberOfLines={1}>{formatPhone(client.phone)}</Text>
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>{client.city || '—'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={[styles.clientStatBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.clientStatText, { color: colors.primary }]}>{invCount}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.clientRevenueText, { color: colors.success }]}>{formatCurrency(revenue, cur)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Formulaire création/édition */}
      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? 'Modifier le client' : 'Nouveau client'}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Mettre à jour' : 'Créer'}
        headerActions={editingId ? (
          <>
            <TouchableOpacity onPress={() => { setFormVisible(false); setHistoryClientId(editingId); }} style={[styles.iconBtn, { backgroundColor: '#E0F2FE' }]}>
              <Clock size={15} color="#0369A1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFormVisible(false); setDeleteConfirm(editingId); }} style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}>
              <Trash2 size={15} color={colors.danger} />
            </TouchableOpacity>
          </>
        ) : undefined}
      >
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        <DropdownPicker label="Type" value={form.type} options={[{ label: 'Entreprise', value: 'company' }, { label: 'Particulier', value: 'individual' }]} onSelect={(v) => setForm((p) => ({ ...p, type: v as 'company' | 'individual' }))} required />
        {form.type === 'company' && <FormField label="Raison sociale" value={form.companyName} onChangeText={(v) => setForm((p) => ({ ...p, companyName: v }))} placeholder="Nom de l'entreprise" required />}
        {form.type === 'individual' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}><FormField label="Prénom" value={form.firstName} onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder="Prénom" required /></View>
            <View style={styles.formCol}><FormField label="Nom" value={form.lastName} onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder="Nom" required /></View>
          </View>
        )}
        {form.type === 'company' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}><FormField label="Prénom contact (optionnel)" value={form.firstName} onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder="Prénom" /></View>
            <View style={styles.formCol}><FormField label="Nom contact (optionnel)" value={form.lastName} onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder="Nom" /></View>
          </View>
        )}
        <FormField label="Email" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" />
        <PhoneField value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />
        <AddressFields address={form.address} postalCode={form.postalCode} city={form.city} country={form.country} onAddressChange={(v) => setForm((p) => ({ ...p, address: v }))} onPostalCodeChange={(v) => setForm((p) => ({ ...p, postalCode: v }))} onCityChange={(v) => setForm((p) => ({ ...p, city: v }))} onCountryChange={(v) => setForm((p) => ({ ...p, country: v }))} />
        <View style={styles.formRow}>
          <View style={styles.formCol}>
            <DropdownPicker
              label="Catégorie de remise"
              value={form.discountCategory}
              options={discountCategories.map((c) => ({ label: `${c} (${discountCategoryRates[c] ?? 0}%)`, value: c }))}
              onSelect={(v) => { const rate = discountCategoryRates[v]; setForm((p) => ({ ...p, discountCategory: v, discountPercent: rate !== undefined ? String(rate) : p.discountPercent })); }}
              placeholder="Sélectionner..."
              onAddNew={(name) => addDiscountCategory(name, 0)}
              addLabel="Nouvelle catégorie"
              onRenameItem={(oldVal, newVal) => { const rate = discountCategoryRates[oldVal] ?? 0; removeDiscountCategory(oldVal); addDiscountCategory(newVal, rate); if (form.discountCategory === oldVal) setForm((p) => ({ ...p, discountCategory: newVal })); }}
              onDeleteItem={(val) => { removeDiscountCategory(val); if (form.discountCategory === val) setForm((p) => ({ ...p, discountCategory: '', discountPercent: '' })); }}
            />
          </View>
          <View style={styles.formCol}>
            <FormField label="Remise client (%)" value={form.discountPercent} onChangeText={(v) => { setForm((p) => ({ ...p, discountPercent: v })); if (form.discountCategory && v) updateDiscountCategoryRate(form.discountCategory, parseFloat(v) || 0); }} placeholder="Ex: 10" keyboardType="decimal-pad" />
          </View>
        </View>
        <FormField label="Notes" value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Notes..." multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal visible={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="Supprimer ce client ?" message="Le client sera marqué comme supprimé." confirmLabel="Supprimer" destructive />

      <UniversalImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        title="Importer des clients"
        entityLabel="client"
        fields={[
          { key: 'companyName', label: 'Raison sociale', aliases: ['entreprise', 'société'] },
          { key: 'firstName', label: 'Prénom', aliases: ['prenom'] },
          { key: 'lastName', label: 'Nom', required: true, aliases: ['nom de famille'] },
          { key: 'email', label: 'Email', aliases: ['e-mail', 'mail'] },
          { key: 'phone', label: 'Téléphone', aliases: ['tel', 'portable'] },
          { key: 'address', label: 'Adresse', aliases: ['rue'] },
          { key: 'city', label: 'Ville' }, { key: 'postalCode', label: 'Code postal', aliases: ['cp', 'zip'] },
          { key: 'country', label: 'Pays' }, { key: 'vatNumber', label: 'N° TVA', aliases: ['tva', 'vat'] },
          { key: 'siret', label: 'SIRET' }, { key: 'notes', label: 'Notes', aliases: ['commentaire'] },
        ]}
        pastePlaceholder={"Nom;Prénom;Email;Téléphone;Adresse;Ville;Code postal;Pays\nDupont;Jean;jean@mail.com;+33612345678;12 rue de Paris;Paris;75001;France"}
        onImport={(rows) => {
          let imported = 0;
          const errors: string[] = [];
          rows.forEach((row, idx) => {
            const lastName = row.lastName?.trim() || row.companyName?.trim();
            if (!lastName) { errors.push(`Ligne ${idx + 1}: Nom ou raison sociale requis`); return; }
            const result = createClient({ type: row.companyName ? 'company' : 'individual', companyName: row.companyName || '', firstName: row.firstName || '', lastName: row.lastName || '', email: row.email || '', phone: row.phone || '', address: row.address || '', city: row.city || '', postalCode: row.postalCode || '', country: row.country || 'France', vatNumber: row.vatNumber || '', siret: row.siret || '', notes: row.notes || '' });
            if (result.success) imported++;
            else errors.push(`Ligne ${idx + 1}: ${result.error || 'Erreur'}`);
          });
          return { imported, errors };
        }}
      />

      {renderClientHistory()}
    </>
  );
}