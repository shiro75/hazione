/**
 * @fileoverview Payments module screen.
 * Displays payment history with filtering by status and provider.
 * Shows payment details in a bottom sheet with refund option.
 * Supports both Stripe and CinetPay providers.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import {
  CreditCard,
  Smartphone,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  X,
  ArrowUpRight,
  Inbox,
  Filter,
  Banknote,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import AccessDenied from '@/components/AccessDenied';
import PageHeader from '@/components/PageHeader';
import { formatCurrency, formatDateTime } from '@/utils/format';
import {
  fetchUnifiedPayments,
  getProviderLabel,
  getMethodLabel,
  getStatusColor,
} from '@/services/paymentService';
import type { UnifiedPayment, UnifiedPaymentStatus, PaymentProvider, ThemeColors } from '@/types';

type StatusFilter = 'all' | UnifiedPaymentStatus;
type ProviderFilter = 'all' | PaymentProvider;

const STATUS_OPTIONS: { key: StatusFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'payments.allStatuses' },
  { key: 'pending', labelKey: 'payments.pending' },
  { key: 'processing', labelKey: 'payments.processing' },
  { key: 'completed', labelKey: 'payments.completed' },
  { key: 'failed', labelKey: 'payments.failed' },
  { key: 'refunded', labelKey: 'payments.refunded' },
  { key: 'cancelled', labelKey: 'payments.cancelled' },
];

const PROVIDER_OPTIONS: { key: ProviderFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'cinetpay', label: 'CinetPay' },
];

function getStatusIcon(status: UnifiedPaymentStatus) {
  switch (status) {
    case 'completed': return CheckCircle;
    case 'pending': return Clock;
    case 'processing': return RefreshCw;
    case 'failed': return XCircle;
    case 'refunded': return ArrowUpRight;
    case 'cancelled': return XCircle;
    default: return Clock;
  }
}

function getProviderIcon(provider: PaymentProvider) {
  switch (provider) {
    case 'stripe': return CreditCard;
    case 'cinetpay': return Smartphone;
    default: return Banknote;
  }
}

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { canAccess } = useRole();
  const { user } = useAuth();
  const { t } = useI18n();
  const { company } = useData();
  const isMobile = width < 768;

  const [payments, setPayments] = useState<UnifiedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const companyId = user?.id ?? '';
  const cur = company.currency || 'EUR';

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    void fetchUnifiedPayments(companyId)
      .then((data) => {
        setPayments(data);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const filteredPayments = useMemo(() => {
    let result = payments;
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (providerFilter !== 'all') {
      result = result.filter((p) => p.provider === providerFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          (p.providerTransactionId ?? '').toLowerCase().includes(q) ||
          String(p.amount).includes(q)
      );
    }
    return result;
  }, [payments, statusFilter, providerFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    const completed = payments.filter((p) => p.status === 'completed');
    const completedTotal = completed.reduce((sum, p) => sum + p.amount, 0);
    const pending = payments.filter((p) => p.status === 'pending').length;
    const failed = payments.filter((p) => p.status === 'failed').length;
    return { total, completedTotal, completedCount: completed.length, pending, failed };
  }, [payments]);

  const handleRefresh = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    void fetchUnifiedPayments(companyId)
      .then((data) => setPayments(data))
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!canAccess('payments')) {
    return <AccessDenied />;
  }

  const renderStatCards = () => (
    <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.statIconWrap, { backgroundColor: '#059669' + '18' }]}>
          <CheckCircle size={18} color="#059669" />
        </View>
        <Text style={[styles.statValue, { color: colors.text }]}>
          {formatCurrency(stats.completedTotal, cur)}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          {t('payments.completed')} ({stats.completedCount})
        </Text>
      </View>

      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.statIconWrap, { backgroundColor: '#D97706' + '18' }]}>
          <Clock size={18} color="#D97706" />
        </View>
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.pending}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('payments.pending')}</Text>
      </View>

      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.statIconWrap, { backgroundColor: '#DC2626' + '18' }]}>
          <XCircle size={18} color="#DC2626" />
        </View>
        <Text style={[styles.statValue, { color: colors.text }]}>{stats.failed}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('payments.failed')}</Text>
      </View>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersRow}>
      <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('payments.search')}
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <X size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.filterBtn,
          {
            backgroundColor: (statusFilter !== 'all' || providerFilter !== 'all')
              ? colors.primaryLight
              : colors.surfaceHover,
            borderColor: (statusFilter !== 'all' || providerFilter !== 'all')
              ? colors.primary + '40'
              : colors.border,
          },
        ]}
        onPress={() => setFilterMenuOpen(true)}
        activeOpacity={0.7}
      >
        <Filter
          size={16}
          color={(statusFilter !== 'all' || providerFilter !== 'all') ? colors.primary : colors.textSecondary}
        />
        {!isMobile && (
          <Text
            style={[
              styles.filterBtnText,
              {
                color: (statusFilter !== 'all' || providerFilter !== 'all')
                  ? colors.primary
                  : colors.textSecondary,
              },
            ]}
          >
            {t('common.filter')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderPaymentRow = (payment: UnifiedPayment) => {
    const statusColor = getStatusColor(payment.status);
    const StatusIcon = getStatusIcon(payment.status);
    const ProviderIcon = getProviderIcon(payment.provider);

    return (
      <TouchableOpacity
        key={payment.id}
        style={[styles.paymentRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={() => setSelectedPayment(payment)}
        activeOpacity={0.7}
        testID={`payment-row-${payment.id}`}
      >
        <View style={[styles.paymentIconWrap, { backgroundColor: statusColor + '14' }]}>
          <ProviderIcon size={20} color={statusColor} />
        </View>
        <View style={styles.paymentInfo}>
          <View style={styles.paymentTopRow}>
            <Text style={[styles.paymentAmount, { color: colors.text }]} numberOfLines={1}>
              {formatCurrency(payment.amount, payment.currency)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
              <StatusIcon size={12} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {t(`payments.${payment.status}`)}
              </Text>
            </View>
          </View>
          <View style={styles.paymentBottomRow}>
            <Text style={[styles.paymentMeta, { color: colors.textTertiary }]}>
              {getProviderLabel(payment.provider)} — {getMethodLabel(payment.paymentMethodType)}
            </Text>
            <Text style={[styles.paymentDate, { color: colors.textTertiary }]}>
              {formatDateTime(payment.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHover }]}>
        <Inbox size={32} color={colors.textTertiary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('payments.noPayments')}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('payments.noPaymentsDesc')}</Text>
    </View>
  );

  const renderDetailModal = () => {
    if (!selectedPayment) return null;
    const p = selectedPayment;
    const statusColor = getStatusColor(p.status);
    const StatusIcon = getStatusIcon(p.status);

    return (
      <Modal
        visible={!!selectedPayment}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedPayment(null)}>
          <View style={styles.modalOverlayBg} />
        </Pressable>
        <View
          style={[
            styles.detailSheet,
            { backgroundColor: colors.surface },
            Platform.OS === 'web'
              ? { boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 24,
                  elevation: 16,
                },
          ]}
        >
          <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>{t('payments.detail')}</Text>
            <TouchableOpacity onPress={() => setSelectedPayment(null)} hitSlop={12}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailAmountSection}>
              <Text style={[styles.detailAmountLabel, { color: colors.textSecondary }]}>
                {t('payments.amount')}
              </Text>
              <Text style={[styles.detailAmount, { color: colors.text }]}>
                {formatCurrency(p.amount, p.currency)}
              </Text>
              <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor + '18' }]}>
                <StatusIcon size={16} color={statusColor} />
                <Text style={[styles.statusTextLarge, { color: statusColor }]}>
                  {t(`payments.${p.status}`)}
                </Text>
              </View>
            </View>

            <View style={[styles.detailSection, { borderTopColor: colors.border }]}>
              <DetailRow
                label={t('payments.provider')}
                value={getProviderLabel(p.provider)}
                colors={colors}
              />
              <DetailRow
                label={t('payments.method')}
                value={getMethodLabel(p.paymentMethodType)}
                colors={colors}
              />
              <DetailRow
                label={t('payments.reference')}
                value={p.providerTransactionId || p.id}
                colors={colors}
              />
              <DetailRow
                label={t('payments.date')}
                value={formatDateTime(p.createdAt)}
                colors={colors}
              />
              {p.saleId && (
                <DetailRow
                  label="Sale ID"
                  value={p.saleId}
                  colors={colors}
                />
              )}
            </View>

            {p.status === 'completed' && (
              <TouchableOpacity
                style={[styles.refundBtn, { borderColor: '#DC2626' + '40' }]}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color="#DC2626" />
                <Text style={styles.refundBtnText}>{t('payments.requestRefund')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={filterMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterMenuOpen(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setFilterMenuOpen(false)}>
        <View style={styles.modalOverlayBg} />
      </Pressable>
      <View
        style={[
          styles.filterSheet,
          { backgroundColor: colors.surface },
          Platform.OS === 'web'
            ? { boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 24,
                elevation: 16,
              },
        ]}
      >
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>{t('common.filter')}</Text>
          <TouchableOpacity onPress={() => setFilterMenuOpen(false)} hitSlop={12}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterSectionTitle, { color: colors.text }]}>
            {t('payments.filterByStatus')}
          </Text>
          <View style={styles.filterChips}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: statusFilter === opt.key ? colors.primary : colors.surfaceHover,
                    borderColor: statusFilter === opt.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setStatusFilter(opt.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: statusFilter === opt.key ? '#FFF' : colors.text },
                  ]}
                >
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={[styles.filterSectionTitle, { color: colors.text }]}>
            {t('payments.filterByProvider')}
          </Text>
          <View style={styles.filterChips}>
            {PROVIDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: providerFilter === opt.key ? colors.primary : colors.surfaceHover,
                    borderColor: providerFilter === opt.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setProviderFilter(opt.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: providerFilter === opt.key ? '#FFF' : colors.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.applyFilterBtn, { backgroundColor: colors.primary }]}
          onPress={() => setFilterMenuOpen(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.applyFilterBtnText}>{t('common.confirm')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('payments.title')}
        action={
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.surfaceHover }]}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStatCards()}
        {renderFilters()}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredPayments.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.paymentList}>
            {filteredPayments.map(renderPaymentRow)}
          </View>
        )}
      </ScrollView>

      {renderDetailModal()}
      {renderFilterModal()}
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={detailStyles.row}>
      <Text style={[detailStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[detailStyles.value, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  value: {
    fontSize: 14,
    fontWeight: '600' as const,
    maxWidth: '60%' as never,
    textAlign: 'right' as const,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 16,
  },
  statsRowMobile: {
    flexDirection: 'row' as const,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  filtersRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 6,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  paymentList: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  paymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paymentInfo: {
    flex: 1,
    gap: 4,
  },
  paymentTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  paymentBottomRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  paymentMeta: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  paymentDate: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center' as const,
    maxWidth: 260,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center' as const,
  },
  refreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
  },
  modalOverlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  detailSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%' as never,
  },
  filterSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  detailHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  detailContent: {
    padding: 20,
  },
  detailAmountSection: {
    alignItems: 'center' as const,
    paddingBottom: 20,
    gap: 8,
  },
  detailAmountLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  detailAmount: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  statusBadgeLarge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTextLarge: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  detailSection: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  refundBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  refundBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  filterChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  applyFilterBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  applyFilterBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
