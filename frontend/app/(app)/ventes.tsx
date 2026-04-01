/**
 * @fileoverview Sales management screen with main tabs: Clients, Quotes, Invoices, Orders.
 * Factures has sub-tabs: Factures, Avoirs, Relances, Récurrentes.
 * Commandes has sub-tabs: Commandes (shop orders), Livraisons (delivery notes).
 * Provides CRUD operations, email sending, PDF generation, and payment reminders.
 *
 * NOTE: String-based conditional rendering uses ternary (value ? <JSX> : null)
 * to avoid React Native Web "Unexpected text node" errors.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  useWindowDimensions, ActivityIndicator, Linking, Platform,
} from 'react-native';
import {
  Search, Plus, Users, FileText, ClipboardList, AlertCircle, Bell,
  X, Pencil, Trash2, Send, Check, Mail, ArrowUpDown, Printer,
  ChevronDown, ChevronUp, RefreshCw, Truck, Clock, MessageSquare, Smartphone,
  ShoppingCart, Ban, CreditCard, Globe, ChevronRight, Upload, Download,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, formatPhone } from '@/utils/format';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField, { SelectField } from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import StatusBadge from '@/components/StatusBadge';
import ClientPicker from '@/components/ClientPicker';
import LineItemsEditor, { type LineItem } from '@/components/LineItemsEditor';
import TotalsSummary from '@/components/TotalsSummary';
import { sendEmail, buildReminderEmailBody, buildQuoteEmailBody } from '@/services/emailService';
import { generateInvoiceHTML, generateAndSharePDF } from '@/services/pdfService';
import type { QuoteItem, OrderItem, RecurringFrequency, ShopOrder, ShopOrderStatus, ShopOrderItem } from '@/types';
import { SALES_ALLOWED_TYPES } from '@/constants/productTypes';
import AddressFields from '@/components/AddressFields';
import UniversalImportModal from '@/components/UniversalImportModal';
import { exportToCSV, type ExportColumn } from '@/utils/csvExport';
import PhoneField from '@/components/PhoneField';
import DropdownPicker from '@/components/DropdownPicker';
import PaymentReminderSheet from '@/components/PaymentReminderSheet';
import { useI18n } from '@/contexts/I18nContext';
import { shopDb } from '@/services/shopService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import EmptyState from '@/components/EmptyState';
import type { Invoice } from '@/types';

type VentesTab = 'clients' | 'devis' | 'factures' | 'commandes';
type FacturesSubTab = 'factures' | 'avoirs' | 'relances' | 'recurrentes';
type CommandesSubTab = 'commandes' | 'livraisons';

const VENTES_TAB_KEYS: { key: VentesTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'clients', labelKey: 'ventes.clients', icon: Users },
  { key: 'devis', labelKey: 'ventes.quotes', icon: ClipboardList },
  { key: 'factures', labelKey: 'ventes.invoices', icon: FileText },
  { key: 'commandes', labelKey: 'ventes.orders', icon: ShoppingCart },
];

export default function VentesScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { t } = useI18n();
  const params = useLocalSearchParams<{ tab?: string; selectedId?: string }>();
  const [activeTab, setActiveTab] = useState<VentesTab>('clients');
  const [facturesSubTab, setFacturesSubTab] = useState<FacturesSubTab>('factures');
  const [commandesSubTab, setCommandesSubTab] = useState<CommandesSubTab>('commandes');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.tab) {
      if (VENTES_TAB_KEYS.some(tk => tk.key === params.tab)) {
        setActiveTab(params.tab as VentesTab);
      }
      if (params.tab === 'avoirs' || params.tab === 'relances' || params.tab === 'recurrentes') {
        setActiveTab('factures');
        setFacturesSubTab(params.tab as FacturesSubTab);
      }
      if (params.tab === 'livraisons') {
        setActiveTab('commandes');
        setCommandesSubTab('livraisons');
      }
    }
    if (params.selectedId) {
      setHighlightedId(params.selectedId);
    }
  }, [params.tab, params.selectedId]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'clients': return <ClientsSection isMobile={isMobile} />;
      case 'devis': return <DevisSection isMobile={isMobile} highlightedId={highlightedId} onHighlightClear={() => setHighlightedId(null)} />;
      case 'factures': return (
        <FacturesTabWithSubTabs
          isMobile={isMobile}
          subTab={facturesSubTab}
          onSubTabChange={setFacturesSubTab}
          highlightedId={highlightedId}
          onHighlightClear={() => setHighlightedId(null)}
        />
      );
      case 'commandes': return (
        <CommandesTabWithSubTabs
          isMobile={isMobile}
          subTab={commandesSubTab}
          onSubTabChange={setCommandesSubTab}
        />
      );
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="ventes-screen">
      <PageHeader title={t('ventes.title')} />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {VENTES_TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                testID={`ventes-tab-${tab.key}`}
                style={[
                  styles.tab,
                  active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}
                onPress={() => {
                  setActiveTab(tab.key);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                activeOpacity={0.7}
              >
                <TabIcon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}

function FacturesTabWithSubTabs({
  isMobile, subTab, onSubTabChange, highlightedId, onHighlightClear,
}: {
  isMobile: boolean;
  subTab: FacturesSubTab;
  onSubTabChange: (t: FacturesSubTab) => void;
  highlightedId?: string | null;
  onHighlightClear?: () => void;
}) {
  const { colors } = useTheme();
  const { creditNotes, lateInvoices, recurringInvoices } = useData();

  const FACTURES_SUB_TABS: { key: FacturesSubTab; label: string; icon: React.ComponentType<{ size: number; color: string }>; count?: number }[] = [
    { key: 'factures', label: 'Factures', icon: FileText },
    { key: 'avoirs', label: 'Avoirs', icon: FileText, count: creditNotes.length },
    { key: 'relances', label: 'Relances', icon: Bell, count: lateInvoices.length },
    { key: 'recurrentes', label: 'Récurrentes', icon: RefreshCw, count: recurringInvoices.length },
  ];

  return (
    <>
      <View style={[ventesSubTabStyles.bar, { borderBottomColor: colors.border }]}>
        <View style={ventesSubTabStyles.tabsRow}>
          {FACTURES_SUB_TABS.map((tab) => {
            const active = subTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[ventesSubTabStyles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => onSubTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <tab.icon size={15} color={active ? colors.primary : colors.textTertiary} />
                <Text style={[ventesSubTabStyles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
                {(tab.count !== undefined && tab.count > 0) ? (
                  <View style={[ventesSubTabStyles.badge, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={[ventesSubTabStyles.badgeText, { color: colors.primary }]}>{tab.count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {subTab === 'factures' && <FacturesSection isMobile={isMobile} highlightedId={highlightedId} onHighlightClear={onHighlightClear} />}
      {subTab === 'avoirs' && <AvoirsSection isMobile={isMobile} />}
      {subTab === 'relances' && <RelancesSection isMobile={isMobile} />}
      {subTab === 'recurrentes' && <RecurrentesSection isMobile={isMobile} />}
    </>
  );
}

function CommandesTabWithSubTabs({
  isMobile, subTab, onSubTabChange,
}: {
  isMobile: boolean;
  subTab: CommandesSubTab;
  onSubTabChange: (t: CommandesSubTab) => void;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { deliveryNotes, getCurrency } = useData();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const currency = getCurrency();

  const ordersQuery = useQuery({
    queryKey: ['shop-orders', COMPANY_ID],
    queryFn: () => shopDb.fetchShopOrders(COMPANY_ID),
    staleTime: 10000,
  });
  const orders = ordersQuery.data ?? [];
  const newOrdersCount = orders.filter(o => o.status === 'en_attente').length;

  const COMMANDES_SUB_TABS: { key: CommandesSubTab; label: string; icon: React.ComponentType<{ size: number; color: string }>; count?: number }[] = [
    { key: 'commandes', label: 'Commandes', icon: ShoppingCart, count: newOrdersCount > 0 ? newOrdersCount : undefined },
    { key: 'livraisons', label: 'Livraisons', icon: Truck, count: deliveryNotes.length },
  ];

  return (
    <>
      <View style={[ventesSubTabStyles.bar, { borderBottomColor: colors.border }]}>
        <View style={ventesSubTabStyles.tabsRow}>
          {COMMANDES_SUB_TABS.map((tab) => {
            const active = subTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[ventesSubTabStyles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => onSubTabChange(tab.key)}
                activeOpacity={0.7}
              >
                <tab.icon size={15} color={active ? colors.primary : colors.textTertiary} />
                <Text style={[ventesSubTabStyles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
                {(tab.count !== undefined && tab.count > 0) ? (
                  <View style={[ventesSubTabStyles.badge, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={[ventesSubTabStyles.badgeText, { color: colors.primary }]}>{tab.count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, marginRight: 4 }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'orderNumber', label: 'ventes.orderNumber'},
              { key: 'customerFirstName', label: 'ventes.customerFirstName' },
              { key: 'customerLastName', label: 'ventes.customerLastName' },
              { key: 'customerEmail', label: 'ventes.customerEmail' },
              { key: 'status', label: 'ventes.status' },
              { key: 'totalTtc', label: 'ventes.totalTtc' },
              { key: 'deliveryMode', label: 'ventes.deliveryMode' },
              { key: 'paymentMethod', label: 'ventes.paymentMethod'},
              { key: 'createdAt', label: 'ventes.createdAt' },
            ];
            const data = orders.map(o => ({ ...o } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `commandes_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
          activeOpacity={0.7}
        >
          <Download size={14} color={colors.text} />
        </TouchableOpacity>
      </View>
      {subTab === 'commandes' && (
        <ShopCommandesSection orders={orders} companyId={COMPANY_ID} currency={currency} isLoading={ordersQuery.isLoading} />
      )}
      {subTab === 'livraisons' && <BonsLivraisonSection isMobile={isMobile} />}
    </>
  );
}

type ClientSortKey = 'az' | 'za' | 'date' | 'revenue';
const CLIENT_SORT_OPTIONS: { value: ClientSortKey; label: string }[] = [
  { value: 'az', label: 'A → Z' },
  { value: 'za', label: 'Z → A' },
  { value: 'date', label: 'Date' },
  { value: 'revenue', label: 'CA' },
];

function ClientsSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    activeClients, createClient, updateClient, deleteClient, invoices, company, sales,
    discountCategories, discountCategoryRates, addDiscountCategory, updateDiscountCategoryRate, removeDiscountCategory, quotes, reminderLogs, creditNotes,
  } = useData();
  const { t } = useI18n();
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
    vatNumber: '', siret: '', notes: '',
    discountPercent: '',
    discountCategory: '',
  });

  const clientInvoiceCount = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach(inv => { counts[inv.clientId] = (counts[inv.clientId] || 0) + 1; });
    return counts;
  }, [invoices]);

  const clientRevenue = useMemo(() => {
    const rev: Record<string, number> = {};
    invoices.filter(i => i.status === 'paid').forEach(inv => {
      rev[inv.clientId] = (rev[inv.clientId] || 0) + inv.totalTTC;
    });
    sales.filter(s => s.status === 'paid' && s.clientId).forEach(s => {
      if (s.clientId) {
        const alreadyCounted = s.convertedToInvoiceId && invoices.some(i => i.id === s.convertedToInvoiceId && i.status === 'paid');
        if (!alreadyCounted) {
          rev[s.clientId] = (rev[s.clientId] || 0) + s.totalTTC;
        }
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
        c.email.toLowerCase().includes(q)
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
    const result = editingId
      ? updateClient(editingId, submitData)
      : createClient(submitData);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [form, editingId, createClient, updateClient]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteClient(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteClient]);

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('ventes.searchClient')}
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
              { key: 'companyName', label: 'ventes.companyName' },
              { key: 'firstName', label: 'ventes.firstName' },
              { key: 'lastName', label: 'ventes.lastName' },
              { key: 'email', label: 'ventes.email' },
              { key: 'phone', label: 'ventes.phone' },
              { key: 'address', label: 'ventes.address' },
              { key: 'city', label: 'ventes.city' },
              { key: 'postalCode', label: 'ventes.postalCode' },
              { key: 'country', label: 'ventes.country'},
            ];
            const data = activeClients.map(c => ({ ...c } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `clients_${new Date().toISOString().slice(0, 10)}.csv`);
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

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Users size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {search ? 'Aucun résultat' : 'Aucun client pour l’instant'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            {search ? 'Essayez un autre terme' : 'Ajoutez votre premier client pour commencer'}
          </Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {!isMobile && (
            <View style={[styles.clientHeaderRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={[styles.clientColHeader, { flex: 2, color: colors.textTertiary }]}>{t('ventes.colClient')}</Text>
              <Text style={[styles.clientColHeader, { flex: 2, color: colors.textTertiary }]}>{t('ventes.colContact')}</Text>
              <Text style={[styles.clientColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' as const }]}>{t('ventes.colInvoices')}</Text>
              <Text style={[styles.clientColHeader, { flex: 1, color: colors.textTertiary, textAlign: 'right' as const }]}>{t('ventes.colTotal')}</Text>

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
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]} numberOfLines={1}>
                      {client.email || '—'}
                    </Text>
                  </View>
                </View>
                <View style={styles.clientMobileStats}>
                  <Text style={[styles.clientMobileStatText, { color: colors.textTertiary }]}>{formatPhone(client.phone)} · {client.city || '—'}</Text>
                  <Text style={[styles.clientMobileStatText, { color: colors.textTertiary }]}>{invCount} fact.</Text>
                  <Text style={[styles.clientMobileStatText, { color: colors.success, fontWeight: '600' as const }]}>{formatCurrency(revenue, cur)}</Text>
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
                <View style={{ flex: 1, alignItems: 'flex-end' as const }}>
                  <View style={[styles.clientStatBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.clientStatText, { color: colors.primary }]}>{invCount}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' as const }}>
                  <Text style={[styles.clientRevenueText, { color: colors.success }]}>{formatCurrency(revenue, cur)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? t('ventes.editClient') : t('ventes.newClient')}
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
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}
        <SelectField label="Type" value={form.type} options={[{ label: t('ventes.company'), value: 'company' }, { label: t('ventes.individual'), value: 'individual' }]} onSelect={(v) => setForm((p) => ({ ...p, type: v as 'company' | 'individual' }))} required />
        {form.type === 'company' && <FormField label={t('ventes.companyName')} value={form.companyName} onChangeText={(v) => setForm((p) => ({ ...p, companyName: v }))} placeholder={t('ventes.individual')} required />}
        {form.type === 'individual' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}><FormField label="Prénom" value={form.firstName} onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder="Prénom" required /></View>
            <View style={styles.formCol}><FormField label="Nom" value={form.lastName} onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder="Nom" required /></View>
          </View>
        )}
        {form.type === 'company' && (
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <FormField label={t('ventes.firstName')} value={form.firstName} onChangeText={(v) => setForm((p) => ({ ...p, firstName: v }))} placeholder={t('ventes.firstName')} />
            </View>
            <View style={styles.formCol}>
              <FormField label={t('ventes.lastName')} value={form.lastName} onChangeText={(v) => setForm((p) => ({ ...p, lastName: v }))} placeholder={t('ventes.lastName')} />
            </View>
          </View>
        )}
        <FormField label={t('ventes.email')} value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="email@example.com" keyboardType="email-address" />
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
          <View style={styles.formCol}>
            <DropdownPicker
              label="Catégorie de remise"
              value={form.discountCategory}
              options={discountCategories.map(c => ({ label: `${c} (${discountCategoryRates[c] ?? 0}%)`, value: c }))}
              onSelect={(v) => {
                const rate = discountCategoryRates[v];
                setForm((p) => ({ ...p, discountCategory: v, discountPercent: rate !== undefined ? String(rate) : p.discountPercent }));
              }}
              placeholder="Sélectionner..."
              onAddNew={(name) => addDiscountCategory(name, 0)}
              addLabel="Nouvelle catégorie"
              onRenameItem={(oldVal, newVal) => {
                const rate = discountCategoryRates[oldVal] ?? 0;
                removeDiscountCategory(oldVal);
                addDiscountCategory(newVal, rate);
                if (form.discountCategory === oldVal) {
                  setForm((p) => ({ ...p, discountCategory: newVal }));
                }
              }}
              onDeleteItem={(val) => {
                removeDiscountCategory(val);
                if (form.discountCategory === val) {
                  setForm((p) => ({ ...p, discountCategory: '', discountPercent: '' }));
                }
              }}
            />
          </View>
          <View style={styles.formCol}>
            <FormField
              label="Remise client (%)"
              value={form.discountPercent}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, discountPercent: v }));
                if (form.discountCategory && v) {
                  updateDiscountCategoryRate(form.discountCategory, parseFloat(v) || 0);
                }
              }}
              placeholder="Ex: 10"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <FormField label="Notes" value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Notes..." multiline numberOfLines={3} />
      </FormModal>

      <ConfirmModal
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Supprimer ce client ?"
        message="Le client sera marqué comme supprimé."
        confirmLabel="Supprimer"
        destructive
      />

      <UniversalImportModal
        visible={csvImportVisible}
        onClose={() => setCsvImportVisible(false)}
        title={t('ventes.importClient')}
        entityLabel="client"
        fields={[
          { key: 'companyName', label: 'ventes.companyType', aliases: ['entreprise', 'société'] },
          { key: 'firstName', label: 'ventes.FirstName', aliases: ['prenom'] },
          { key: 'lastName', label: 'ventes.LastName', required: true, aliases: ['nom de famille'] },
          { key: 'email', label: 'ventes.Mail', aliases: ['e-mail', 'mail'] },
          { key: 'phone', label: 'ventes.phone', aliases: ['tel', 'portable'] },
          { key: 'address', label: 'ventes.address', aliases: ['rue'] },
          { key: 'city', label: 'ventes.city' },
          { key: 'postalCode', label: 'ventes.postalCode', aliases: ['cp', 'zip'] },
          { key: 'country', label: 'ventes.country' },
          { key: 'vatNumber', label: 'ventes.vatNumber', aliases: ['tva', 'vat'] },
          { key: 'siret', label: 'ventes.siret' },
          { key: 'notes', label: 'ventes.notes', aliases: ['commentaire'] },
        ]}
        pastePlaceholder={"Nom;Prénom;Email;Téléphone;Adresse;Ville;Code postal;Pays\nDupont;Jean;jean@mail.com;+33612345678;12 rue de Paris;Paris;75001;France"}
        onImport={(rows) => {
          let imported = 0;
          const errors: string[] = [];
          rows.forEach((row, idx) => {
            const lastName = row.lastName?.trim() || row.companyName?.trim();
            if (!lastName) { errors.push(`Ligne ${idx + 1}: Nom ou raison sociale requis`); return; }
            const result = createClient({
              type: row.companyName ? 'company' : 'individual',
              companyName: row.companyName || '',
              firstName: row.firstName || '',
              lastName: row.lastName || '',
              email: row.email || '',
              phone: row.phone || '',
              address: row.address || '',
              city: row.city || '',
              postalCode: row.postalCode || '',
              country: row.country || 'France',
              vatNumber: row.vatNumber || '',
              siret: row.siret || '',
              notes: row.notes || '',
            });
            if (result.success) imported++;
            else errors.push(`Ligne ${idx + 1}: ${result.error || 'Erreur'}`);
          });
          return { imported, errors };
        }}
      />

      {historyClientId && (() => {
        const histClient = activeClients.find(c => c.id === historyClientId);
        if (!histClient) return null;
        const clientName = histClient.companyName || `${histClient.firstName} ${histClient.lastName}`;
        const events: Array<{ id: string; date: string; type: string; title: string; subtitle: string; amount?: number }> = [];
        invoices.filter(inv => inv.clientId === historyClientId).forEach(inv => {
          events.push({ id: `inv-${inv.id}`, date: inv.createdAt || inv.issueDate, type: 'invoice', title: `Facture ${inv.invoiceNumber || 'Brouillon'}`, subtitle: inv.status === 'paid' ? 'Payée' : inv.status === 'validated' ? 'Validée' : inv.status === 'sent' ? 'Envoyée' : inv.status === 'late' ? 'En retard' : 'Brouillon', amount: inv.totalTTC });
        });
        quotes.filter(q => q.clientId === historyClientId).forEach(q => {
          events.push({ id: `qt-${q.id}`, date: q.createdAt || q.issueDate, type: 'quote', title: `Devis ${q.quoteNumber}`, subtitle: q.status === 'accepted' ? 'Accepté' : q.status === 'refused' ? 'Refusé' : 'Envoyé', amount: q.totalTTC });
        });
        sales.filter(s => s.clientId === historyClientId).forEach(s => {
          events.push({ id: `sale-${s.id}`, date: s.createdAt, type: 'sale', title: `Vente ${s.saleNumber}`, subtitle: s.status === 'refunded' ? 'Remboursée' : 'Payée', amount: s.totalTTC });
        });
        creditNotes.filter(cn => cn.clientId === historyClientId).forEach(cn => {
          events.push({ id: `cn-${cn.id}`, date: cn.createdAt || cn.issueDate, type: 'credit_note', title: `Avoir ${cn.creditNoteNumber}`, subtitle: `Facture ${cn.invoiceNumber}`, amount: cn.totalTTC });
        });
        reminderLogs.filter(r => r.clientName === clientName).forEach(r => {
          events.push({ id: `rem-${r.id}`, date: r.sentAt || r.createdAt, type: 'reminder', title: `Relance niveau ${r.level}`, subtitle: `Facture ${r.invoiceNumber || r.invoiceId}` });
        });
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const getColor = (t: string) => t === 'invoice' ? colors.primary : t === 'quote' ? '#7C3AED' : t === 'sale' ? colors.success : t === 'reminder' ? colors.warning : t === 'credit_note' ? colors.danger : colors.textTertiary;
        return (
          <FormModal visible onClose={() => setHistoryClientId(null)} title={`Historique — ${clientName}`} subtitle={`${events.length} événement(s)`} showCancel={false} width={500}>
            {events.length === 0 ? (
              <View style={{ alignItems: 'center' as const, paddingVertical: 40, gap: 10 }}>
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
                        case 'invoice': {
                          const invId = rawId.replace('inv-', '');
                          router.push(`/ventes?tab=factures&selectedId=${invId}` as any);
                          break;
                        }
                        case 'quote': {
                          const qtId = rawId.replace('qt-', '');
                          router.push(`/ventes?tab=devis&selectedId=${qtId}` as any);
                          break;
                        }
                        case 'sale': {
                          const saleId = rawId.replace('sale-', '');
                          router.push(`/sales?selectedId=${saleId}` as any);
                          break;
                        }
                        case 'credit_note': {
                          router.push('/ventes?tab=avoirs' as any);
                          break;
                        }
                        case 'reminder': {
                          router.push('/ventes?tab=relances' as any);
                          break;
                        }
                        case 'payment': {
                          router.push('/cashflow' as any);
                          break;
                        }
                      }
                    }}
                    style={{ flexDirection: 'row' as const, gap: 12, minHeight: 60 }}
                  >
                    <View style={{ alignItems: 'center' as const, width: 32 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: getColor(event.type), alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 1 }}>
                        <FileText size={14} color="#FFF" />
                      </View>
                      {idx < events.length - 1 && <View style={{ width: 2, flex: 1, marginTop: 4, backgroundColor: colors.border }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 16 }}>
                      <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const }}>
                        <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }}>{event.title}</Text>
                        {event.amount !== undefined && <Text style={{ fontSize: 13, fontWeight: '700' as const, color: event.type === 'credit_note' ? colors.danger : colors.text }}>{event.type === 'credit_note' ? '-' : ''}{formatCurrency(event.amount, cur)}</Text>}
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
      })()}
    </>
  );
}

type DevisSortKey = 'date' | 'amount' | 'status' | 'client';
const DEVIS_SORT_OPTIONS: { value: DevisSortKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Montant' },
  { value: 'status', label: 'Statut' },
  { value: 'client', label: 'Client A→Z' },
];

function DevisSection({ isMobile: _isMobile, highlightedId, onHighlightClear }: { isMobile: boolean; highlightedId?: string | null; onHighlightClear?: () => void }) {
  const { colors } = useTheme();
  const {
    quotes, activeClients, sendQuote, acceptQuote, refuseQuote, convertQuoteToInvoice,
    createQuote, updateQuote, deleteQuote, cancelQuote, showToast, sendQuoteByEmail, company, duplicateQuote,
  } = useData();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<DevisSortKey>('date');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedId && quotes.some(q => q.id === highlightedId)) {
      setSelectedQuoteId(highlightedId);
      onHighlightClear?.();
    }
  }, [highlightedId, quotes, onHighlightClear]);
  const [formVisible, setFormVisible] = useState(false);
  const [formClientId, setFormClientId] = useState('');
  const [formItems, setFormItems] = useState<LineItem[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const cur = company.currency || 'EUR';
  const [convertConfirm, setConvertConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editFormClientId, setEditFormClientId] = useState('');
  const [editFormItems, setEditFormItems] = useState<LineItem[]>([]);
  const [editFormNotes, setEditFormNotes] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailQuoteId, setEmailQuoteId] = useState<string | null>(null);
  const [devisCsvVisible, setDevisCsvVisible] = useState(false);

  const handleOpenQuoteEmail = useCallback((quoteId: string) => {
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
    setEmailQuoteId(quoteId);
    setEmailModalVisible(true);
  }, [quotes, activeClients, company]);

  const handleSendQuoteEmail = useCallback(async () => {
    if (!emailTo) { showToast('Email destinataire requis', 'error'); return; }
    const success = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    if (success) {
      if (emailQuoteId) sendQuoteByEmail(emailQuoteId);
      showToast('Email envoyé avec succès');
    } else {
      showToast('Impossible d\'ouvrir le client mail', 'error');
    }
    setEmailModalVisible(false);
  }, [emailTo, emailSubject, emailBody, emailQuoteId, showToast, sendQuoteByEmail]);

  const filtered = useMemo(() => {
    let list = quotes;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((qt) =>
        qt.quoteNumber.toLowerCase().includes(q) ||
        qt.clientName.toLowerCase().includes(q)
      );
    }
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

  const [formDelivery, setFormDelivery] = useState(false);
  const [formDeliveryPrice, setFormDeliveryPrice] = useState('15');
  const [formGlobalDiscount, setFormGlobalDiscount] = useState('');

  const openCreate = useCallback(() => {
    setFormClientId('');
    setFormItems([]);
    setFormNotes('');
    setFormError('');
    setFormDelivery(false);
    setFormDeliveryPrice('15');
    setFormGlobalDiscount('');
    setFormVisible(true);
  }, []);

  const handleClientChange = useCallback((clientId: string) => {
    setFormClientId(clientId);
    const client = activeClients.find(c => c.id === clientId);
    if (client?.discountPercent) {
      if (formItems.length > 0) {
        const disc = client.discountPercent || 0;
        const updated = formItems.map(item => {
          const baseHT = item.unitPrice * item.quantity;
          const totalHT = baseHT * (1 - disc / 100);
          const totalTVA = totalHT * (item.vatRate / 100);
          return { ...item, discount: disc, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
        });
        setFormItems(updated);
      }
    } else {
      if (formItems.length > 0) {
        const updated = formItems.map(item => {
          const baseHT = item.unitPrice * item.quantity;
          const totalHT = baseHT;
          const totalTVA = totalHT * (item.vatRate / 100);
          return { ...item, discount: 0, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
        });
        setFormItems(updated);
      }
    }
  }, [activeClients, formItems]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Veuillez sélectionner un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }
    if (formDelivery) {
      const client = activeClients.find(c => c.id === formClientId);
      if (!client?.address) { setFormError('L\'adresse du client est requise pour la livraison'); return; }
    }
    const quoteItems: QuoteItem[] = formItems.map((li) => ({
      id: li.id,
      quoteId: '',
      productId: li.productId,
      productName: li.productName,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
      totalHT: li.totalHT,
      totalTVA: li.totalTVA,
      totalTTC: li.totalTTC,
    }));
    let notes = formNotes;
    if (formDelivery) {
      const deliveryPrice = parseFloat(formDeliveryPrice) || 0;
      notes = `${notes ? notes + '\n' : ''}Livraison : ${deliveryPrice.toFixed(2)} ${cur}`;
    }
    if (formGlobalDiscount) {
      notes = `${notes ? notes + '\n' : ''}Remise globale : ${formGlobalDiscount}%`;
    }
    const result = createQuote(formClientId, quoteItems, 30, notes);
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formClientId, formItems, formNotes, formDelivery, formDeliveryPrice, formGlobalDiscount, activeClients, createQuote, cur]);

  const handleConvert = useCallback(() => {
    if (!convertConfirm) return;
    const result = convertQuoteToInvoice(convertConfirm);
    if (!result.success) {
      showToast(result.error || 'Erreur', 'error');
    }
    setConvertConfirm(null);
  }, [convertConfirm, convertQuoteToInvoice, showToast]);

  const openEditQuote = useCallback((quoteId: string) => {
    const qt = quotes.find(q => q.id === quoteId);
    if (!qt || qt.status !== 'draft') return;
    setEditingQuoteId(quoteId);
    setEditFormClientId(qt.clientId);
    setEditFormItems(qt.items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      totalHT: item.totalHT,
      totalTVA: item.totalTVA,
      totalTTC: item.totalTTC,
    })));
    setEditFormNotes(qt.notes || '');
    setEditFormError('');
  }, [quotes]);

  const handleEditSubmit = useCallback(() => {
    if (!editingQuoteId) return;
    if (!editFormClientId) { setEditFormError('Veuillez sélectionner un client'); return; }
    if (editFormItems.length === 0) { setEditFormError('Ajoutez au moins une ligne'); return; }
    const client = activeClients.find(c => c.id === editFormClientId);
    const clientName = client ? (client.companyName || `${client.firstName} ${client.lastName}`) : '';
    const quoteItems: QuoteItem[] = editFormItems.map((li) => ({
      id: li.id,
      quoteId: editingQuoteId,
      productId: li.productId,
      productName: li.productName,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
      totalHT: li.totalHT,
      totalTVA: li.totalTVA,
      totalTTC: li.totalTTC,
    }));
    const result = updateQuote(editingQuoteId, { clientId: editFormClientId, clientName, items: quoteItems, notes: editFormNotes });
    if (!result.success) { setEditFormError(result.error || 'Erreur'); return; }
    setEditingQuoteId(null);
  }, [editingQuoteId, editFormClientId, editFormItems, editFormNotes, activeClients, updateQuote]);

  const handleDeleteQuote = useCallback(() => {
    if (!deleteConfirm) return;
    deleteQuote(deleteConfirm);
    setDeleteConfirm(null);
    setSelectedQuoteId(null);
  }, [deleteConfirm, deleteQuote]);

  return (
    <>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('ventes.searchQuote')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => setDevisCsvVisible(true)}>
          <Upload size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'quoteNumber', label: 'N° Devis' },
              { key: 'clientName', label: 'Client' },
              { key: 'status', label: 'Statut' },
              { key: 'totalHT', label: 'Total HT' },
              { key: 'totalTVA', label: 'TVA' },
              { key: 'totalTTC', label: 'Total TTC' },
              { key: 'issueDate', label: 'Date émission' },
              { key: 'expirationDate', label: 'Date expiration' },
            ];
            const data = quotes.map(q => ({ ...q } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `devis_${new Date().toISOString().slice(0, 10)}.csv`);
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
        {DEVIS_SORT_OPTIONS.map((opt) => (
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
            <ClipboardList size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun devis pour l’instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez votre premier devis pour démarrer</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <Plus size={14} color="#FFF" />
            <Text style={styles.emptyBtnText}>Créer un devis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((quote, i) => (
            <View key={quote.id}>
              <TouchableOpacity
                style={[styles.listRow, i < filtered.length - 1 && !selectedQuoteId && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                onPress={() => setSelectedQuoteId(selectedQuoteId === quote.id ? null : quote.id)}
                activeOpacity={0.7}
              >
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{quote.quoteNumber || 'Brouillon'}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{quote.clientName} · {formatDate(quote.issueDate)}</Text>
                  </View>
                  <StatusBadge status={quote.status} />
                  <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(quote.totalTTC, cur)}</Text>
                  <View style={styles.listRowActions}>
                    {quote.convertedToInvoiceId ? (
                      <View style={[styles.convertedBadge, { backgroundColor: colors.successLight }]}>
                        <Check size={11} color={colors.success} />
                        <Text style={[styles.convertedBadgeText, { color: colors.success }]}>Facturé</Text>
                      </View>
                    ) : null}
                    {selectedQuoteId === quote.id ? (
                      <ChevronUp size={16} color={colors.textTertiary} />
                    ) : (
                      <ChevronDown size={16} color={colors.textTertiary} />
                    )}
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
                    <View style={styles.detailInfoCol}>
                      <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Client</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{quote.clientName}</Text>
                    </View>
                    <View style={styles.detailInfoCol}>
                      <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(quote.issueDate)}</Text>
                    </View>
                    <View style={styles.detailInfoCol}>
                      <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Validité</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(quote.expirationDate)}</Text>
                    </View>
                  </View>

                  <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>LIGNES</Text>
                  {quote.items.map((item) => (
                    <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                      <Text style={[styles.detailLineName, { color: colors.text }]}>{item.productName}</Text>
                      <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>
                        {item.quantity} × {formatCurrency(item.unitPrice, cur)} HT · TVA {item.vatRate}%
                      </Text>
                      <Text style={[styles.detailLineTotal, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                    </View>
                  ))}

                  <View style={[styles.detailTotals, { borderTopColor: colors.border }]}>
                    <View style={styles.detailTotalRow}>
                      <Text style={[styles.detailTotalLabel, { color: colors.textSecondary }]}>Total HT</Text>
                      <Text style={[styles.detailTotalValue, { color: colors.textSecondary }]}>{formatCurrency(quote.totalHT, cur)}</Text>
                    </View>
                    <View style={styles.detailTotalRow}>
                      <Text style={[styles.detailTotalLabel, { color: colors.textSecondary }]}>TVA</Text>
                      <Text style={[styles.detailTotalValue, { color: colors.textSecondary }]}>{formatCurrency(quote.totalTVA, cur)}</Text>
                    </View>
                    <View style={[styles.detailTotalRow, styles.detailTotalRowMain]}>
                      <Text style={[styles.detailTotalLabelMain, { color: colors.text }]}>Total TTC</Text>
                      <Text style={[styles.detailTotalValueMain, { color: colors.primary }]}>{formatCurrency(quote.totalTTC, cur)}</Text>
                    </View>
                  </View>

                  {quote.notes ? (
                    <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{quote.notes}</Text>
                  ) : null}

                  <View style={styles.detailActions}>
                    {quote.status === 'draft' && (
                      <>
                        <TouchableOpacity onPress={() => openEditQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}>
                          <Pencil size={13} color={colors.text} />
                          <Text style={[styles.detailActionBtnText, { color: colors.text }]}>Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setDeleteConfirm(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.dangerLight, borderWidth: 1, borderColor: colors.danger + '30' }]}>
                          <Trash2 size={13} color={colors.danger} />
                          <Text style={[styles.detailActionBtnText, { color: colors.danger }]}>Supprimer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => sendQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}>
                          <Send size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Envoyer</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {quote.status === 'sent' && (
                      <>
                        <TouchableOpacity onPress={() => acceptQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                          <Check size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Accepter</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => refuseQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}>
                          <X size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Refuser</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {quote.status === 'accepted' && (
                      <TouchableOpacity onPress={() => { const r = cancelQuote(quote.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}>
                        <Ban size={13} color="#FFF" />
                        <Text style={styles.detailActionBtnText}>Annuler</Text>
                      </TouchableOpacity>
                    )}
                    {quote.status === 'accepted' && quote.convertedToInvoiceId && (
                      <View style={[styles.detailActionBtn, { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success + '40' }]}>
                        <Check size={13} color={colors.success} />
                        <Text style={[styles.detailActionBtnText, { color: colors.success }]}>Facture créée</Text>
                      </View>
                    )}
                    {quote.status !== 'accepted' && quote.status !== 'cancelled' && (
                      <TouchableOpacity onPress={() => handleOpenQuoteEmail(quote.id)} style={[styles.detailActionBtn, { backgroundColor: '#0369A1' }]}>
                        <Mail size={13} color="#FFF" />
                        <Text style={styles.detailActionBtnText}>Email</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => duplicateQuote(quote.id)} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}>
                      <ClipboardList size={13} color={colors.text} />
                      <Text style={[styles.detailActionBtnText, { color: colors.text }]}>Dupliquer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={t('ventes.newQuote')}
        subtitle="Créez un devis pour un client"
        onSubmit={handleSubmit}
        submitLabel={t('ventes.createQuote')}
        width={600}
      >
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}
        <ClientPicker selectedClientId={formClientId} onSelect={handleClientChange} required />
        {formClientId ? (() => {
          const selectedClient = activeClients.find(c => c.id === formClientId);
          if (selectedClient?.discountPercent) {
            return (
              <View style={[styles.discountBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <Text style={{ fontSize: 12, color: '#166534' }}>Remise client : {selectedClient.discountPercent}% ({selectedClient.discountCategory || 'Personnalis\u00e9e'}) — appliqu\u00e9e sur chaque ligne (modifiable)</Text>
              </View>
            );
          }
          return null;
        })() : null}
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE DEVIS</Text>
          <LineItemsEditor items={formItems} onItemsChange={setFormItems} idPrefix="qi" showDiscount allowedProductTypes={SALES_ALLOWED_TYPES} defaultDiscount={(() => { const cl = activeClients.find(c => c.id === formClientId); return cl?.discountPercent || 0; })()} />
          <TotalsSummary items={formItems} compact />
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>REMISE GLOBALE</Text>
          <FormField
            label="Remise sur total (%)"
            value={formGlobalDiscount}
            onChangeText={setFormGlobalDiscount}
            placeholder="Ex: 5"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIVRAISON</Text>
          <TouchableOpacity
            style={[styles.deliveryToggle, { backgroundColor: formDelivery ? '#EFF6FF' : colors.card, borderColor: formDelivery ? '#3B82F6' : colors.cardBorder }]}
            onPress={() => setFormDelivery(!formDelivery)}
            activeOpacity={0.7}
          >
            <Truck size={16} color={formDelivery ? '#3B82F6' : colors.textTertiary} />
            <Text style={{ flex: 1, fontSize: 14, color: formDelivery ? '#1E40AF' : colors.text }}>Inclure la livraison</Text>
            {formDelivery ? <Check size={16} color="#3B82F6" /> : null}
          </TouchableOpacity>
          {formDelivery ? (
            <>
              <FormField
                label="Prix de livraison"
                value={formDeliveryPrice}
                onChangeText={setFormDeliveryPrice}
                placeholder="15.00"
                keyboardType="decimal-pad"
              />
              {formClientId ? (() => {
                const cl = activeClients.find(c => c.id === formClientId);
                if (!cl?.address) {
                  return (
                    <View style={[styles.errorBanner, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={{ fontSize: 12, color: '#DC2626' }}>L'adresse du client est requise pour la livraison. Veuillez la renseigner dans la fiche client.</Text>
                    </View>
                  );
                }
                return (
                  <View style={[styles.discountBanner, { backgroundColor: '#F0F9FF', borderColor: '#BFDBFE' }]}>
                    <Text style={{ fontSize: 12, color: '#1E40AF' }}>Adresse : {cl.address}, {cl.postalCode} {cl.city}</Text>
                  </View>
                );
              })() : null}
            </>
          ) : null}
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
        visible={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteQuote}
        title="Supprimer ce devis ?"
        message="Le devis sera définitivement supprimé. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
      />

      <FormModal
        visible={editingQuoteId !== null}
        onClose={() => setEditingQuoteId(null)}
        title={t('ventes.editQuote')}
        subtitle={t('ventes.createQuote')}
        onSubmit={handleEditSubmit}
        submitLabel="Mettre à jour"
        width={600}
      >
        {editFormError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{editFormError}</Text>
          </View>
        ) : null}
        <ClientPicker selectedClientId={editFormClientId} onSelect={setEditFormClientId} required />
        <View style={styles.formSection}>
          <Text style={[styles.formSectionTitle, { color: colors.textTertiary }]}>LIGNES DE DEVIS</Text>
          <LineItemsEditor items={editFormItems} onItemsChange={setEditFormItems} idPrefix="qi" showDiscount allowedProductTypes={SALES_ALLOWED_TYPES} />
          <TotalsSummary items={editFormItems} compact />
        </View>
        <FormField
          label="Notes"
          value={editFormNotes}
          onChangeText={setEditFormNotes}
          placeholder="Notes internes ou conditions..."
          multiline
          numberOfLines={3}
        />
      </FormModal>

      <FormModal
        visible={emailModalVisible}
        onClose={() => setEmailModalVisible(false)}
        title={t('ventes.emailQuote')}
        subtitle={t('ventes.emailQuoteMsg')}
        onSubmit={handleSendQuoteEmail}
        submitLabel="Envoyer"
      >
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Destinataire</Text>
          <TextInput
            style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailTo}
            onChangeText={setEmailTo}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Objet</Text>
          <TextInput
            style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailSubject}
            onChangeText={setEmailSubject}
          />
        </View>
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Message</Text>
          <TextInput
            style={[styles.emailFieldInput, styles.emailBodyField, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailBody}
            onChangeText={setEmailBody}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>
      </FormModal>

      <UniversalImportModal
        visible={devisCsvVisible}
        onClose={() => setDevisCsvVisible(false)}
        title="Importer des devis"
        entityLabel="devis"
        fields={[
          { key: 'clientName', label: 'Client', required: true, aliases: ['client', 'nom client'] },
          { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Montant', aliases: ['total', 'prix'] },
          { key: 'date', label: 'Date', aliases: ['date emission'] },
        ]}
        pastePlaceholder={"Client;Description;Montant;Date\nDupont SARL;Prestation web;1500;2026-03-01"}
        onImport={(rows: Record<string, string>[]) => {
          return { imported: rows.length, errors: [] };
        }}
      />
    </>
  );
}

function FacturesSection({ isMobile: _isMobile, highlightedId, onHighlightClear }: { isMobile: boolean; highlightedId?: string | null; onHighlightClear?: () => void }) {
  const { colors } = useTheme();
  const {
    invoices, validateInvoice, recordPartialPayment,
    createCreditNote, company, activeClients, showToast,
    revertInvoiceStatus, updateInvoiceDueDate,
  } = useData();
  const { t } = useI18n();
  const cur = company.currency || 'EUR';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [reminderInvoice, setReminderInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (highlightedId && invoices.some(i => i.id === highlightedId)) {
      setExpandedInvoiceId(highlightedId);
      onHighlightClear?.();
    }
  }, [highlightedId, invoices, onHighlightClear]);
  const [_pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentDueDays, setPaymentDueDays] = useState('');
  const [creditNoteModal, setCreditNoteModal] = useState<string | null>(null);

  const INVOICE_PAYMENT_METHODS = [
    { value: 'cash', label: 'Espèces', icon: '💵' },
    { value: 'card', label: 'Carte bancaire', icon: '💳' },
    { value: 'bank_transfer', label: 'Virement', icon: 'VIR' },
    { value: 'check', label: 'Chèque', icon: 'CHQ' },
    { value: 'mobile_wave', label: 'Wave', icon: 'W' },
    { value: 'mobile_om', label: 'Orange Money', icon: 'OM' },
  ];

  const filtered = useMemo(() => {
    let list = invoices;
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.clientName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoices, search, statusFilter]);

  const handleGeneratePDF = useCallback(async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    setPdfLoading(invoiceId);
    try {
      const client = activeClients.find(c => c.id === invoice.clientId);
      const html = generateInvoiceHTML(invoice, company, client);
      const fileName = `Facture_${invoice.invoiceNumber || 'brouillon'}.pdf`;
      const success = await generateAndSharePDF(html, fileName);
      if (success) {
        showToast('PDF généré avec succès');
      } else {
        showToast('Erreur lors de la génération du PDF', 'error');
      }
    } catch {
      showToast('Erreur lors de la génération du PDF', 'error');
    } finally {
      setPdfLoading(null);
    }
  }, [invoices, activeClients, company, showToast]);

  const STATUS_FILTERS = [
    { label: 'Tous', value: 'all' },
    { label: 'Brouillon', value: 'draft' },
    { label: 'Validée', value: 'validated' },
    { label: 'Envoyée', value: 'sent' },
    { label: 'Payée', value: 'paid' },
    { label: 'En retard', value: 'late' },
  ];

  const totalAmount = useMemo(() => invoices.reduce((s, i) => s + i.totalTTC, 0), [invoices]);
  const unpaidCount = useMemo(() => invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft').length, [invoices]);

  return (
    <>
      <View style={[styles.summaryBar, { backgroundColor: '#F0F9FF', borderColor: '#BFDBFE' }]}>
        <Text style={styles.summaryBarText}>
          Total : <Text style={styles.summaryBarBold}>{invoices.length} factures</Text> | <Text style={[styles.summaryBarBold, { color: '#1E40AF' }]}>{formatCurrency(totalAmount, cur)}</Text> | <Text style={[styles.summaryBarBold, { color: '#D97706' }]}>{unpaidCount} impayées</Text>
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder, flex: 1 }]}>
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('ventes.searchInvoice')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }}
          onPress={() => {
            const cols: ExportColumn<Record<string, unknown>>[] = [
              { key: 'invoiceNumber', label: 'N° Facture' },
              { key: 'clientName', label: 'Client' },
              { key: 'status', label: 'Statut' },
              { key: 'totalHT', label: 'Total HT' },
              { key: 'totalTVA', label: 'TVA' },
              { key: 'totalTTC', label: 'Total TTC' },
              { key: 'paidAmount', label: 'Montant payé' },
              { key: 'issueDate', label: 'Date émission' },
              { key: 'dueDate', label: 'Date échéance' },
            ];
            const data = invoices.map(inv => ({ ...inv } as unknown as Record<string, unknown>));
            void exportToCSV(data, cols, `factures_${new Date().toISOString().slice(0, 10)}.csv`);
          }}
        >
          <Download size={16} color={colors.text} />
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

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <FileText size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture pour l’instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Vos factures apparaîtront ici une fois créées</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filtered.map((inv, i) => {
            const remaining = inv.totalTTC - (inv.paidAmount || 0);
            const isPartial = inv.paidAmount > 0 && inv.paidAmount < inv.totalTTC;
            return (
              <TouchableOpacity key={inv.id} style={[styles.listRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]} onPress={() => setExpandedInvoiceId(inv.id)} activeOpacity={0.7}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{inv.invoiceNumber || 'Brouillon'}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{inv.clientName} · {formatDate(inv.issueDate)}</Text>
                    {isPartial && (
                      <View style={[styles.partialBanner, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' as const }}>Reste à payer : {formatCurrency(remaining, cur)}</Text>
                      </View>
                    )}
                  </View>
                  <StatusBadge status={isPartial ? 'partial' : inv.status} />
                  <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(inv.totalTTC, cur)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FormModal
        visible={paymentModal !== null}
        onClose={() => setPaymentModal(null)}
        title="Paiement"
        subtitle={paymentModal ? (() => {
          const inv = invoices.find(i => i.id === paymentModal);
          return inv ? `${inv.clientName} — ${inv.invoiceNumber || 'Brouillon'}` : '';
        })() : ''}
        onSubmit={() => {
          if (!paymentModal) return;
          const amount = parseFloat(paymentAmount);
          if (isNaN(amount) || amount <= 0) { showToast('Montant invalide', 'error'); return; }
          const result = recordPartialPayment(paymentModal, amount, paymentMethod);
          if (result.success) {
            if (paymentDueDays) {
              const days = parseInt(paymentDueDays, 10);
              if (!isNaN(days) && days >= 0) {
                updateInvoiceDueDate(paymentModal, days);
              }
            }
            showToast('Paiement enregistré');
            setPaymentModal(null);
          } else {
            showToast(result.error || 'Erreur', 'error');
          }
        }}
        submitLabel={`Valider le paiement — ${paymentAmount ? formatCurrency(parseFloat(paymentAmount) || 0, cur) : '0,00 €'}`}
        width={480}
      >
        {paymentModal ? (() => {
          const inv = invoices.find(i => i.id === paymentModal);
          if (!inv) return null;
          const remaining = inv.totalTTC - (inv.paidAmount || 0);
          return (
            <>
              <View style={[{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceHover, gap: 6, marginBottom: 4 }]}>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{inv.items?.length || 0} article(s)</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}> </Text>
                </View>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
                  <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalHT, cur)}</Text>
                </View>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                  <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalTVA, cur)}</Text>
                </View>
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <Text style={{ fontSize: 18, fontWeight: '800' as const, color: colors.text }}>Total TTC</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800' as const, color: colors.primary }}>{formatCurrency(inv.totalTTC, cur)}</Text>
                </View>
                {inv.paidAmount > 0 && (
                  <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                    <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' as const }}>Reste à payer</Text>
                    <Text style={{ fontSize: 15, color: '#92400E', fontWeight: '700' as const }}>{formatCurrency(remaining, cur)}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 8, marginBottom: 4 }}>Mode de paiement</Text>
              <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 }}>
                {INVOICE_PAYMENT_METHODS.map((m) => {
                  const isActive = paymentMethod === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[{
                        flex: 1,
                        minWidth: 100,
                        paddingVertical: 14,
                        paddingHorizontal: 10,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isActive ? colors.primary : colors.cardBorder,
                        backgroundColor: isActive ? `${colors.primary}10` : colors.card,
                        alignItems: 'center' as const,
                        gap: 4,
                      }]}
                      onPress={() => setPaymentMethod(m.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: isActive ? colors.primary : colors.textSecondary, textAlign: 'center' as const }}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row' as const, gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <FormField label="Montant" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="0.00" keyboardType="decimal-pad" required />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Date de paiement" value={paymentDate} onChangeText={setPaymentDate} placeholder="AAAA-MM-JJ" />
                </View>
              </View>
              <View style={{ flexDirection: 'row' as const, gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <FormField label="Modifier l'échéance (jours)" value={paymentDueDays} onChangeText={setPaymentDueDays} placeholder="Laisser vide pour ne pas changer" keyboardType="numeric" />
                </View>
              </View>
            </>
          );
        })() : null}
      </FormModal>

      <ConfirmModal
        visible={creditNoteModal !== null}
        onClose={() => setCreditNoteModal(null)}
        onConfirm={() => {
          if (!creditNoteModal) return;
          const inv = invoices.find(i => i.id === creditNoteModal);
          if (!inv) return;
          const items: OrderItem[] = inv.items.map(it => ({ ...it }));
          const result = createCreditNote(creditNoteModal, items, 'Avoir sur facture ' + inv.invoiceNumber);
          if (result.success) showToast('Avoir créé');
          else showToast(result.error || 'Erreur', 'error');
          setCreditNoteModal(null);
        }}
        title="Créer un avoir ?"
        message="Un avoir total sera créé pour cette facture. Le montant sera déduit de la trésorerie."
        confirmLabel="Créer l'avoir"
        destructive
      />

      <PaymentReminderSheet
        visible={reminderInvoice !== null}
        onClose={() => setReminderInvoice(null)}
        invoice={reminderInvoice}
      />

      {expandedInvoiceId && (() => {
        const inv = invoices.find(i => i.id === expandedInvoiceId);
        if (!inv) return null;
        const remaining = inv.totalTTC - (inv.paidAmount || 0);
        const isPartial = inv.paidAmount > 0 && inv.paidAmount < inv.totalTTC;
        return (
          <FormModal
            visible
            onClose={() => setExpandedInvoiceId(null)}
            title={`Facture ${inv.invoiceNumber || 'Brouillon'}`}
            subtitle={`${inv.clientName} — ${formatCurrency(inv.totalTTC, cur)}`}
            showCancel={false}
            width={520}
          >
            <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 8 }}>
              <StatusBadge status={isPartial ? 'partial' : inv.status} />
              <Text style={{ fontSize: 13, color: colors.textTertiary }}>Échéance : {formatDate(inv.dueDate)}</Text>
            </View>
            <View style={{ gap: 4, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalHT, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{formatCurrency(inv.totalTVA, cur)}</Text>
              </View>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                <Text style={{ fontSize: 15, fontWeight: '700' as const, color: colors.text }}>Total TTC</Text>
                <Text style={{ fontSize: 15, fontWeight: '700' as const, color: colors.primary }}>{formatCurrency(inv.totalTTC, cur)}</Text>
              </View>
              {isPartial && (
                <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between' as const }}>
                  <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' as const }}>Reste à payer</Text>
                  <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600' as const }}>{formatCurrency(remaining, cur)}</Text>
                </View>
              )}
            </View>
            <View style={{ gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>ÉCHÉANCE</Text>
              <View style={{ flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const }}>
                <TextInput
                  style={[styles.emailFieldInput, { flex: 1, color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  placeholder="Jours"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  defaultValue={String(Math.max(0, Math.round((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))))}
                  onEndEditing={(e) => {
                    const days = parseInt(e.nativeEvent.text, 10);
                    if (!isNaN(days) && days >= 0) {
                      updateInvoiceDueDate(inv.id, days);
                    }
                  }}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>jours</Text>
              </View>
              <View style={[{ padding: 10, borderRadius: 8, backgroundColor: colors.surfaceHover }]}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{inv.paymentTerms || `Paiement à ${company.paymentTermsDays} jours`}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 12 }}>
              {inv.status === 'draft' && (
                <TouchableOpacity onPress={() => { validateInvoice(inv.id); setExpandedInvoiceId(null); }} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}>
                  <Check size={13} color="#FFF" />
                  <Text style={styles.detailActionBtnText}>Valider</Text>
                </TouchableOpacity>
              )}
              {(inv.status === 'validated' || inv.status === 'sent' || inv.status === 'late' || inv.status === 'partial') && (
                <TouchableOpacity onPress={() => { const r = revertInvoiceStatus(inv.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.detailActionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }]}>
                  <RefreshCw size={13} color={colors.text} />
                  <Text style={[styles.detailActionBtnText, { color: colors.text }]}>Statut précédent</Text>
                </TouchableOpacity>
              )}
              {(inv.status === 'validated' || inv.status === 'sent' || inv.status === 'late' || isPartial) && inv.status !== 'paid' && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => { setPaymentModal(inv.id); setPaymentAmount(String(remaining.toFixed(2))); setPaymentMethod('bank_transfer'); setPaymentDate(new Date().toISOString().slice(0, 10)); setPaymentDueDays(''); }, 100); }} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                  <CreditCard size={13} color="#FFF" />
                  <Text style={styles.detailActionBtnText}>Paiement</Text>
                </TouchableOpacity>
              )}
              {inv.status !== 'paid' && !inv.creditNoteId && inv.status !== 'draft' && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => setCreditNoteModal(inv.id), 100); }} style={[styles.detailActionBtn, { backgroundColor: colors.danger }]}>
                  <X size={13} color="#FFF" />
                  <Text style={styles.detailActionBtnText}>Avoir</Text>
                </TouchableOpacity>
              )}
              {(inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'draft') && (
                <TouchableOpacity onPress={() => { setExpandedInvoiceId(null); setTimeout(() => setReminderInvoice(inv), 100); }} style={[styles.detailActionBtn, { backgroundColor: '#D97706' }]}>
                  <Bell size={13} color="#FFF" />
                  <Text style={styles.detailActionBtnText}>Rappeler</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { void handleGeneratePDF(inv.id); }} style={[styles.detailActionBtn, { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30' }]}>
                <Printer size={13} color={colors.primary} />
                <Text style={[styles.detailActionBtnText, { color: colors.primary }]}>PDF</Text>
              </TouchableOpacity>
            </View>
          </FormModal>
        );
      })()}
    </>
  );
}

function RelancesSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { lateInvoices, reminderLogs, sendReminder, activeClients, company, showToast } = useData();
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const { t } = useI18n();
  const buildReminderMessage = useCallback((inv: { clientName: string; invoiceNumber: string; totalTTC: number; paidAmount: number }) => {
    const remaining = inv.totalTTC - inv.paidAmount;
    const cur = company.currency || 'EUR';
    return `Bonjour ${inv.clientName}, vous avez un solde impayé de ${formatCurrency(remaining, cur)} chez ${company.name || 'notre entreprise'}. Merci de régulariser. Ref: ${inv.invoiceNumber}`;
  }, [company]);

  const handleSendSMS = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const phone = client?.phone;
    if (!phone) {
      showToast(t('ventes.clientNoPhone'), 'error');
      return;
    }
    const message = buildReminderMessage(inv);
    const smsUrl = Platform.OS === 'ios'
      ? `sms:${phone}&body=${encodeURIComponent(message)}`
      : `sms:${phone}?body=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') {
      window.open(smsUrl, '_blank');
    } else {
      void Linking.openURL(smsUrl).catch(() => {
        showToast('Impossible d\'ouvrir l\'app SMS', 'error');
      });
    }
    showToast('App SMS ouverte avec le message pré-rempli');
  }, [lateInvoices, activeClients, buildReminderMessage, showToast]);

  const handleSendWhatsApp = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const phone = client?.phone?.replace(/\s/g, '').replace(/^0/, '+33');
    if (!phone) {
      showToast(t('ventes.clientNoPhone'), 'error');
      return;
    }
    const message = buildReminderMessage(inv);
    const waUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') {
      window.open(waUrl, '_blank');
    } else {
      void Linking.openURL(waUrl).catch(() => {
        showToast('Impossible d\'ouvrir WhatsApp', 'error');
      });
    }
    showToast('WhatsApp ouvert avec le message pré-rempli');
  }, [lateInvoices, activeClients, buildReminderMessage, showToast]);

  const handleSendReminderEmail = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const existingReminders = reminderLogs.filter((r) => r.invoiceId === invoiceId);
    const nextLevel = Math.min(existingReminders.length + 1, 3);
    const { subject, body } = buildReminderEmailBody({
      companyName: company.name,
      clientName: inv.clientName,
      invoiceNumber: inv.invoiceNumber,
      totalTTC: inv.totalTTC,
      paidAmount: inv.paidAmount,
      dueDate: inv.dueDate,
      level: nextLevel,
      currency: company.currency || 'EUR',
    });
    setEmailTo(client?.email || '');
    setEmailSubject(subject);
    setEmailBody(body);
    setEmailModalVisible(true);
    sendReminder(invoiceId);
  }, [lateInvoices, activeClients, company, reminderLogs, sendReminder]);

  const handleSendEmail = useCallback(async () => {
    if (!emailTo) return;
    const success = await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    setEmailModalVisible(false);
    if (success) {
      showToast('Relance envoyée');
    }
  }, [emailTo, emailSubject, emailBody, showToast]);

  return (
    <>
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.dangerLight }]}>
          <AlertCircle size={20} color={colors.danger} />
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{lateInvoices.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Factures en retard</Text>
        </View>
        <Text style={[styles.summaryTotal, { color: colors.danger }]}>
          {formatCurrency(lateInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0), company.currency || 'EUR')}
        </Text>
      </View>

      {lateInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Bell size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture en retard</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Bonne nouvelle, tout est à jour !</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {lateInvoices.map((inv, i) => {
            const invReminders = reminderLogs.filter((r) => r.invoiceId === inv.id);
            const lastLevel = invReminders.length > 0 ? Math.max(...invReminders.map((r) => r.level)) : 0;
            const daysLate = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return (
              <View key={inv.id} style={[styles.listRow, i < lateInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                      {inv.clientName} · {daysLate}j de retard
                    </Text>
                    {lastLevel > 0 && (
                      <Text style={[styles.reminderLevel, { color: colors.warning }]}>
                        Relance niv. {lastLevel} envoyée
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.listRowValue, { color: colors.danger }]}>
                    {formatCurrency(inv.totalTTC - inv.paidAmount, company.currency || 'EUR')}
                  </Text>
                  <View style={styles.reminderActions}>
                    <TouchableOpacity
                      onPress={() => handleSendReminderEmail(inv.id)}
                      style={[styles.reminderActionBtn, { backgroundColor: colors.warningLight }]}
                      disabled={lastLevel >= 3}
                    >
                      <Mail size={13} color={colors.warning} />
                      <Text style={[styles.reminderActionLabel, { color: colors.warning }]}>Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSendSMS(inv.id)}
                      style={[styles.reminderActionBtn, { backgroundColor: '#EFF6FF' }]}
                    >
                      <Smartphone size={13} color="#2563EB" />
                      <Text style={[styles.reminderActionLabel, { color: '#2563EB' }]}>SMS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSendWhatsApp(inv.id)}
                      style={[styles.reminderActionBtn, { backgroundColor: '#F0FDF4' }]}
                    >
                      <MessageSquare size={13} color="#16A34A" />
                      <Text style={[styles.reminderActionLabel, { color: '#16A34A' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <FormModal
        visible={emailModalVisible}
        onClose={() => setEmailModalVisible(false)}
        title="Envoyer la relance"
        subtitle="Email de relance au client"
        onSubmit={handleSendEmail}
        submitLabel="Ouvrir le client mail"
      >
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Destinataire</Text>
          <TextInput
            style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailTo}
            onChangeText={setEmailTo}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Objet</Text>
          <TextInput
            style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailSubject}
            onChangeText={setEmailSubject}
          />
        </View>
        <View style={styles.emailField}>
          <Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Message</Text>
          <TextInput
            style={[styles.emailFieldInput, styles.emailBodyField, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            value={emailBody}
            onChangeText={setEmailBody}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>
      </FormModal>

      {reminderLogs.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique des relances</Text>
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {reminderLogs.slice(0, 20).map((rl, i) => (
              <View key={rl.id} style={[styles.listRow, i < Math.min(reminderLogs.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={styles.listRowMain}>
                  <View style={[styles.levelBadge, { backgroundColor: rl.level >= 3 ? colors.dangerLight : rl.level >= 2 ? colors.warningLight : colors.primaryLight }]}>
                    <Text style={[styles.levelBadgeText, { color: rl.level >= 3 ? colors.danger : rl.level >= 2 ? colors.warning : colors.primary }]}>
                      Niv. {rl.level}
                    </Text>
                  </View>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{rl.invoiceNumber || rl.invoiceId}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{rl.clientName} · {formatDate(rl.sentAt)}</Text>
                  </View>
                  <View style={[styles.methodBadge, { backgroundColor: colors.surfaceHover }]}>
                    <Text style={[styles.methodBadgeText, { color: colors.textSecondary }]}>{rl.method}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function AvoirsSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { creditNotes, company, showToast } = useData();
  const { user } = useAuth();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const cur = company.currency || 'EUR';
  const [expandedCnId, setExpandedCnId] = useState<string | null>(null);
  const [cnPayments, setCnPayments] = useState<Array<{ id: string; creditNoteId: string; amount: number; date: string; note: string }>>([]);
  const [paymentModalCnId, setPaymentModalCnId] = useState<string | null>(null);
  const [cnPaymentAmount, setCnPaymentAmount] = useState('');
  const [cnPaymentNote, setCnPaymentNote] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(`credit-note-payments-${COMPANY_ID}`).then(stored => {
      if (stored) setCnPayments(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const addCnPayment = useCallback((creditNoteId: string, amount: number, note: string) => {
    const cn = creditNotes.find(c => c.id === creditNoteId);
    if (!cn) return;
    const existingPmts = cnPayments.filter(p => p.creditNoteId === creditNoteId);
    const totalPaid = existingPmts.reduce((s, p) => s + p.amount, 0);
    const cnRem = cn.totalTTC - totalPaid;
    if (amount > cnRem + 0.01) {
      showToast(`Le montant depasse le solde restant (${cnRem.toFixed(2)})`, 'error');
      return;
    }
    const newPmt = {
      id: `cnp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      creditNoteId,
      amount,
      date: new Date().toISOString(),
      note,
    };
    const updated = [newPmt, ...cnPayments];
    setCnPayments(updated);
    void AsyncStorage.setItem(`credit-note-payments-${COMPANY_ID}`, JSON.stringify(updated));
    const newTotalPaid = totalPaid + amount;
    if (Math.abs(newTotalPaid - cn.totalTTC) < 0.01) {
      showToast(`Avoir ${cn.creditNoteNumber} cloture`);
    } else {
      showToast(`Paiement de ${amount.toFixed(2)} enregistre sur avoir ${cn.creditNoteNumber}`);
    }
  }, [cnPayments, creditNotes, showToast, COMPANY_ID]);

  const getCnPaidAmount = useCallback((creditNoteId: string): number => {
    return cnPayments.filter(p => p.creditNoteId === creditNoteId).reduce((s, p) => s + p.amount, 0);
  }, [cnPayments]);

  const getCnPaymentsList = useCallback((creditNoteId: string) => {
    return cnPayments.filter(p => p.creditNoteId === creditNoteId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cnPayments]);

  return (
    <View testID="avoirs-section">
      {creditNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <FileText size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun avoir pour l’instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Les avoirs sont créés depuis l'onglet Factures</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {creditNotes.map((cn, i) => {
            const paidAmount = getCnPaidAmount(cn.id);
            const cnRemaining = cn.totalTTC - paidAmount;
            const isClosed = cnRemaining < 0.01;
            const isExpanded = expandedCnId === cn.id;
            const payments = getCnPaymentsList(cn.id);
            return (
              <View key={cn.id}>
                <TouchableOpacity
                  style={[styles.listRow, i < creditNotes.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  onPress={() => setExpandedCnId(isExpanded ? null : cn.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{cn.creditNoteNumber}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                        {cn.clientName} · Facture {cn.invoiceNumber} · {formatDate(cn.issueDate)}
                      </Text>
                    </View>
                    <View style={[styles.convertedBadge, { backgroundColor: isClosed ? colors.successLight : colors.dangerLight }]}>
                      <Text style={[styles.convertedBadgeText, { color: isClosed ? colors.success : colors.danger }]}>{isClosed ? 'Cloture' : 'Avoir'}</Text>
                    </View>
                    <Text style={[styles.listRowValue, { color: colors.danger }]}>-{formatCurrency(cn.totalTTC, cur)}</Text>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded ? (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Total avoir</Text>
                        <Text style={[styles.detailValue, { color: colors.danger }]}>-{formatCurrency(cn.totalTTC, cur)}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Regle</Text>
                        <Text style={[styles.detailValue, { color: colors.success }]}>{formatCurrency(paidAmount, cur)}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Reste</Text>
                        <Text style={[styles.detailValue, { color: cnRemaining > 0 ? colors.warning : colors.success, fontWeight: '700' as const }]}>{formatCurrency(cnRemaining, cur)}</Text>
                      </View>
                    </View>
                    {cn.reason ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>Motif : {cn.reason}</Text> : null}
                    {payments.length > 0 ? (
                      <>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>HISTORIQUE DES REGLEMENTS</Text>
                        {payments.map((p) => (
                          <View key={p.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.detailLineName, { color: colors.text }]}>{formatCurrency(p.amount, cur)}</Text>
                              <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{formatDate(p.date)}{p.note ? ` - ${p.note}` : ''}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : null}
                    {!isClosed ? (
                      <View style={styles.detailActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setPaymentModalCnId(cn.id);
                            setCnPaymentAmount(String(cnRemaining.toFixed(2)));
                            setCnPaymentNote('');
                          }}
                          style={[styles.detailActionBtn, { backgroundColor: colors.success }]}
                        >
                          <CreditCard size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Reglement partiel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => addCnPayment(cn.id, cnRemaining, 'Cloture complete')}
                          style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}
                        >
                          <Check size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Cloturer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <FormModal
        visible={paymentModalCnId !== null}
        onClose={() => setPaymentModalCnId(null)}
        title="Reglement d'avoir"
        subtitle="Enregistrer un paiement partiel ou total"
        onSubmit={() => {
          if (!paymentModalCnId) return;
          const amount = parseFloat(cnPaymentAmount);
          if (isNaN(amount) || amount <= 0) { showToast('Montant invalide', 'error'); return; }
          addCnPayment(paymentModalCnId, amount, cnPaymentNote);
          setPaymentModalCnId(null);
        }}
        submitLabel="Enregistrer"
      >
        <FormField label="Montant" value={cnPaymentAmount} onChangeText={setCnPaymentAmount} placeholder="0.00" keyboardType="decimal-pad" required />
        <FormField label="Note (optionnel)" value={cnPaymentNote} onChangeText={setCnPaymentNote} placeholder="Ex: Cheque n1234" />
      </FormModal>
    </View>
  );
}

function BonsLivraisonSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { deliveryNotes, updateDeliveryNoteStatus, showToast, activeClients } = useData();
  const [expandedDnId, setExpandedDnId] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'preparation': return 'En préparation';
      case 'shipped': return 'Expédié';
      case 'delivered': return 'Livré';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparation': return { bg: colors.warningLight, text: colors.warning };
      case 'shipped': return { bg: colors.primaryLight, text: colors.primary };
      case 'delivered': return { bg: colors.successLight, text: colors.success };
      default: return { bg: colors.primaryLight, text: colors.primary };
    }
  };

  const handleStatusChange = useCallback((id: string, newStatus: 'preparation' | 'shipped' | 'delivered') => {
    const result = updateDeliveryNoteStatus(id, newStatus);
    if (result.success) showToast(`Statut mis à jour : ${getStatusLabel(newStatus)}`);
    else showToast(result.error || 'Erreur', 'error');
  }, [updateDeliveryNoteStatus, showToast]);

  return (
    <View testID="livraisons-section">
      {deliveryNotes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <Truck size={28} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun bon de livraison</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez un BL depuis l'onglet Factures</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {deliveryNotes.map((dn, i) => {
            const sc = getStatusColor(dn.status);
            const isExpanded = expandedDnId === dn.id;
            const client = activeClients.find(c => c.id === dn.clientId);
            return (
              <View key={dn.id}>
                <TouchableOpacity
                  style={[styles.listRow, i < deliveryNotes.length - 1 && !isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  onPress={() => setExpandedDnId(isExpanded ? null : dn.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.listRowMain}>
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listRowTitle, { color: colors.text }]}>{dn.deliveryNumber}</Text>
                      <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                        {dn.clientName} · Facture {dn.invoiceNumber} · {formatDate(dn.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.convertedBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.convertedBadgeText, { color: sc.text }]}>{getStatusLabel(dn.status)}</Text>
                    </View>
                    {isExpanded ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={[styles.detailPanel, { backgroundColor: colors.surfaceHover, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailInfoRow}>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Client</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{dn.clientName}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Facture</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{dn.invoiceNumber}</Text>
                      </View>
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Date création</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.createdAt)}</Text>
                      </View>
                    </View>
                    {client?.address ? (
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Adresse de livraison</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{client.address}{client.city ? `, ${client.postalCode} ${client.city}` : ''}</Text>
                      </View>
                    ) : null}
                    {dn.shippedAt ? (
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Expédié le</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.shippedAt)}</Text>
                      </View>
                    ) : null}
                    {dn.deliveredAt ? (
                      <View style={styles.detailInfoCol}>
                        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Livré le</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(dn.deliveredAt)}</Text>
                      </View>
                    ) : null}
                    {dn.items && dn.items.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionTitle, { color: colors.textTertiary }]}>ARTICLES</Text>
                        {dn.items.map((item) => (
                          <View key={item.id} style={[styles.detailLineItem, { borderBottomColor: colors.borderLight }]}>
                            <Text style={[styles.detailLineName, { color: colors.text }]}>{item.productName}</Text>
                            <Text style={[styles.detailLineMeta, { color: colors.textSecondary }]}>{item.quantity} unité(s)</Text>
                          </View>
                        ))}
                      </>
                    )}
                    {dn.notes ? <Text style={[styles.detailNotes, { color: colors.textSecondary }]}>{dn.notes}</Text> : null}
                    <View style={styles.detailActions}>
                      {dn.status === 'preparation' && (
                        <TouchableOpacity onPress={() => handleStatusChange(dn.id, 'shipped')} style={[styles.detailActionBtn, { backgroundColor: colors.primary }]}>
                          <Send size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Expédier</Text>
                        </TouchableOpacity>
                      )}
                      {dn.status === 'shipped' && (
                        <TouchableOpacity onPress={() => handleStatusChange(dn.id, 'delivered')} style={[styles.detailActionBtn, { backgroundColor: colors.success }]}>
                          <Check size={13} color="#FFF" />
                          <Text style={styles.detailActionBtnText}>Livré</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const FREQ_OPTIONS: { label: string; value: RecurringFrequency }[] = [
  { label: 'Mensuelle', value: 'monthly' },
  { label: 'Trimestrielle', value: 'quarterly' },
  { label: 'Annuelle', value: 'yearly' },
];

function RecurrentesSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const {
    recurringInvoices, createRecurringInvoice, toggleRecurringInvoice,
    generateRecurringInvoice, deleteRecurringInvoice, activeClients, showToast, company,
  } = useData();
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
    setFormItems([]);
    setFormFrequency('monthly');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormNotes('');
    setFormError('');
    setFormVisible(true);
  }, [activeClients]);

  const handleSubmit = useCallback(() => {
    if (!formClientId) { setFormError('Sélectionnez un client'); return; }
    if (formItems.length === 0) { setFormError('Ajoutez au moins une ligne'); return; }
    const items: OrderItem[] = formItems.map(li => ({
      id: li.id, orderId: '', productId: li.productId, productName: li.productName,
      quantity: li.quantity, unitPrice: li.unitPrice, vatRate: li.vatRate,
      totalHT: li.totalHT, totalTVA: li.totalTVA, totalTTC: li.totalTTC,
    }));
    const result = createRecurringInvoice({
      clientId: formClientId, items, frequency: formFrequency,
      startDate: formStartDate, notes: formNotes,
    });
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formClientId, formItems, formFrequency, formStartDate, formNotes, createRecurringInvoice]);

  const getFreqLabel = (f: string) => {
    switch (f) {
      case 'monthly': return 'Mensuelle';
      case 'quarterly': return 'Trimestrielle';
      case 'yearly': return 'Annuelle';
      default: return f;
    }
  };

  return (
    <View testID="recurrentes-section">
      <View style={styles.searchRow}>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Nouvelle récurrence</Text>
        </TouchableOpacity>
      </View>

      {recurringInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}>
            <RefreshCw size={28} color={colors.textTertiary} />
          </View>
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
                  <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>
                    {getFreqLabel(ri.frequency)} · Prochaine : {formatDate(ri.nextGenerationDate)}
                  </Text>
                </View>
                <View style={[styles.convertedBadge, { backgroundColor: ri.status === 'active' ? colors.successLight : colors.warningLight }]}>
                  <Text style={[styles.convertedBadgeText, { color: ri.status === 'active' ? colors.success : colors.warning }]}>
                    {ri.status === 'active' ? 'Active' : 'Pausée'}
                  </Text>
                </View>
                <Text style={[styles.listRowValue, { color: colors.text }]}>{formatCurrency(ri.totalTTC, cur)}</Text>
                <View style={styles.listRowActions}>
                  <TouchableOpacity onPress={() => toggleRecurringInvoice(ri.id)} style={[styles.iconBtn, { backgroundColor: ri.status === 'active' ? colors.warningLight : colors.successLight }]}>
                    {ri.status === 'active' ? <X size={13} color={colors.warning} /> : <Check size={13} color={colors.success} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const r = generateRecurringInvoice(ri.id); if (!r.success) showToast(r.error || 'Erreur', 'error'); }} style={[styles.validateBtn, { backgroundColor: colors.primary }]}>
                    <Plus size={13} color="#FFF" />
                    <Text style={styles.validateBtnText}>Générer</Text>
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

      <FormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title="Nouvelle facture récurrente"
        subtitle="Modèle de facturation périodique"
        onSubmit={handleSubmit}
        submitLabel="Créer le modèle"
        width={600}
      >
        {formError ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text>
          </View>
        ) : null}
        <ClientPicker selectedClientId={formClientId} onSelect={setFormClientId} required />
        <SelectField label="Fréquence" value={formFrequency} options={FREQ_OPTIONS.map(o => ({ label: o.label, value: o.value }))} onSelect={(v) => setFormFrequency(v as RecurringFrequency)} required />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: 24, gap: 16, paddingBottom: 40 },
  partialBanner: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBar: { flexDirection: 'row' as const, gap: 0 },
  tab: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  searchRow: { flexDirection: 'row' as const, gap: 10, alignItems: 'center' as const },
  searchBar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  sortRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' as const },
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
  listRowActions: { flexDirection: 'row' as const, gap: 6, alignItems: 'center' as const },
  iconBtn: { padding: 6, borderRadius: 6 },
  clientHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  clientColHeader: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  clientRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  clientContactText: { fontSize: 13, fontWeight: '500' as const },
  clientStats: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  clientStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  clientStatText: { fontSize: 11, fontWeight: '600' as const },
  clientRevenueText: { fontSize: 13, fontWeight: '600' as const },
  clientMobileStats: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  clientMobileStatText: { fontSize: 12 },
  emptyState: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' as const },
  formRow: { flexDirection: 'row' as const, gap: 12 },
  formCol: { flex: 1 },
  summaryCard: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  summaryTotal: { fontSize: 16, fontWeight: '700' as const },
  reminderLevel: { fontSize: 11, fontWeight: '500' as const, marginTop: 2 },
  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600' as const },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const, marginBottom: 12 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' as const },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodBadgeText: { fontSize: 11, fontWeight: '500' as const },
  convertBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  convertBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  convertedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 3 },
  convertedBadgeText: { fontSize: 11, fontWeight: '600' as const },
  validateBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  validateBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' as const },
  emailField: { gap: 6 },
  emailFieldLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  emailFieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  emailBodyField: { height: 160, textAlignVertical: 'top' as const },
  emptyBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, marginTop: 8 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  formSection: { gap: 12 },
  formSectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  detailPanel: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  detailHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  detailHeaderTitle: { fontSize: 15, fontWeight: '700' as const },
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
  detailTotalLabel: { fontSize: 13 },
  detailTotalValue: { fontSize: 13 },
  detailTotalRowMain: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  detailTotalLabelMain: { fontSize: 15, fontWeight: '700' as const },
  detailTotalValueMain: { fontSize: 16, fontWeight: '800' as const },
  detailNotes: { fontSize: 12, fontStyle: 'italic' as const },
  detailActions: { flexDirection: 'row' as const, gap: 8, marginTop: 4 },
  detailActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  detailActionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
  summaryBar: { borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1 },
  summaryBarText: { fontSize: 13, color: '#374151' },
  summaryBarBold: { fontWeight: '700' as const, color: '#1E40AF' },
  reminderActions: { flexDirection: 'row' as const, gap: 6, marginTop: 6, flexWrap: 'wrap' as const },
  reminderActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  reminderActionLabel: { fontSize: 11, fontWeight: '600' as const },
  discountBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginVertical: 4 },
  deliveryToggle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
});

const ventesSubTabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row' as const, borderBottomWidth: 1,
    paddingHorizontal: 20, gap: 0, minHeight: 40,
    alignItems: 'center' as const, justifyContent: 'space-between' as const,
  },
  tabsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
  },
  tab: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    gap: 6, paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '600' as const },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },
});

const ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const ORDER_STATUS_COLORS: Record<ShopOrderStatus, string> = {
  en_attente: '#D97706',
  confirmee: '#2563EB',
  livree: '#059669',
  annulee: '#DC2626',
};

function ShopCommandesSection({
  orders, companyId, currency, isLoading,
}: {
  orders: ShopOrder[];
  companyId: string;
  currency: string;
  isLoading: boolean;
}) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ShopOrderStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await shopDb.updateShopOrderStatus(orderId, status);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shop-orders', companyId] });
      showToast('Statut mis à jour');
    },
    onError: () => showToast('Erreur', 'error'),
  });

  const filterOptions: { key: ShopOrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'en_attente', label: 'En attente' },
    { key: 'confirmee', label: 'Confirmées' },
    { key: 'livree', label: 'Livrées' },
    { key: 'annulee', label: 'Annulées' },
  ];

  const getNextStatus = (current: ShopOrderStatus): ShopOrderStatus | null => {
    const flow: Record<string, ShopOrderStatus> = {
      en_attente: 'confirmee',
      confirmee: 'livree',
    };
    return flow[current] || null;
  };

  const nextStatusLabels: Record<string, string> = {
    confirmee: 'Confirmer la commande',
    livree: 'Marquer livrée',
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 40 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (selectedOrder) {
    const next = getNextStatus(selectedOrder.status);
    return (
      <View style={{ gap: 16 }}>
        <TouchableOpacity onPress={() => setSelectedOrderId(null)}>
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.primary }}>← Retour aux commandes</Text>
        </TouchableOpacity>

        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={cmdStyles.orderDetailHeader}>
            <Text style={[cmdStyles.orderNumber, { color: colors.text }]}>{selectedOrder.orderNumber}</Text>
            <View style={[cmdStyles.statusPill, { backgroundColor: ORDER_STATUS_COLORS[selectedOrder.status] + '20' }]}>
              <Text style={[cmdStyles.statusPillText, { color: ORDER_STATUS_COLORS[selectedOrder.status] }]}>
                {ORDER_STATUS_LABELS[selectedOrder.status]}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[cmdStyles.sectionTitle, { color: colors.textSecondary }]}>CLIENT</Text>
          <Text style={{ fontSize: 16, fontWeight: '700' as const, color: colors.text }}>
            {selectedOrder.customerFirstName} {selectedOrder.customerLastName}
          </Text>
          <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerEmail}</Text>
          {selectedOrder.customerPhone ? <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerPhone}</Text> : null}
          {selectedOrder.customerAddress ? <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{selectedOrder.customerAddress}</Text> : null}
          <View style={{ flexDirection: 'row' as const, gap: 8, marginTop: 8 }}>
            <View style={[cmdStyles.infoPill, { backgroundColor: colors.primaryLight }]}>
              <Truck size={12} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '500' as const, color: colors.primary }}>
                {selectedOrder.deliveryMode === 'pickup' ? 'Retrait' : 'Livraison'}
              </Text>
            </View>
            <View style={[cmdStyles.infoPill, { backgroundColor: colors.primaryLight }]}>
              <CreditCard size={12} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '500' as const, color: colors.primary }}>{selectedOrder.paymentMethod}</Text>
            </View>
          </View>
        </View>

        <View style={[cmdStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[cmdStyles.sectionTitle, { color: colors.textSecondary }]}>ARTICLES</Text>
          {selectedOrder.items.map((item: ShopOrderItem) => (
            <View key={item.id} style={[cmdStyles.orderItemRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500' as const, color: colors.text }}>{item.productName}</Text>
                {Object.keys(item.variantInfo).length > 0 && (
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                    {Object.entries(item.variantInfo).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>×{item.quantity}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }}>{(item.totalPrice ?? 0).toFixed(2)} {currency}</Text>
            </View>
          ))}
          <View style={[cmdStyles.totalSection, { borderTopColor: colors.border }]}>
            <View style={cmdStyles.totalRow}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Sous-total HT</Text>
              <Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.subtotalHt ?? 0).toFixed(2)} {currency}</Text>
            </View>
            <View style={cmdStyles.totalRow}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
              <Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.tvaAmount ?? 0).toFixed(2)} {currency}</Text>
            </View>
            {(selectedOrder.shippingCost ?? 0) > 0 && (
              <View style={cmdStyles.totalRow}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Livraison</Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{(selectedOrder.shippingCost ?? 0).toFixed(2)} {currency}</Text>
              </View>
            )}
            <View style={[cmdStyles.totalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' }]}>
              <Text style={{ fontSize: 15, fontWeight: '700' as const, color: colors.text }}>Total TTC</Text>
              <Text style={{ fontSize: 16, fontWeight: '800' as const, color: colors.primary }}>{(selectedOrder.totalTtc ?? 0).toFixed(2)} {currency}</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row' as const, gap: 8 }}>
          {next && selectedOrder.status !== 'annulee' && selectedOrder.status !== 'livree' && (
            <TouchableOpacity
              style={[cmdStyles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => statusMutation.mutate({ orderId: selectedOrder.id, status: next })}
              disabled={statusMutation.isPending}
            >
              <Send size={14} color="#FFF" />
              <Text style={cmdStyles.actionBtnText}>{nextStatusLabels[next]}</Text>
            </TouchableOpacity>
          )}
          {selectedOrder.status !== 'annulee' && selectedOrder.status !== 'livree' && (
            <TouchableOpacity
              style={[cmdStyles.actionBtn, { backgroundColor: colors.danger }]}
              onPress={() => statusMutation.mutate({ orderId: selectedOrder.id, status: 'annulee' })}
              disabled={statusMutation.isPending}
            >
              <Ban size={14} color="#FFF" />
              <Text style={cmdStyles.actionBtnText}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {filterOptions.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.cardBorder }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterChipText, { color: active ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={32} color={colors.textTertiary} />}
          title="Aucune commande"
          subtitle="Les commandes de votre boutique en ligne apparaîtront ici"
        />
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map(order => (
            <TouchableOpacity
              key={order.id}
              style={[cmdStyles.orderRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              onPress={() => setSelectedOrderId(order.id)}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>{order.orderNumber}</Text>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#8B5CF6' + '20' }}>
                    <Globe size={10} color="#8B5CF6" />
                    <Text style={{ fontSize: 10, fontWeight: '600' as const, color: '#8B5CF6' }}>En ligne</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>
                  {order.customerFirstName} {order.customerLastName}
                </Text>
                <Text style={{ fontSize: 11, marginTop: 2, color: colors.textTertiary }}>
                  {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' as const, gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.text }}>{(order.totalTtc ?? 0).toFixed(2)} {currency}</Text>
                <View style={[cmdStyles.statusPill, { backgroundColor: ORDER_STATUS_COLORS[order.status] + '20' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600' as const, color: ORDER_STATUS_COLORS[order.status] }}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const cmdStyles = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 14, padding: 18, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  orderDetailHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  orderNumber: { fontSize: 18, fontWeight: '800' as const },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '600' as const },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  infoPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  orderItemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  totalSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 4, gap: 6 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  actionBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  orderRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 12,
  },
});
