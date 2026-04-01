/**
 * @fileoverview Real-time payment status modal for CinetPay digital payments.
 * Shows a spinner while pending, success check on completed, error on failed.
 * Subscribes to Supabase Realtime for live status updates.
 * Provides retry and cancel actions.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Check, X, RefreshCw, ExternalLink, AlertTriangle, Wifi } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import {
  subscribeToPaymentStatus,
  checkPaymentStatus,
  openPaymentUrl,
} from '@/services/paymentService';
import type { CinetPayTransactionStatus } from '@/types';

interface PaymentStatusModalProps {
  visible: boolean;
  transactionId: string | null;
  paymentUrl: string | null;
  amount: number;
  currency: string;
  onCompleted: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export default function PaymentStatusModal({
  visible,
  transactionId,
  paymentUrl,
  amount,
  currency,
  onCompleted,
  onCancel,
  onRetry,
}: PaymentStatusModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [status, setStatus] = useState<CinetPayTransactionStatus>('pending');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible || !transactionId) {
      setStatus('pending');
      return;
    }

    subscriptionRef.current = subscribeToPaymentStatus(transactionId, (newStatus) => {
      setStatus(newStatus);
    });

    pollIntervalRef.current = setInterval(async () => {
      const txn = await checkPaymentStatus(transactionId);
      if (txn && txn.status !== 'pending') {
        setStatus(txn.status);
      }
    }, 5000);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [visible, transactionId]);

  useEffect(() => {
    if (status === 'pending') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  useEffect(() => {
    if (status === 'completed') {
      Animated.spring(checkAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      const timer = setTimeout(() => {
        onCompleted();
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      checkAnim.setValue(0);
    }
  }, [status, checkAnim, onCompleted]);

  const handleOpenPaymentLink = useCallback(() => {
    if (paymentUrl) {
      openPaymentUrl(paymentUrl);
    }
  }, [paymentUrl]);

  const formatAmount = (val: number, cur: string): string => {
    return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${cur}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={() => {}}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {status === 'pending' && (
            <>
              <Animated.View style={[styles.iconCircle, styles.pendingCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Wifi size={36} color="#F59E0B" />
              </Animated.View>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('payment.waitingTitle')}
              </Text>
              <Text style={[styles.amount, { color: colors.primary }]}>
                {formatAmount(amount, currency)}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('payment.waitingSubtitle')}
              </Text>

              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />

              {paymentUrl ? (
                <TouchableOpacity
                  style={[styles.linkBtn, { backgroundColor: '#0EA5E9', marginTop: 20 }]}
                  onPress={handleOpenPaymentLink}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={16} color="#FFF" />
                  <Text style={styles.linkBtnText}>{t('payment.openPaymentLink')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <X size={14} color={colors.textSecondary} />
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {t('payment.cancel')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'completed' && (
            <>
              <Animated.View
                style={[
                  styles.iconCircle,
                  styles.successCircle,
                  { transform: [{ scale: checkAnim }] },
                ]}
              >
                <Check size={40} color="#FFF" />
              </Animated.View>
              <Text style={[styles.title, { color: '#059669' }]}>
                {t('payment.successTitle')}
              </Text>
              <Text style={[styles.amount, { color: '#059669' }]}>
                {formatAmount(amount, currency)}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('payment.successSubtitle')}
              </Text>
            </>
          )}

          {(status === 'failed' || status === 'cancelled') && (
            <>
              <View style={[styles.iconCircle, styles.failedCircle]}>
                <AlertTriangle size={36} color="#FFF" />
              </View>
              <Text style={[styles.title, { color: '#DC2626' }]}>
                {status === 'cancelled' ? t('payment.cancelledTitle') : t('payment.failedTitle')}
              </Text>
              <Text style={[styles.amount, { color: colors.textSecondary }]}>
                {formatAmount(amount, currency)}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {status === 'cancelled' ? t('payment.cancelledSubtitle') : t('payment.failedSubtitle')}
              </Text>

              <View style={styles.failedActions}>
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={onRetry}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={16} color="#FFF" />
                  <Text style={styles.retryBtnText}>{t('payment.retry')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <X size={14} color={colors.textSecondary} />
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                    {t('payment.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pendingCircle: {
    backgroundColor: '#FEF3C7',
  },
  successCircle: {
    backgroundColor: '#10B981',
  },
  failedCircle: {
    backgroundColor: '#EF4444',
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  linkBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  linkBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cancelBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  failedActions: {
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
