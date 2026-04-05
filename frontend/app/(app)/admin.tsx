/**
 * @fileoverview Administration screen with tabs: Users, Stores, Subscription, Usage, Audit.
 * Manages team invitations, store CRUD, subscription plans (Stripe),
 * usage statistics, and audit log filtering. Scrolls to top on tab change.
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, TextInput } from 'react-native';
import { Shield, Users, CreditCard, BarChart3, UserPlus, Check, History, FileText, Mail, Send, Store, Crown, Gift, Key } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel, formatDate, formatDateTime } from '@/utils/format';
import { getActionLabel, getEntityLabel } from '@/services/auditService';
import PageHeader from '@/components/PageHeader';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import DropdownPicker from '@/components/DropdownPicker';
import type { AuditEntityType, UserRole } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLANS, PLAN_ORDER, getAnnualSavings, type PlanId, type BillingInterval } from '@/config/plans';

import StoreManager from '@/components/StoreManager';
import type { Store as StoreType } from '@/types';

import styles from '@/components/admin/adminStyles';

type AdminTab = 'users' | 'subscription' | 'usage' | 'audit' | 'stores';

const ENTITY_FILTERS: { label: string; value: AuditEntityType | 'all' }[] = [
  { label: 'Tout', value: 'all' },
  { label: 'Factures', value: 'invoice' },
  { label: 'Devis', value: 'quote' },
  { label: 'Avoirs', value: 'credit_note' },
  { label: 'Clients', value: 'client' },
  { label: 'Paiements', value: 'payment' },
];

function LicenseCodeSection() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { activateLicense, licenseCode } = useSubscription();
  const [code, setCode] = React.useState('');
  const [isActivating, setIsActivating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  const handleActivate = React.useCallback(async () => {
    if (!code.trim()) return;
    setIsActivating(true);
    setError('');
    setSuccess(false);
    try {
      const result = await activateLicense(code.trim());
      if (result.success) {
        setSuccess(true);
        setCode('');
      } else {
        setError(result.error || t('subscription.licenseError'));
      }
    } catch {
      setError(t('subscription.licenseError'));
    } finally {
      setIsActivating(false);
    }
  }, [code, activateLicense, t]);

  if (licenseCode) {
    return (
      <View style={[licStyles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
          <Gift size={14} color={colors.success} />
          <Text style={[licStyles.activeText, { color: colors.success }]}>
            {t('subscription.licenseActive')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[licStyles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 }}>
        <Key size={16} color={colors.primary} />
        <Text style={[licStyles.title, { color: colors.text }]}>
          {t('subscription.enterLicense')}
        </Text>
      </View>
      <View style={licStyles.row}>
        <TextInput
          style={[
            licStyles.input,
            { color: colors.text, backgroundColor: colors.inputBg, borderColor: error ? colors.danger : colors.inputBorder },
          ]}
          value={code}
          onChangeText={(v) => { setCode(v); setError(''); setSuccess(false); }}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          testID="license-code-input"
        />
        <TouchableOpacity
          style={[licStyles.btn, { backgroundColor: colors.primary, opacity: isActivating || !code.trim() ? 0.5 : 1 }]}
          onPress={handleActivate}
          disabled={isActivating || !code.trim()}
          activeOpacity={0.7}
          testID="license-activate-btn"
        >
          <Text style={licStyles.btnText}>
            {isActivating ? '...' : t('subscription.activate')}
          </Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={[licStyles.errorText, { color: colors.danger }]}>{error}</Text> : null}
      {success ? <Text style={[licStyles.successText, { color: colors.success }]}>{t('subscription.licenseSuccess')}</Text> : null}
    </View>
  );
}

const licStyles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 12, padding: 16 },
  title: { fontSize: 14, fontWeight: '600' as const },
  row: { flexDirection: 'row' as const, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, letterSpacing: 1 },
  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, justifyContent: 'center' as const },
  btnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  errorText: { fontSize: 12, marginTop: 6 },
  successText: { fontSize: 12, marginTop: 6 },
  activeText: { fontSize: 13, fontWeight: '600' as const },
});

function SubscriptionTab({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const sub = useSubscription();
  const { confirm } = useConfirm();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

  const handleSelectPlan = useCallback((planId: PlanId) => {
    if (planId === sub.plan && sub.isActive) return;
    void sub.selectPlan(planId, billingInterval);
  }, [sub, billingInterval]);

  const handleCancel = useCallback(() => {
    confirm(
      t('subscription.cancelTitle'),
      t('subscription.cancelConfirm'),
      [
        { text: t('subscription.no'), style: 'cancel' },
        { text: t('subscription.yes'), style: 'destructive', onPress: () => sub.cancelSubscription() },
      ]
    );
  }, [sub, t, confirm]);

  return (
    <View style={subStyles.container}>
      {sub.isTrial && (
        <View style={[subStyles.trialCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Crown size={20} color={colors.primary} />
          <View style={subStyles.trialInfo}>
            <Text style={[subStyles.trialTitle, { color: colors.primary }]}>
              {t('subscription.trialActive')}
            </Text>
            <Text style={[subStyles.trialDesc, { color: colors.primary }]}>
              {t('subscription.trialDaysLeft', { days: String(sub.trialDaysRemaining) })}
            </Text>
          </View>
        </View>
      )}

      {sub.isActive && !sub.isTrial && (
        <View style={[subStyles.currentCard, { backgroundColor: colors.card, borderColor: PLANS[sub.plan].color, borderWidth: 2 }]}>
          <View style={[subStyles.currentBadge, { backgroundColor: PLANS[sub.plan].color }]}>
            <Text style={subStyles.currentBadgeText}>{t('subscription.currentPlan').toUpperCase()}</Text>
          </View>
          <Text style={[subStyles.currentName, { color: colors.text }]}>
            {locale === 'fr' ? PLANS[sub.plan].nameFr : PLANS[sub.plan].nameEn}
          </Text>
          {sub.currentPeriodEnd && (
            <Text style={[subStyles.currentRenewal, { color: colors.textSecondary }]}>
              {t('subscription.renewsOn', { date: new Date(sub.currentPeriodEnd).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US') })}
            </Text>
          )}
          <TouchableOpacity onPress={handleCancel} style={[subStyles.cancelBtn, { borderColor: colors.danger }]}>
            <Text style={[subStyles.cancelBtnText, { color: colors.danger }]}>{t('subscription.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={subStyles.toggleRow}>
        <TouchableOpacity
          style={[
            subStyles.toggleBtn,
            billingInterval === 'monthly' && { backgroundColor: colors.primary },
            billingInterval !== 'monthly' && { backgroundColor: colors.surfaceHover },
          ]}
          onPress={() => setBillingInterval('monthly')}
          activeOpacity={0.7}
        >
          <Text style={[
            subStyles.toggleText,
            { color: billingInterval === 'monthly' ? '#FFF' : colors.textSecondary },
          ]}>
            {t('subscription.monthly')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            subStyles.toggleBtn,
            billingInterval === 'annual' && { backgroundColor: colors.primary },
            billingInterval !== 'annual' && { backgroundColor: colors.surfaceHover },
          ]}
          onPress={() => setBillingInterval('annual')}
          activeOpacity={0.7}
        >
          <Text style={[
            subStyles.toggleText,
            { color: billingInterval === 'annual' ? '#FFF' : colors.textSecondary },
          ]}>
            {t('subscription.annual')}
          </Text>
          <View style={subStyles.saveBadge}>
            <Text style={subStyles.saveBadgeText}>-25%</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[subStyles.plansScroll, !isMobile && { flexDirection: 'row', gap: 16 }]}
        pagingEnabled={isMobile}
        decelerationRate="fast"
        snapToAlignment="center"
      >
        {PLAN_ORDER.map((planId) => {
          const planConfig = PLANS[planId];
          const isCurrent = planId === sub.plan && sub.isActive;
          const price = billingInterval === 'monthly' ? planConfig.monthlyPrice : planConfig.annualPricePerMonth;
          const savings = getAnnualSavings(planId);
          const name = locale === 'fr' ? planConfig.nameFr : planConfig.nameEn;
          const desc = locale === 'fr' ? planConfig.descriptionFr : planConfig.descriptionEn;

          return (
            <View
              key={planId}
              style={[
                subStyles.planCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isCurrent ? planConfig.color : colors.cardBorder,
                  borderWidth: isCurrent ? 2 : 1,
                },
                isMobile && { width: 300 },
              ]}
            >
              {planConfig.popular && (
                <View style={[subStyles.popularBadge, { backgroundColor: planConfig.color }]}>
                  <Crown size={10} color="#FFF" />
                  <Text style={subStyles.popularText}>{t('subscription.popular')}</Text>
                </View>
              )}

              <Text style={[subStyles.planName, { color: colors.text }]}>{name}</Text>
              <Text style={[subStyles.planDesc, { color: colors.textSecondary }]}>{desc}</Text>

              <View style={subStyles.priceRow}>
                <Text style={[subStyles.priceAmount, { color: planConfig.color }]}>
                  {price}€
                </Text>
                <Text style={[subStyles.pricePeriod, { color: colors.textTertiary }]}>
                  /{t('subscription.month')}
                </Text>
              </View>

              {billingInterval === 'annual' && savings > 0 && (
                <Text style={[subStyles.savingsText, { color: colors.success }]}>
                  {t('subscription.save', { amount: String(savings) })}
                </Text>
              )}

              <View style={subStyles.featuresList}>
                {planConfig.features.map((f) => (
                  <View key={f.key} style={subStyles.featureRow}>
                    <Check
                      size={14}
                      color={f.included ? planConfig.color : colors.textTertiary}
                    />
                    <Text
                      style={[
                        subStyles.featureText,
                        {
                          color: f.included ? colors.text : colors.textTertiary,
                          textDecorationLine: f.included ? 'none' : 'line-through',
                        },
                      ]}
                    >
                      {locale === 'fr' ? f.labelFr : f.labelEn}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  subStyles.selectBtn,
                  isCurrent
                    ? { backgroundColor: colors.surfaceHover, borderColor: colors.border, borderWidth: 1 }
                    : { backgroundColor: planConfig.color },
                ]}
                onPress={() => handleSelectPlan(planId)}
                disabled={isCurrent}
                activeOpacity={0.8}
              >
                <Text style={[
                  subStyles.selectBtnText,
                  { color: isCurrent ? colors.textSecondary : '#FFF' },
                ]}>
                  {isCurrent
                    ? t('subscription.currentPlan')
                    : t('subscription.startTrial')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <LicenseCodeSection />
    </View>
  );
}

const subStyles = StyleSheet.create({
  container: { gap: 20 },
  trialCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 16,
  },
  trialInfo: { flex: 1 },
  trialTitle: { fontSize: 15, fontWeight: '700' as const },
  trialDesc: { fontSize: 13, marginTop: 2 },
  currentCard: { borderRadius: 12, padding: 20, position: 'relative' as const },
  currentBadge: { position: 'absolute' as const, top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  currentBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  currentName: { fontSize: 22, fontWeight: '700' as const },
  currentRenewal: { fontSize: 13, marginTop: 4 },
  cancelBtn: { alignSelf: 'flex-start' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  cancelBtnText: { fontSize: 13, fontWeight: '600' as const },
  toggleRow: {
    flexDirection: 'row' as const, alignSelf: 'center' as const,
    borderRadius: 10, overflow: 'hidden' as const, gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
  },
  toggleText: { fontSize: 14, fontWeight: '600' as const },
  saveBadge: {
    backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  saveBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
  plansScroll: { paddingVertical: 4, gap: 16 },
  planCard: {
    borderRadius: 16, padding: 24, minWidth: 280,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  popularBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const,
    gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 12,
  },
  popularText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  planName: { fontSize: 22, fontWeight: '700' as const, marginBottom: 4 },
  planDesc: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  priceRow: { flexDirection: 'row' as const, alignItems: 'baseline' as const, marginBottom: 4 },
  priceAmount: { fontSize: 36, fontWeight: '800' as const },
  pricePeriod: { fontSize: 14, marginLeft: 2 },
  savingsText: { fontSize: 12, fontWeight: '600' as const, marginBottom: 12 },
  featuresList: { gap: 8, marginTop: 16, marginBottom: 20 },
  featureRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  featureText: { fontSize: 13 },
  selectBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' as const },
  selectBtnText: { fontSize: 15, fontWeight: '700' as const },
});

export default function AdminScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { auditLogs, invoices, clients, products, sales, currentPlan } = useData();
  const isMobile = width < 768;
  const { t } = useI18n();
  const { successAlert } = useConfirm();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const scrollRef = useRef<ScrollView>(null);
  const [auditFilter, setAuditFilter] = useState<AuditEntityType | 'all'>('all');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'employee' as UserRole,
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const resetInviteForm = useCallback(() => {
    setInviteForm({ firstName: '', lastName: '', email: '', role: 'employee' });
    setInviteErrors({});
  }, []);

  const handleOpenInvite = useCallback(() => {
    resetInviteForm();
    setInviteModalVisible(true);
  }, [resetInviteForm]);

  const handleCloseInvite = useCallback(() => {
    setInviteModalVisible(false);
    resetInviteForm();
  }, [resetInviteForm]);

  const validateInviteForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!inviteForm.firstName.trim()) errors.firstName = 'Prénom requis';
    if (!inviteForm.lastName.trim()) errors.lastName = 'Nom requis';
    if (!inviteForm.email.trim()) {
      errors.email = 'Email requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email.trim())) {
      errors.email = 'Email invalide';
    }
    setInviteErrors(errors);
    return Object.keys(errors).length === 0;
  }, [inviteForm]);

  const handleSubmitInvite = useCallback(() => {
    if (!validateInviteForm()) return;
    successAlert(
      'Invitation envoyée',
      `Une invitation a été envoyée à ${inviteForm.email}`,
    );
    handleCloseInvite();
  }, [validateInviteForm, inviteForm, handleCloseInvite, successAlert]);

  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.user_metadata?.full_name?.split(' ')[0] ?? 'Utilisateur',
      lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? '',
      email: user.email ?? '',
      role: 'admin' as const,
      isActive: true,
      lastLoginAt: new Date().toISOString(),
    };
  }, [user]);

  const teamUsers = useMemo(() => currentUser ? [currentUser] : [], [currentUser]);

  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === 'all') return auditLogs;
    return auditLogs.filter((l) => l.entityType === auditFilter);
  }, [auditFilter, auditLogs]);

  const usageStats = useMemo(() => {
    const thisMonth = new Date();
    const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString();
    const invoicesThisMonth = invoices.filter(i => i.createdAt >= monthStart).length;
    const totalClients = clients.length;
    const totalProducts = products.length;
    const totalSales = sales.filter(s => s.createdAt >= monthStart).length;
    return { invoicesThisMonth, totalClients, totalProducts, totalSales };
  }, [invoices, clients, products, sales]);

  const [stores, setStores] = useState<StoreType[]>([]);

  const handleAddStore = useCallback((data: Omit<StoreType, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    const newStore: StoreType = {
      ...data,
      id: `store_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      companyId: user?.id ?? 'anonymous',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStores(prev => [...prev, newStore]);
  }, [user?.id]);

  const handleUpdateStore = useCallback((id: string, data: Partial<StoreType>) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s));
  }, []);

  const handleDeleteStore = useCallback((id: string) => {
    setStores(prev => prev.filter(s => s.id !== id));
  }, []);

  const TABS: { key: AdminTab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { key: 'users', label: t('admin.users'), icon: Users },
    { key: 'stores', label: t('stores.title'), icon: Store },
    { key: 'subscription', label: t('admin.subscription'), icon: CreditCard },
    { key: 'usage', label: t('admin.usage'), icon: BarChart3 },
    { key: 'audit', label: t('admin.auditLog'), icon: History },
  ];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return colors.success;
      case 'validate': case 'lock': return colors.primary;
      case 'delete': case 'cancel': return colors.danger;
      case 'send': return colors.primary;
      case 'payment': return colors.success;
      case 'convert': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getActionBg = (action: string) => {
    switch (action) {
      case 'create': return colors.successLight;
      case 'validate': case 'lock': return colors.primaryLight;
      case 'delete': case 'cancel': return colors.dangerLight;
      case 'send': return colors.primaryLight;
      case 'payment': return colors.successLight;
      case 'convert': return colors.warningLight;
      default: return colors.surfaceHover;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('admin.title')}

      />
      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {activeTab === 'users' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Utilisateurs ({teamUsers.length})</Text>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleOpenInvite}>
                <UserPlus size={16} color="#FFF" />
                <Text style={styles.addBtnText}>Inviter</Text>
              </TouchableOpacity>
            </View>
            {teamUsers.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Users size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun utilisateur</Text>
                <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>Connectez-vous pour voir vos informations</Text>
              </View>
            ) : (
              <View style={[styles.usersList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {teamUsers.map((u, i) => (
                  <View
                    key={u.id}
                    style={[styles.userRow, i < teamUsers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.userInitials, { color: colors.primary }]}>
                        {u.firstName[0]}{(u.lastName[0] || '')}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>{u.firstName} {u.lastName}</Text>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: u.role === 'admin' ? colors.dangerLight : u.role === 'manager' ? colors.warningLight : colors.surfaceHover }]}>
                      <Text style={[styles.roleText, { color: u.role === 'admin' ? colors.danger : u.role === 'manager' ? colors.warning : colors.textSecondary }]}>
                        {getRoleLabel(u.role)}
                      </Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: u.isActive ? colors.success : colors.textTertiary }]} />
                    {!isMobile && (
                      <Text style={[styles.lastLogin, { color: colors.textTertiary }]}>
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Jamais'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'stores' && (
          <StoreManager
            stores={stores}
            onAdd={handleAddStore}
            onUpdate={handleUpdateStore}
            onDelete={handleDeleteStore}
          />
        )}

        {activeTab === 'subscription' && (
          <SubscriptionTab isMobile={isMobile} />
        )}

        {activeTab === 'usage' && (
          <View style={styles.usageSection}>
            <View style={[styles.usageRow, isMobile && { flexDirection: 'column' }]}>
              {[
                { label: 'Factures ce mois', value: String(usageStats.invoicesThisMonth), max: currentPlan === 'starter' ? '20' : '∞', pct: currentPlan === 'starter' ? Math.round((usageStats.invoicesThisMonth / 20) * 100) : Math.min(usageStats.invoicesThisMonth, 50) },
                { label: 'Utilisateurs', value: String(teamUsers.length), max: currentPlan === 'starter' ? '1' : currentPlan === 'business' ? '5' : '∞', pct: currentPlan === 'starter' ? 100 : Math.round((teamUsers.length / 5) * 100) },
                { label: 'Clients', value: String(usageStats.totalClients), max: currentPlan === 'starter' ? '50' : '∞', pct: currentPlan === 'starter' ? Math.round((usageStats.totalClients / 50) * 100) : Math.min(usageStats.totalClients, 50) },
                { label: 'Ventes ce mois', value: String(usageStats.totalSales), max: '∞', pct: Math.min(usageStats.totalSales * 2, 80) },
              ].map((item) => (
                <View key={item.label} style={[styles.usageCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text style={[styles.usageValue, { color: colors.text }]}>{item.value}</Text>
                  <Text style={[styles.usageMax, { color: colors.textTertiary }]}>sur {item.max}</Text>
                  <View style={[styles.usageBarBg, { backgroundColor: colors.borderLight }]}>
                    <View style={[styles.usageBarFill, { width: `${Math.min(item.pct, 100)}%` as never, backgroundColor: item.pct > 80 ? colors.danger : colors.primary }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'audit' && (
          <>
            <View style={styles.auditHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Journal d'audit ({filteredAuditLogs.length} entrées)
              </Text>
              <View style={[styles.auditInfo, { backgroundColor: colors.primaryLight }]}>
                <Shield size={14} color={colors.primary} />
                <Text style={[styles.auditInfoText, { color: colors.primary }]}>
                  Toutes les actions critiques sont tracées
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.auditFilters}>
              {ENTITY_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: auditFilter === f.value ? colors.primary : colors.card,
                      borderColor: auditFilter === f.value ? colors.primary : colors.cardBorder,
                    },
                  ]}
                  onPress={() => setAuditFilter(f.value)}
                >
                  <Text style={[styles.filterText, { color: auditFilter === f.value ? '#FFF' : colors.textSecondary }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredAuditLogs.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <History size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune entrée d'audit</Text>
                <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>Les actions effectuées apparaîtront ici</Text>
              </View>
            )}
            {filteredAuditLogs.length > 0 && (
            <View style={[styles.auditList, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {filteredAuditLogs.map((log, i) => (
                <View
                  key={log.id}
                  style={[
                    styles.auditRow,
                    i < filteredAuditLogs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  ]}
                >
                  <View style={[styles.auditIcon, { backgroundColor: getActionBg(log.action) }]}>
                    <FileText size={14} color={getActionColor(log.action)} />
                  </View>
                  <View style={styles.auditContent}>
                    <View style={styles.auditTopRow}>
                      <View style={[styles.actionBadge, { backgroundColor: getActionBg(log.action) }]}>
                        <Text style={[styles.actionBadgeText, { color: getActionColor(log.action) }]}>
                          {getActionLabel(log.action)}
                        </Text>
                      </View>
                      <View style={[styles.entityBadge, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[styles.entityBadgeText, { color: colors.textSecondary }]}>
                          {getEntityLabel(log.entityType)}
                        </Text>
                      </View>
                      <Text style={[styles.auditEntity, { color: colors.text }]}>{log.entityLabel}</Text>
                    </View>
                    <Text style={[styles.auditDetails, { color: colors.textSecondary }]}>{log.details}</Text>
                    <View style={styles.auditMeta}>
                      <Text style={[styles.auditUser, { color: colors.textTertiary }]}>{log.userName}</Text>
                      <Text style={[styles.auditTime, { color: colors.textTertiary }]}>{formatDateTime(log.timestamp)}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            )}
          </>
        )}
      </ScrollView>

      <FormModal
        visible={inviteModalVisible}
        onClose={handleCloseInvite}
        title="Inviter un utilisateur"
        subtitle="Envoyez une invitation par email pour rejoindre votre équipe"
        onSubmit={handleSubmitInvite}
        submitLabel="Envoyer l'invitation"
      >
        <View style={styles.inviteIconRow}>
          <View style={[styles.inviteIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Mail size={28} color={colors.primary} />
          </View>
        </View>
        <View style={styles.inviteRow}>
          <View style={styles.inviteHalf}>
            <FormField
              label="Prénom"
              value={inviteForm.firstName}
              onChangeText={(v) => setInviteForm((f) => ({ ...f, firstName: v }))}
              placeholder="Jean"
              required
              error={inviteErrors.firstName}
              testID="invite-first-name"
            />
          </View>
          <View style={styles.inviteHalf}>
            <FormField
              label="Nom"
              value={inviteForm.lastName}
              onChangeText={(v) => setInviteForm((f) => ({ ...f, lastName: v }))}
              placeholder="Dupont"
              required
              error={inviteErrors.lastName}
              testID="invite-last-name"
            />
          </View>
        </View>
        <FormField
          label="Adresse email"
          value={inviteForm.email}
          onChangeText={(v) => setInviteForm((f) => ({ ...f, email: v }))}
          placeholder="jean.dupont@entreprise.com"
          required
          keyboardType="email-address"
          error={inviteErrors.email}
          testID="invite-email"
        />
        <DropdownPicker
          label="Rôle"
          value={inviteForm.role}
          options={[
            { label: 'Propriétaire', value: 'admin' },
            { label: 'Gérant', value: 'manager' },
            { label: 'Caissier', value: 'employee' },
            { label: 'Comptable', value: 'accountant' },
          ]}
          onSelect={(v) => setInviteForm((f) => ({ ...f, role: v as UserRole }))}
          required
        />
        <View style={[styles.inviteNote, { backgroundColor: colors.primaryLight }]}>
          <Send size={14} color={colors.primary} />
          <Text style={[styles.inviteNoteText, { color: colors.primary }]}>
            L'utilisateur recevra un email avec un lien pour créer son compte et rejoindre votre équipe.
          </Text>
        </View>
      </FormModal>
    </View>
  );
}

