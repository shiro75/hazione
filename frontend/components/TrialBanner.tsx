import React, { useCallback } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { PLANS } from '@/config/plans';

export default function TrialBanner() {
  const { isTrial, trialDaysRemaining, plan, isExpired } = useSubscription();
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push('/(app)/admin');
  }, [router]);

  if (!isTrial && !isExpired) return null;

  const planConfig = PLANS[plan];
  const isUrgent = trialDaysRemaining <= 3;

  const bgColor = isExpired
    ? colors.danger
    : isUrgent
      ? '#F59E0B'
      : colors.primary;

  const label = isExpired
    ? t('subscription.trialExpired')
    : t('subscription.trialBanner', { plan: planConfig.nameFr, days: String(trialDaysRemaining) });

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: bgColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
      testID="trial-banner"
    >
      <Crown size={14} color="#FFF" />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
      <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'center' as const,
  },
});
