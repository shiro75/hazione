/**
 * SettingsScreen.tsx  (refactorisé)
 *
 * Orchestrateur des paramètres — 8 onglets.
 * Onglets inline (peu de logique, pas extraits) :
 *   company      — infos entreprise + IBAN/BIC
 *   invoicing    — préfixes, numéros, TVA, délais, devise, exonération
 *   reminders    — relances automatiques + pénalités
 *   einvoicing   — facturation électronique + état de préparation
 *   modules      — toggles modules avec plan badges
 * Composants extraits :
 *   ObjectivesSection   — objectifs CA global + par produit
 *   BankingConfigSection — Stripe / CinetPay
 *   ApiKeysSection      — wrapper ApiKeysManager (inline, ~20 lignes)
 *   CurrencyPicker      — dropdown devise
 *
 * STRUCTURE :
 *   components/settings/settingsStyles.ts
 *   components/settings/CurrencyPicker.tsx
 *   components/settings/ObjectivesSection.tsx
 *   components/settings/BankingConfigSection.tsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  useWindowDimensions, Switch, Modal, ActivityIndicator,
} from 'react-native';
import {
  Building2, FileText, Save, Bell, Zap, Shield, LayoutGrid,
  Lock, LogOut, Trash2, AlertTriangle, ChevronDown, Key,
  Scale, ChevronRight, CreditCard, Target,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import { MODULE_CONFIGS, PLAN_LABELS, PLAN_COLORS } from '@/constants/modules';
import PageHeader from '@/components/PageHeader';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import ApiKeysManager from '@/components/ApiKeysManager';
import type { ApiKey } from '@/types';

import CurrencyPicker from '@/components/settings/CurrencyPicker';
import ObjectivesSection from '@/components/settings/ObjectivesSection';
import BankingConfigSection from '@/components/settings/BankingConfigSection';
import { styles } from '@/components/settings/settingsStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsTab = 'company' | 'invoicing' | 'reminders' | 'einvoicing' | 'modules' | 'api' | 'banking' | 'objectives';

const TAB_KEYS: {
  key: SettingsTab;
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  rawLabel?: string;
}[] = [
  { key: 'company', labelKey: 'settings.company', icon: Building2 },
  { key: 'invoicing', labelKey: 'settings.billing', icon: FileText },
  { key: 'objectives', labelKey: '', rawLabel: 'Objectifs', icon: Target },
  { key: 'reminders', labelKey: 'settings.reminders', icon: Bell },
  { key: 'einvoicing', labelKey: 'settings.einvoicing', icon: Zap },
  { key: 'banking', labelKey: '', rawLabel: 'Paiements', icon: CreditCard },
  { key: 'modules', labelKey: 'settings.modules', icon: LayoutGrid },
  { key: 'api', labelKey: 'api.title', icon: Key },
];

// ─── ApiKeysSection inline (~20 lignes) ───────────────────────────────────────

function ApiKeysSection() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const handleGenerate = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'hzi_';
    for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    const newKey: ApiKey = { id: `ak_${Date.now()}`, companyId: '', key, name: 'API Key', isActive: true, callsThisMonth: 0, createdAt: new Date().toISOString() };
    setApiKeys((prev) => [...prev, newKey]);
  }, []);

  const handleRevoke = useCallback((id: string) => {
    setApiKeys((prev) => prev.map((k) => k.id === id ? { ...k, isActive: false, revokedAt: new Date().toISOString() } : k));
  }, []);

  return <ApiKeysManager apiKeys={apiKeys} onGenerate={handleGenerate} onRevoke={handleRevoke} />;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { company: dbCompany, currentPlan, toggleModule, isModuleEnabled, isModuleAvailable, updateCompanySettings } = useData();
  const { signOut, user, deleteAccount } = useAuth();
  const { canAccess } = useRole();
  const { t } = useI18n();
  const router = useRouter();
  const { errorAlert } = useConfirm();

  if (!canAccess('settings')) return <AccessDenied />;

  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── Déconnexion ────────────────────────────────────────────────────────────
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await signOut(); router.replace('/landing'); } catch {} finally { setIsLoggingOut(false); }
  };

  // ── Suppression compte ─────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;
    if (!deletePassword.trim()) { setDeletePasswordError(t('settings.passwordRequired')); return; }
    setDeletePasswordError('');
    setIsDeleting(true);
    try {
      const result = await deleteAccount(deletePassword);
      if (!result.success) {
        setDeletePasswordError(result.error === 'Mot de passe incorrect.' ? t('settings.passwordIncorrect') : '');
        if (result.error !== 'Mot de passe incorrect.') errorAlert('Erreur', result.error || 'Impossible de supprimer le compte.');
        setIsDeleting(false);
        return;
      }
      setShowDeleteModal(false);
      setDeleteConfirmText(''); setDeletePassword(''); setDeletePasswordError('');
      setIsDeleting(false);
      router.replace('/landing');
    } catch {
      errorAlert('Erreur', 'Une erreur est survenue lors de la suppression. Veuillez réessayer.');
      setIsDeleting(false);
    }
  };

  // ── State entreprise ───────────────────────────────────────────────────────
  const [company, setCompany] = useState(dbCompany);

  useEffect(() => {
    if (params.tab && TAB_KEYS.some((tk) => tk.key === params.tab)) setActiveTab(params.tab as SettingsTab);
  }, [params.tab]);

  useEffect(() => {
    if (!dbCompany) return;
    const meta = user?.user_metadata;
    const isMock = dbCompany.id === 'comp_001' || dbCompany.name === 'Dupont Solutions';
    if (isMock && meta) {
      setCompany({ ...dbCompany, name: meta.company_name || dbCompany.name, siret: meta.siret || dbCompany.siret, address: meta.address || dbCompany.address, postalCode: meta.postal_code || dbCompany.postalCode, city: meta.city || dbCompany.city, country: meta.country || dbCompany.country, phone: meta.phone || dbCompany.phone, email: user?.email || dbCompany.email });
    } else if ((!dbCompany.name || !dbCompany.email) && meta) {
      setCompany({ ...dbCompany, name: dbCompany.name || meta.company_name || '', siret: dbCompany.siret || meta.siret || '', address: dbCompany.address || meta.address || '', postalCode: dbCompany.postalCode || meta.postal_code || '', city: dbCompany.city || meta.city || '', country: dbCompany.country || meta.country || 'France', phone: dbCompany.phone || meta.phone || '', email: dbCompany.email || user?.email || '' });
    } else {
      setCompany(dbCompany);
    }
  }, [dbCompany, user]);

  const updateField = useCallback((field: string, value: string) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  }, []);

  const renderField = (label: string, field: string, value: string, options?: { editable?: boolean }) => (
    <View style={styles.fieldGroup} key={field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, options?.editable === false && { opacity: 0.6 }]}
        value={value}
        onChangeText={(v) => updateField(field, v)}
        editable={options?.editable !== false}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );

  const handleSave = async () => {
    setIsSaving(true);
    try { await updateCompanySettings(company); } finally { setIsSaving(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('settings.title')}
        action={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }} onPress={handleSave} disabled={isSaving} activeOpacity={0.7}>
              <Save size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerLight }} onPress={handleLogout} disabled={isLoggingOut} activeOpacity={0.7} testID="settings-logout-btn">
              <LogOut size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Barre d'onglets */}
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItemUnified, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabLabelUnified, { color: active ? colors.primary : colors.textSecondary }]}>
                  {tab.rawLabel || t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

          {/* ── Onglet Entreprise ── */}
          {activeTab === 'company' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.companyInfo')}</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>{t('settings.companyInfoDesc')}</Text>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Raison sociale', 'name', company.name)}
                {renderField('Forme juridique', 'legalStructure', company.legalStructure)}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('SIRET', 'siret', company.siret)}
                {renderField('Numéro de TVA', 'vatNumber', company.vatNumber)}
              </View>
              <AddressFields
                address={company.address} postalCode={company.postalCode} city={company.city} country={company.country || 'France'}
                onAddressChange={(v) => updateField('address', v)} onPostalCodeChange={(v) => updateField('postalCode', v)}
                onCityChange={(v) => updateField('city', v)} onCountryChange={(v) => updateField('country', v)}
              />
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                <View style={styles.fieldGroup}><PhoneField value={company.phone} onChangeText={(v) => updateField('phone', v)} /></View>
                {renderField('Email', 'email', company.email)}
              </View>
              {renderField('Site web', 'website', company.website)}
              <View style={[styles.bankingSubSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>{t('settings.bankingInfo')}</Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>{t('settings.bankingInfoDesc')}</Text>
                {renderField('IBAN', 'iban', company.iban)}
                {renderField('BIC', 'bic', company.bic)}
              </View>
            </View>
          )}

          {/* ── Onglet Facturation ── */}
          {activeTab === 'invoicing' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.billingSettings')}</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>{t('settings.billingSettingsDesc')}</Text>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe facture', 'invoicePrefix', company.invoicePrefix)}
                {renderField('Prochain numéro', 'invoiceNextNumber', company.invoiceNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe devis', 'quotePrefix', company.quotePrefix)}
                {renderField('Prochain numéro devis', 'quoteNextNumber', company.quoteNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe avoir', 'creditNotePrefix', company.creditNotePrefix)}
                {renderField('Prochain numéro avoir', 'creditNoteNextNumber', company.creditNoteNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Taux TVA par défaut (%)', 'defaultVatRate', company.defaultVatRate.toString())}
                {renderField('Délai de paiement (jours)', 'paymentTermsDays', company.paymentTermsDays.toString())}
              </View>
              <CurrencyPicker value={company.currency || 'EUR'} onSelect={(v) => updateField('currency', v)} />
              <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Exonération de TVA</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>Article 293B du CGI - Auto-entrepreneurs</Text>
                </View>
                <Switch value={company.vatExempt} onValueChange={(v) => setCompany((prev) => ({ ...prev, vatExempt: v }))} trackColor={{ false: colors.border, true: colors.primary }} />
              </View>
              <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Shield size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>Conformité anti-fraude</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>Les factures validées ne peuvent plus être modifiées conformément à la réglementation française. La numérotation est séquentielle et chronologique. Annulation uniquement par avoir.</Text>
                </View>
              </View>
              <View style={styles.vatRatesSection}>
                <Text style={[styles.vatRatesTitle, { color: colors.text }]}>Taux de TVA disponibles</Text>
                <View style={styles.vatRatesList}>
                  {[{ rate: 20, label: '20%', desc: 'Taux normal' }, { rate: 10, label: '10%', desc: 'Taux intermédiaire' }, { rate: 5.5, label: '5,5%', desc: 'Taux réduit' }, { rate: 2.1, label: '2,1%', desc: 'Taux super-réduit' }, { rate: 0, label: 'Exonéré', desc: 'Art. 293B' }].map((item) => (
                    <View key={item.rate} style={[styles.vatRateChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.vatRateText, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.vatRateDesc, { color: colors.textTertiary }]}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[styles.sectionSaveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]} onPress={handleSave} disabled={isSaving} activeOpacity={0.7}>
                <Save size={16} color="#FFF" />
                <Text style={styles.sectionSaveBtnText}>{isSaving ? t('settings.saving') : t('settings.saveChanges')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Onglet Relances ── */}
          {activeTab === 'reminders' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Relances automatiques</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Configurez les relances automatiques pour les factures impayées.</Text>
              <View style={[styles.switchRow, { borderTopWidth: 0 }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Activer les relances automatiques</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>Les emails de relance seront envoyés automatiquement</Text>
                </View>
                <Switch value={company.reminderEnabled} onValueChange={(v) => setCompany((prev) => ({ ...prev, reminderEnabled: v }))} trackColor={{ false: colors.border, true: colors.primary }} />
              </View>
              {company.reminderEnabled && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>Délais de relance configurés</Text>
                  <View style={styles.reminderDays}>
                    {[7, 14, 30, 60].map((day) => {
                      const isActive = company.reminderDays.includes(day);
                      return (
                        <TouchableOpacity key={day} style={[styles.reminderDayChip, { backgroundColor: isActive ? colors.primary : colors.background, borderColor: isActive ? colors.primary : colors.border }]} onPress={() => setCompany((prev) => ({ ...prev, reminderDays: isActive ? prev.reminderDays.filter((d) => d !== day) : [...prev.reminderDays, day].sort((a, b) => a - b) }))}>
                          <Text style={[styles.reminderDayText, { color: isActive ? '#FFF' : colors.text }]}>J+{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {renderField('Taux de pénalité de retard (%)', 'lateFeeRate', company.lateFeeRate.toString())}
                  <View style={[styles.infoBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                    <Bell size={16} color={colors.warning} />
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoTitle, { color: colors.warning }]}>Pénalités de retard</Text>
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>Le taux légal minimum est de 3× le taux d'intérêt légal. Les pénalités sont calculées automatiquement sur les factures en retard.</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Onglet E-facturation ── */}
          {activeTab === 'einvoicing' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Facturation électronique</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Préparez votre entreprise à la réforme de la facturation électronique obligatoire (2026-2027).</Text>
              <View style={[styles.switchRow, { borderTopWidth: 0 }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Facturation électronique activée</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>Prépare les factures au format compatible PDP/PPF</Text>
                </View>
                <Switch value={company.electronicInvoicingReady} onValueChange={(v) => setCompany((prev) => ({ ...prev, electronicInvoicingReady: v }))} trackColor={{ false: colors.border, true: colors.primary }} />
              </View>
              <View style={[styles.readinessCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.readinessTitle, { color: colors.text }]}>État de préparation</Text>
                <View style={styles.readinessList}>
                  {[
                    { label: 'Structure XML Factur-X', ready: true },
                    { label: 'Champ electronic_ready sur factures', ready: true },
                    { label: 'Numérotation séquentielle conforme', ready: true },
                    { label: 'Mentions légales obligatoires', ready: true },
                    { label: 'Verrouillage des factures validées', ready: true },
                    { label: 'Connexion PDP / Chorus Pro', ready: false },
                    { label: 'Émission e-facture automatique', ready: false },
                    { label: 'Réception e-facture fournisseur', ready: false },
                  ].map((item) => (
                    <View key={item.label} style={styles.readinessRow}>
                      <View style={[styles.readinessDot, { backgroundColor: item.ready ? '#059669' : colors.border }]} />
                      <Text style={[styles.readinessLabel, { color: item.ready ? colors.text : colors.textTertiary }]}>{item.label}</Text>
                      <Text style={[styles.readinessStatus, { color: item.ready ? '#059669' : colors.textTertiary }]}>{item.ready ? 'Prêt' : 'À venir'}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Zap size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>Réforme 2026-2027</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>La facturation électronique devient obligatoire pour toutes les entreprises françaises. HaziOne prépare déjà vos factures au format Factur-X compatible avec les plateformes de dématérialisation partenaires (PDP).</Text>
                </View>
              </View>
              <View style={[styles.infoBox, { backgroundColor: colors.successLight, borderColor: colors.success, marginTop: 12 }]}>
                <Shield size={16} color={colors.success} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.success }]}>Conformité garantie</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>Votre base de données est structurée pour supporter l'intégration future avec les API PDP/PPF. Les champs nécessaires (electronic_ready, XML structure) sont déjà en place.</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Onglet Modules ── */}
          {activeTab === 'modules' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Modules disponibles</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Activez ou désactivez les modules affichés dans la barre de navigation.</Text>
              <View style={styles.modulesList}>
                {MODULE_CONFIGS.map((mod) => {
                  const enabled = isModuleEnabled(mod.key);
                  const available = isModuleAvailable(mod.key);
                  const locked = !available && !mod.alwaysEnabled;
                  return (
                    <View key={mod.key} style={[styles.moduleRow, { borderBottomColor: colors.borderLight }, locked && { opacity: 0.5 }]}>
                      <View style={styles.moduleInfo}>
                        <View style={styles.moduleNameRow}>
                          <Text style={[styles.moduleName, { color: colors.text }]}>{mod.label}</Text>
                          {mod.alwaysEnabled && <View style={[styles.moduleTag, { backgroundColor: colors.primaryLight }]}><Text style={[styles.moduleTagText, { color: colors.primary }]}>Toujours actif</Text></View>}
                          {locked && <View style={[styles.moduleTag, { backgroundColor: colors.dangerLight }]}><Lock size={10} color={colors.danger} /><Text style={[styles.moduleTagText, { color: colors.danger }]}>{mod.plans[0] === 'pro' ? 'Pro+' : 'Business'}</Text></View>}
                        </View>
                        <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>{mod.description}</Text>
                        <View style={styles.modulePlanBadges}>
                          {mod.plans.map((p) => (
                            <View key={p} style={[styles.modulePlanBadge, { backgroundColor: currentPlan === p ? `${PLAN_COLORS[p]}18` : colors.background, borderColor: currentPlan === p ? PLAN_COLORS[p] : colors.border }]}>
                              <Text style={[styles.modulePlanBadgeText, { color: currentPlan === p ? PLAN_COLORS[p] : colors.textTertiary }]}>{PLAN_LABELS[p]}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Switch value={enabled} onValueChange={(v) => toggleModule(mod.key, v)} disabled={mod.alwaysEnabled || locked} trackColor={{ false: colors.border, true: colors.primary }} />
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Onglets extraits ── */}
          {activeTab === 'api' && <ApiKeysSection />}
          {activeTab === 'banking' && <BankingConfigSection />}
          {activeTab === 'objectives' && <ObjectivesSection />}

          {/* ── Mentions légales (tous onglets) ── */}
          <View style={[styles.legalSection, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 32 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Scale size={16} color={colors.primary} />
              <Text style={[styles.legalSectionTitle, { color: colors.text }]}>{t('legal.title')}</Text>
            </View>
            {[{ key: 'mentions' as const, label: t('legal.mentions') }, { key: 'cgu' as const, label: t('legal.cgu') }, { key: 'privacy' as const, label: t('legal.privacy') }].map((item) => (
              <TouchableOpacity key={item.key} style={[styles.legalLink, { borderTopColor: colors.borderLight }]} onPress={() => router.push({ pathname: '/(app)/legal', params: { tab: item.key } })} activeOpacity={0.7} testID={`settings-legal-${item.key}`}>
                <Text style={[styles.legalLinkText, { color: colors.text }]}>{item.label}</Text>
                <ChevronRight size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Zone de danger ── */}
          <View style={[styles.dangerSection, { borderColor: colors.danger + '30', backgroundColor: colors.danger + '08', marginTop: 32 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={16} color={colors.danger} />
              <Text style={[styles.dangerSectionTitle, { color: colors.danger }]}>{t('settings.dangerZone')}</Text>
            </View>
            <Text style={[styles.dangerSectionDesc, { color: colors.textSecondary }]}>{t('settings.dangerZoneDesc')}</Text>
            <TouchableOpacity style={[styles.deleteAccountBtn, { borderColor: colors.danger, backgroundColor: 'transparent' }]} onPress={() => setShowDeleteModal(true)} activeOpacity={0.7} testID="settings-delete-account-btn">
              <Trash2 size={15} color={colors.danger} />
              <Text style={[styles.deleteAccountText, { color: colors.danger }]}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>

      {/* ── Modale suppression compte ── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: colors.card }]}>
            <View style={styles.deleteIconContainer}>
              <View style={[styles.deleteIconCircle, { backgroundColor: colors.dangerLight }]}>
                <AlertTriangle size={28} color={colors.danger} />
              </View>
            </View>
            <Text style={[styles.deleteTitle, { color: colors.danger }]}>{t('settings.deleteAccountTitle')}</Text>
            <Text style={[styles.deleteDesc, { color: colors.textSecondary }]}>
              Cette action est irréversible. Toutes vos données seront définitivement supprimées :{'\n\n'}
              {'•'} Entreprise et paramètres{'\n'}
              {'•'} Clients et fournisseurs{'\n'}
              {'•'} Factures, devis et ventes{'\n'}
              {'•'} Produits et stock{'\n'}
              {'•'} Mouvements de trésorerie{'\n'}
              {'•'} Historique et logs
            </Text>
            <Text style={[styles.deleteConfirmLabel, { color: colors.text }]}>
              Tapez <Text style={{ fontWeight: '800' }}>SUPPRIMER</Text> pour confirmer :
            </Text>
            <TextInput
              style={[styles.deleteConfirmInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: deleteConfirmText === 'SUPPRIMER' ? colors.danger : colors.inputBorder }]}
              value={deleteConfirmText} onChangeText={setDeleteConfirmText}
              placeholder="SUPPRIMER" placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters" testID="delete-account-confirm-input"
            />
            <Text style={[styles.deleteConfirmLabel, { color: colors.text, marginTop: 12 }]}>{t('settings.enterPassword')}</Text>
            <TextInput
              style={[styles.deleteConfirmInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: deletePasswordError ? colors.danger : colors.inputBorder }]}
              value={deletePassword} onChangeText={(v) => { setDeletePassword(v); setDeletePasswordError(''); }}
              placeholder={t('settings.passwordPlaceholder')} placeholderTextColor={colors.textTertiary}
              secureTextEntry testID="delete-account-password-input"
            />
            {deletePasswordError ? <Text style={[styles.deletePasswordError, { color: colors.danger }]}>{deletePasswordError}</Text> : null}
            <View style={styles.deleteActions}>
              <TouchableOpacity style={[styles.deleteCancelBtn, { borderColor: colors.border }]} onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeletePassword(''); setDeletePasswordError(''); }} disabled={isDeleting} activeOpacity={0.7}>
                <Text style={[styles.deleteCancelText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: (deleteConfirmText === 'SUPPRIMER' && deletePassword.trim()) ? colors.danger : colors.border }]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'SUPPRIMER' || !deletePassword.trim()}
                activeOpacity={0.7} testID="delete-account-confirm-btn"
              >
                {isDeleting ? <ActivityIndicator size="small" color="#FFF" /> : <><Trash2 size={16} color="#FFF" /><Text style={styles.deleteText}>Supprimer définitivement</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}