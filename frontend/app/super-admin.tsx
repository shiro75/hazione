import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Key, Users, BarChart3, Plus, Trash2, Shield,
  Copy, Check, UserX, UserCheck, Lock, ChevronDown, ChevronUp,
  Clock, AlertCircle, CheckCircle, XCircle, Minus,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { PLANS, type PlanId } from '@/config/plans';
import {
  checkIsSuperAdmin, logAdminAccess,
  fetchLicenses, createLicense, revokeLicense, deleteLicense, removeLicenseUser,
  fetchAdminUsers, updateUserPlan, toggleUserActive,
  fetchAdminStats,
  type AdminLicense, type AdminUser, type AdminStats, type LicenseUser,
} from '@/services/superAdminService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConfirm } from '@/contexts/ConfirmContext';

const ADMIN_PIN_KEY = '@hazione_admin_pin';
const DEFAULT_PIN = '000000';

type AdminTab = 'licenses' | 'users' | 'stats';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#10B98118', text: '#10B981' },
  expired: { bg: '#F59E0B18', text: '#F59E0B' },
  revoked: { bg: '#EF444418', text: '#EF4444' },
};

export default function SuperAdminScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { errorAlert, confirm } = useConfirm();
  const insets = useSafeAreaInsets();

  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<AdminTab>('licenses');

  const [licenses, setLicenses] = useState<AdminLicense[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [genPlan, setGenPlan] = useState<PlanId>('pro');
  const [genDuration, setGenDuration] = useState<'lifetime' | '1year' | '1month'>('1year');
  const [genMaxUsers, setGenMaxUsers] = useState<string>('5');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string>('');

  const [expandedLicense, setExpandedLicense] = useState<string | null>(null);

  const [userFilter, setUserFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const verify = async () => {
      if (!user?.id) {
        router.replace('/');
        return;
      }
      try {
        const isSA = await checkIsSuperAdmin(user.id);
        if (!isSA) {
          setTimeout(() => { router.replace('/'); }, 100);
          return;
        }
        setIsVerifying(false);
      } catch {
        setTimeout(() => { router.replace('/'); }, 100);
      }
    };
    void verify();
  }, [user?.id, router]);

  const handlePinSubmit = useCallback(async () => {
    const storedPin = await AsyncStorage.getItem(ADMIN_PIN_KEY);
    const validPin = storedPin || DEFAULT_PIN;
    if (pinInput === validPin) {
      setIsAuthorized(true);
      setPinError('');
      if (user?.id) {
        void logAdminAccess(user.id, 'access_super_admin');
      }
    } else {
      setPinError(t('superAdmin.pinError'));
    }
  }, [pinInput, user?.id, t]);

  useEffect(() => {
    if (!isAuthorized) return;
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [l, u, s2] = await Promise.all([fetchLicenses(), fetchAdminUsers(), fetchAdminStats()]);
        setLicenses(l);
        setUsers(u);
        setStats(s2);
      } finally {
        setIsLoadingData(false);
      }
    };
    void loadData();
  }, [isAuthorized]);

  const handleGenerate = useCallback(async () => {
    const maxUsers = Math.max(1, parseInt(genMaxUsers, 10) || 5);
    setIsGenerating(true);
    try {
      const lic = await createLicense(genPlan, genDuration, maxUsers);
      if (lic) {
        setLicenses(prev => [lic, ...prev]);
        setShowGenModal(false);
        setGenMaxUsers('5');
        if (user?.id) await logAdminAccess(user.id, `generate_license_${genPlan}_${genDuration}_${maxUsers}users`);
      } else {
        errorAlert(
          t('superAdmin.error') || 'Erreur',
          t('superAdmin.licenseCreateError') || 'Impossible de créer la licence. Vérifiez que la table "licenses" existe dans Supabase et que les permissions RLS sont correctes.',
        );
      }
    } catch (e) {
      errorAlert(
        t('superAdmin.error') || 'Erreur',
        String(e) || 'Une erreur inattendue est survenue.',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [genPlan, genDuration, genMaxUsers, user?.id, t, errorAlert]);

  const handleRevoke = useCallback(async (lic: AdminLicense) => {
    confirm(t('superAdmin.revoke'), `${lic.code}`, [
      { text: t('subscription.no'), style: 'cancel' },
      {
        text: t('superAdmin.revoke'), style: 'destructive', onPress: async () => {
          const ok = await revokeLicense(lic.id);
          if (ok) {
            setLicenses(prev => prev.map(l => l.id === lic.id ? { ...l, status: 'revoked' as const } : l));
          }
        },
      },
    ]);
  }, [t, confirm]);

  const handleDelete = useCallback(async (lic: AdminLicense) => {
    confirm(t('superAdmin.deleteLicense'), `${lic.code}`, [
      { text: t('subscription.no'), style: 'cancel' },
      {
        text: t('superAdmin.delete'), style: 'destructive', onPress: async () => {
          const ok = await deleteLicense(lic.id);
          if (ok) {
            setLicenses(prev => prev.filter(l => l.id !== lic.id));
          }
        },
      },
    ]);
  }, [t, confirm]);

  const handleRemoveUser = useCallback(async (licenseId: string, licUser: LicenseUser) => {
    confirm(t('superAdmin.removeUser'), licUser.email || licUser.full_name, [
      { text: t('subscription.no'), style: 'cancel' },
      {
        text: t('superAdmin.remove'), style: 'destructive', onPress: async () => {
          const ok = await removeLicenseUser(licUser.id);
          if (ok) {
            setLicenses(prev => prev.map(l => {
              if (l.id !== licenseId) return l;
              const updatedUsers = l.attached_users.filter(u2 => u2.id !== licUser.id);
              return { ...l, attached_users: updatedUsers, attached_users_count: updatedUsers.length };
            }));
          }
        },
      },
    ]);
  }, [t, confirm]);

  const handleCopy = useCallback(async (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
    } catch {}
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  }, []);

  const handleChangePlan = useCallback(async (u: AdminUser, newPlan: PlanId) => {
    const ok = await updateUserPlan(u.id, newPlan);
    if (ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, plan: newPlan, status: 'active' } : x));
      if (user?.id) await logAdminAccess(user.id, `change_plan_${u.email}_to_${newPlan}`);
    }
  }, [user?.id]);

  const handleToggleActive = useCallback(async (u: AdminUser) => {
    const newActive = !u.is_active;
    const ok = await toggleUserActive(u.id, newActive);
    if (ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: newActive } : x));
      if (user?.id) await logAdminAccess(user.id, `${newActive ? 'activate' : 'deactivate'}_user_${u.email}`);
    }
  }, [user?.id]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userFilter !== 'all' && u.plan !== userFilter) return false;
      if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
      return true;
    });
  }, [users, userFilter, userStatusFilter]);

  const formatDate = useCallback((dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'expired': return AlertCircle;
      case 'revoked': return XCircle;
      default: return Clock;
    }
  }, []);

  if (isVerifying) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthorized) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surfaceHover }]} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.pinCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.pinIcon, { backgroundColor: colors.primaryLight }]}>
            <Shield size={32} color={colors.primary} />
          </View>
          <Text style={[styles.pinTitle, { color: colors.text }]}>{t('superAdmin.pinTitle')}</Text>
          <Text style={[styles.pinDesc, { color: colors.textSecondary }]}>{t('superAdmin.pinDesc')}</Text>
          <TextInput
            style={[styles.pinInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: pinError ? colors.danger : colors.inputBorder }]}
            value={pinInput}
            onChangeText={(v) => { setPinInput(v.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
            placeholder="000000"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            testID="admin-pin-input"
          />
          {pinError ? <Text style={[styles.pinErrorText, { color: colors.danger }]}>{pinError}</Text> : null}
          <TouchableOpacity
            style={[styles.pinBtn, { backgroundColor: colors.primary, opacity: pinInput.length === 6 ? 1 : 0.5 }]}
            onPress={handlePinSubmit}
            disabled={pinInput.length !== 6}
            activeOpacity={0.7}
          >
            <Lock size={16} color="#FFF" />
            <Text style={styles.pinBtnText}>{t('superAdmin.pinTitle')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const TABS: { key: AdminTab; label: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
    { key: 'licenses', label: t('superAdmin.licenses'), icon: Key },
    { key: 'users', label: t('superAdmin.users'), icon: Users },
    { key: 'stats', label: t('superAdmin.stats'), icon: BarChart3 },
  ];

  const durationLabels: Record<string, string> = {
    lifetime: t('superAdmin.lifetime'),
    '1year': t('superAdmin.1year'),
    '1month': t('superAdmin.1month'),
  };

  const statusLabels: Record<string, string> = {
    active: t('superAdmin.statusActive'),
    expired: t('superAdmin.statusExpired'),
    revoked: t('superAdmin.statusRevoked'),
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.headerBack, { backgroundColor: colors.surfaceHover }]} onPress={() => router.back()}>
          <ArrowLeft size={18} color={colors.text} />
        </TouchableOpacity>
        <Shield size={18} color={colors.danger} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('superAdmin.title')}</Text>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
              activeOpacity={0.7}
            >
              <tab.icon size={15} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoadingData ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView ref={scrollRef} style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'licenses' && (
            <View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowGenModal(true)}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>{t('superAdmin.generateLicense')}</Text>
              </TouchableOpacity>

              {licenses.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('superAdmin.noLicenses')}</Text>
              )}

              {licenses.map(lic => {
                const isExpanded = expandedLicense === lic.id;
                const statusColor = STATUS_COLORS[lic.status] ?? STATUS_COLORS.active;
                const StatusIcon = getStatusIcon(lic.status);
                const usersRatio = `${lic.attached_users_count}/${lic.max_users}`;

                return (
                  <View key={lic.id} style={[styles.licCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: lic.status === 'revoked' ? 0.7 : 1 }]}>
                    <View style={styles.licRow}>
                      <Text style={[styles.licCode, { color: colors.text }]}>{lic.code}</Text>
                      <View style={styles.licHeaderActions}>
                        <TouchableOpacity onPress={() => handleCopy(lic.code)} hitSlop={8}>
                          {copiedCode === lic.code ? <Check size={14} color={colors.success} /> : <Copy size={14} color={colors.textTertiary} />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.licMeta}>
                      <View style={[styles.licBadge, { backgroundColor: PLANS[lic.plan]?.color + '18', borderColor: PLANS[lic.plan]?.color }]}>
                        <Text style={[styles.licBadgeText, { color: PLANS[lic.plan]?.color }]}>{lic.plan.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.licStatusBadge, { backgroundColor: statusColor.bg }]}>
                        <StatusIcon size={10} color={statusColor.text} />
                        <Text style={[styles.licStatusText, { color: statusColor.text }]}>
                          {statusLabels[lic.status] ?? lic.status}
                        </Text>
                      </View>
                      <Text style={[styles.licDuration, { color: colors.textSecondary }]}>
                        <Clock size={10} color={colors.textSecondary} /> {durationLabels[lic.duration] ?? lic.duration}
                      </Text>
                    </View>

                    <View style={[styles.licInfoRow, { borderTopColor: colors.border }]}>
                      <View style={styles.licInfoItem}>
                        <Users size={13} color={colors.textSecondary} />
                        <Text style={[styles.licInfoText, { color: colors.text }]}>{usersRatio} {t('superAdmin.usersAttached')}</Text>
                      </View>
                      {lic.expires_at && (
                        <View style={styles.licInfoItem}>
                          <Clock size={13} color={colors.textSecondary} />
                          <Text style={[styles.licInfoText, { color: colors.textSecondary }]}>{formatDate(lic.expires_at)}</Text>
                        </View>
                      )}
                    </View>

                    {lic.attached_users_count > 0 && (
                      <TouchableOpacity
                        style={[styles.expandBtn, { borderTopColor: colors.border }]}
                        onPress={() => setExpandedLicense(isExpanded ? null : lic.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.expandBtnText, { color: colors.primary }]}>
                          {isExpanded ? t('superAdmin.hideUsers') : t('superAdmin.showUsers')} ({lic.attached_users_count})
                        </Text>
                        {isExpanded ? <ChevronUp size={14} color={colors.primary} /> : <ChevronDown size={14} color={colors.primary} />}
                      </TouchableOpacity>
                    )}

                    {isExpanded && lic.attached_users.length > 0 && (
                      <View style={[styles.usersList, { borderTopColor: colors.border }]}>
                        {lic.attached_users.map(lu => (
                          <View key={lu.id} style={[styles.attachedUser, { backgroundColor: colors.surfaceHover }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.attachedUserName, { color: colors.text }]}>
                                {lu.full_name || lu.email}
                              </Text>
                              {lu.full_name ? (
                                <Text style={[styles.attachedUserEmail, { color: colors.textTertiary }]}>{lu.email}</Text>
                              ) : null}
                              <Text style={[styles.attachedUserDate, { color: colors.textTertiary }]}>
                                {t('superAdmin.assignedOn')} {formatDate(lu.assigned_at)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveUser(lic.id, lu)}
                              hitSlop={8}
                              style={[styles.removeUserBtn, { backgroundColor: colors.danger + '15' }]}
                            >
                              <Minus size={12} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.licActions}>
                      {lic.status === 'active' && (
                        <TouchableOpacity
                          style={[styles.licActionBtn, { borderColor: colors.warning }]}
                          onPress={() => handleRevoke(lic)}
                          activeOpacity={0.7}
                        >
                          <XCircle size={12} color={colors.warning} />
                          <Text style={[styles.licActionText, { color: colors.warning }]}>{t('superAdmin.revoke')}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.licActionBtn, { borderColor: colors.danger }]}
                        onPress={() => handleDelete(lic)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={12} color={colors.danger} />
                        <Text style={[styles.licActionText, { color: colors.danger }]}>{t('superAdmin.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'users' && (
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {['all', 'solo', 'pro', 'business'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, { backgroundColor: userFilter === f ? colors.primary : colors.surfaceHover, borderColor: userFilter === f ? colors.primary : colors.border }]}
                    onPress={() => setUserFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, { color: userFilter === f ? '#FFF' : colors.text }]}>
                      {f === 'all' ? t('superAdmin.filterAll') : f.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
                <View style={{ width: 8 }} />
                {['all', 'trial', 'active', 'canceled', 'expired'].map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, { backgroundColor: userStatusFilter === f ? colors.primary : colors.surfaceHover, borderColor: userStatusFilter === f ? colors.primary : colors.border }]}
                    onPress={() => setUserStatusFilter(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, { color: userStatusFilter === f ? '#FFF' : colors.text }]}>
                      {f === 'all' ? t('superAdmin.filterAll') : f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredUsers.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('superAdmin.noUsers')}</Text>
              )}

              {filteredUsers.map(u => (
                <View key={u.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, opacity: u.is_active ? 1 : 0.6 }]}>
                  <View style={styles.userHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.userName, { color: colors.text }]}>{u.full_name || u.email}</Text>
                      <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                    </View>
                    <View style={[styles.licBadge, { backgroundColor: PLANS[u.plan]?.color + '18', borderColor: PLANS[u.plan]?.color }]}>
                      <Text style={[styles.licBadgeText, { color: PLANS[u.plan]?.color }]}>{u.plan.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.userMeta}>
                    <Text style={[styles.userMetaText, { color: colors.textTertiary }]}>Status: {u.status}</Text>
                    {u.last_sign_in_at && (
                      <Text style={[styles.userMetaText, { color: colors.textTertiary }]}>
                        {new Date(u.last_sign_in_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.userActions}>
                    {(['solo', 'pro', 'business'] as PlanId[]).filter(p => p !== u.plan).map(p => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.userActionBtn, { borderColor: PLANS[p].color }]}
                        onPress={() => handleChangePlan(u, p)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.userActionText, { color: PLANS[p].color }]}>{p.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.userActionBtn, { borderColor: u.is_active ? colors.danger : colors.success }]}
                      onPress={() => handleToggleActive(u)}
                      activeOpacity={0.7}
                    >
                      {u.is_active ? <UserX size={12} color={colors.danger} /> : <UserCheck size={12} color={colors.success} />}
                      <Text style={[styles.userActionText, { color: u.is_active ? colors.danger : colors.success }]}>
                        {u.is_active ? t('superAdmin.deactivate') : t('superAdmin.activate')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'stats' && stats && (
            <View>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Users size={20} color={colors.primary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalUsers}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('superAdmin.totalUsers')}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <BarChart3 size={20} color={colors.warning} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.activeTrials}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('superAdmin.activeTrials')}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Key size={20} color={colors.success} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{stats.estimatedRevenue}€</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('superAdmin.estimatedRevenue')}</Text>
                </View>
              </View>

              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('superAdmin.planDistribution')}</Text>
                {(['solo', 'pro', 'business'] as PlanId[]).map(p => {
                  const count = stats.planDistribution[p] ?? 0;
                  const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                  return (
                    <View key={p} style={styles.distRow}>
                      <View style={[styles.distDot, { backgroundColor: PLANS[p].color }]} />
                      <Text style={[styles.distLabel, { color: colors.text }]}>{p.toUpperCase()}</Text>
                      <View style={[styles.distBar, { backgroundColor: colors.surfaceHover }]}>
                        <View style={[styles.distBarFill, { width: `${Math.max(2, pct)}%` as never, backgroundColor: PLANS[p].color }]} />
                      </View>
                      <Text style={[styles.distCount, { color: colors.textSecondary }]}>{count}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('superAdmin.recentSignups')}</Text>
                {stats.recentSignups.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>-</Text>
                ) : (
                  stats.recentSignups.slice(-10).map(s2 => (
                    <View key={s2.date} style={styles.signupRow}>
                      <Text style={[styles.signupDate, { color: colors.textSecondary }]}>{s2.date}</Text>
                      <View style={[styles.signupBar, { backgroundColor: colors.surfaceHover }]}>
                        <View style={[styles.signupBarFill, { width: `${Math.min(100, s2.count * 20)}%` as never, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.signupCount, { color: colors.text }]}>{s2.count}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showGenModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('superAdmin.generateLicense')}</Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>{t('superAdmin.plan')}</Text>
            <View style={styles.modalOptions}>
              {(['solo', 'pro', 'business'] as PlanId[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.modalOption, { backgroundColor: genPlan === p ? PLANS[p].color : colors.surfaceHover, borderColor: PLANS[p].color }]}
                  onPress={() => setGenPlan(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalOptionText, { color: genPlan === p ? '#FFF' : colors.text }]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 16 }]}>{t('superAdmin.duration')}</Text>
            <View style={styles.modalOptions}>
              {(['1month', '1year', 'lifetime'] as const).map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.modalOption, { backgroundColor: genDuration === d ? colors.primary : colors.surfaceHover, borderColor: genDuration === d ? colors.primary : colors.border }]}
                  onPress={() => setGenDuration(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalOptionText, { color: genDuration === d ? '#FFF' : colors.text }]}>{durationLabels[d]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.singleUseNote, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
              <Key size={14} color={colors.primary} />
              <Text style={[styles.singleUseText, { color: colors.textSecondary }]}>
                {t('superAdmin.singleUseNote') || 'Clé à usage unique — sera liée au compte qui l\'active'}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowGenModal(false); setGenMaxUsers('1'); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>{t('subscription.no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalGenBtn, { backgroundColor: colors.primary, opacity: isGenerating ? 0.6 : 1 }]}
                onPress={handleGenerate}
                disabled={isGenerating}
                activeOpacity={0.7}
              >
                <Text style={styles.modalGenText}>{isGenerating ? '...' : t('superAdmin.generate')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  backBtn: { position: 'absolute' as const, top: 60, left: 20, width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBack: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  headerTitle: { fontSize: 17, fontWeight: '700' as const, flex: 1 },
  tabBar: { flexDirection: 'row' as const, borderBottomWidth: 1 },
  tabItem: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '600' as const },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 40 },

  pinCard: { width: '90%' as never, maxWidth: 380, borderWidth: 1, borderRadius: 16, padding: 32, alignItems: 'center' as const },
  pinIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 20 },
  pinTitle: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8 },
  pinDesc: { fontSize: 13, textAlign: 'center' as const, marginBottom: 24 },
  pinInput: { width: '100%' as never, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontWeight: '700' as const, textAlign: 'center' as const, letterSpacing: 8, marginBottom: 8 },
  pinErrorText: { fontSize: 12, marginBottom: 12 },
  pinBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, width: '100%' as never, paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  pinBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' as const },

  actionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 12, borderRadius: 10, marginBottom: 16 },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  emptyText: { textAlign: 'center' as const, fontSize: 14, marginTop: 40 },

  licCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12, overflow: 'hidden' as const },
  licRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 10 },
  licHeaderActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  licCode: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 1 },
  licMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 10, flexWrap: 'wrap' as const },
  licBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  licBadgeText: { fontSize: 10, fontWeight: '700' as const },
  licDuration: { fontSize: 11 },
  licStatusBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  licStatusText: { fontSize: 10, fontWeight: '600' as const },

  licInfoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingTop: 10, borderTopWidth: 1, marginBottom: 4 },
  licInfoItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  licInfoText: { fontSize: 12 },

  expandBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingTop: 10, borderTopWidth: 1, marginTop: 8 },
  expandBtnText: { fontSize: 12, fontWeight: '600' as const },

  usersList: { borderTopWidth: 1, marginTop: 8, paddingTop: 8, gap: 6 },
  attachedUser: { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: 8, padding: 10 },
  attachedUserName: { fontSize: 13, fontWeight: '600' as const },
  attachedUserEmail: { fontSize: 11, marginTop: 1 },
  attachedUserDate: { fontSize: 10, marginTop: 2 },
  removeUserBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },

  licActions: { flexDirection: 'row' as const, gap: 8, marginTop: 10 },
  licActionBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, borderWidth: 1, borderRadius: 8, paddingVertical: 8 },
  licActionText: { fontSize: 12, fontWeight: '600' as const },

  filterRow: { gap: 6, paddingBottom: 12, flexDirection: 'row' as const },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' as const },

  userCard: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 12 },
  userHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 8 },
  userName: { fontSize: 14, fontWeight: '600' as const },
  userEmail: { fontSize: 12, marginTop: 2 },
  userMeta: { flexDirection: 'row' as const, gap: 12, marginBottom: 10 },
  userMetaText: { fontSize: 11 },
  userActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  userActionBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  userActionText: { fontSize: 11, fontWeight: '600' as const },

  statsGrid: { flexDirection: 'row' as const, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, alignItems: 'center' as const, gap: 8 },
  statValue: { fontSize: 22, fontWeight: '700' as const },
  statLabel: { fontSize: 11, textAlign: 'center' as const },

  section: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 14 },
  distRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 10 },
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distLabel: { width: 60, fontSize: 12, fontWeight: '600' as const },
  distBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' as const },
  distBarFill: { height: '100%' as never, borderRadius: 4 },
  distCount: { width: 30, fontSize: 12, textAlign: 'right' as const },
  signupRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 },
  signupDate: { width: 80, fontSize: 11 },
  signupBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' as const },
  signupBarFill: { height: '100%' as never, borderRadius: 3 },
  signupCount: { width: 24, fontSize: 12, fontWeight: '600' as const, textAlign: 'right' as const },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' as const, alignItems: 'center' as const, padding: 24 },
  modalContent: { width: '100%' as never, maxWidth: 400, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '500' as const, marginBottom: 8 },
  modalOptions: { flexDirection: 'row' as const, gap: 8 },
  modalOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const },
  modalOptionText: { fontSize: 13, fontWeight: '600' as const },
  modalActions: { flexDirection: 'row' as const, gap: 10, marginTop: 24 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' as const },
  modalCancelText: { fontSize: 14, fontWeight: '600' as const },
  modalGenBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' as const },
  modalGenText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },

  singleUseNote: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1 },
  singleUseText: { fontSize: 12, flex: 1 },
});
