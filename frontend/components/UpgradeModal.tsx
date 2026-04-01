import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Crown, X, ArrowRight, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { PLANS } from '@/config/plans';

export default function UpgradeModal() {
  const {
    showUpgradeRequired, setShowUpgradeRequired,
    requiredPlanForUpgrade, plan,
  } = useSubscription();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const handleClose = useCallback(() => {
    setShowUpgradeRequired(false);
  }, [setShowUpgradeRequired]);

  const handleUpgrade = useCallback(() => {
    setShowUpgradeRequired(false);
    router.push('/(app)/admin');
  }, [setShowUpgradeRequired, router]);

  if (!showUpgradeRequired || !requiredPlanForUpgrade) return null;

  const requiredPlan = PLANS[requiredPlanForUpgrade];
  const currentPlan = PLANS[plan];

  const planName = locale === 'fr' ? requiredPlan.nameFr : requiredPlan.nameEn;
  const currentPlanName = locale === 'fr' ? currentPlan.nameFr : currentPlan.nameEn;

  const includedFeatures = requiredPlan.features
    .filter((f) => f.included)
    .slice(0, 5);

  return (
    <Modal
      visible={showUpgradeRequired}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={styles.overlayBg} />
      </Pressable>
      <View style={styles.centeredContainer}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surfaceHover }]}
            onPress={handleClose}
            hitSlop={12}
          >
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.iconContainer, { backgroundColor: requiredPlan.iconBg }]}>
            <Crown size={28} color={requiredPlan.color} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {t('subscription.upgradeRequired')}
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('subscription.upgradeDescription', { plan: planName })}
          </Text>

          <View style={[styles.planCompare, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.planCompareRow}>
              <View style={[styles.planDot, { backgroundColor: currentPlan.color }]} />
              <Text style={[styles.planCompareLabel, { color: colors.textSecondary }]}>
                {t('subscription.currentPlan')}:
              </Text>
              <Text style={[styles.planCompareName, { color: colors.text }]}>
                {currentPlanName}
              </Text>
            </View>
            <ArrowRight size={14} color={colors.textTertiary} />
            <View style={styles.planCompareRow}>
              <View style={[styles.planDot, { backgroundColor: requiredPlan.color }]} />
              <Text style={[styles.planCompareLabel, { color: colors.textSecondary }]}>
                {t('subscription.requiredPlan')}:
              </Text>
              <Text style={[styles.planCompareName, { color: requiredPlan.color, fontWeight: '700' as const }]}>
                {planName}
              </Text>
            </View>
          </View>

          <View style={styles.featuresList}>
            {includedFeatures.map((f) => (
              <View key={f.key} style={styles.featureRow}>
                <Check size={14} color={requiredPlan.color} />
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {locale === 'fr' ? f.labelFr : f.labelEn}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              {t('subscription.startingFrom')}
            </Text>
            <Text style={[styles.price, { color: requiredPlan.color }]}>
              {requiredPlan.annualPricePerMonth}€
            </Text>
            <Text style={[styles.pricePeriod, { color: colors.textTertiary }]}>
              /{t('subscription.month')}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.upgradeBtn, { backgroundColor: requiredPlan.color }]}
            onPress={handleUpgrade}
            activeOpacity={0.8}
            testID="upgrade-modal-btn"
          >
            <Crown size={16} color="#FFF" />
            <Text style={styles.upgradeBtnText}>
              {t('subscription.upgradeTo', { plan: planName })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.laterBtn}>
            <Text style={[styles.laterText, { color: colors.textSecondary }]}>
              {t('subscription.later')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
    pointerEvents: 'box-none' as const,
  },
  modal: {
    width: '100%' as never,
    maxWidth: 400,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  planCompare: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  planCompareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planCompareLabel: {
    fontSize: 12,
  },
  planCompareName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  featuresList: {
    gap: 8,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  featureText: {
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'center' as const,
    gap: 4,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 13,
  },
  price: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  pricePeriod: {
    fontSize: 14,
  },
  upgradeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  laterBtn: {
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  laterText: {
    fontSize: 13,
  },
});
