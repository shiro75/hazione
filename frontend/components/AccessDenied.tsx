/**
 * @fileoverview Access denied screen shown when a user's role does not permit
 * access to a given page. Displays a shield icon, message, and a back button.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldX, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useRole } from '@/contexts/RoleContext';
import { useI18n } from '@/contexts/I18nContext';

export default function AccessDenied() {
  const { colors } = useTheme();
  const { currentUserRole } = useRole();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
          <ShieldX size={40} color={colors.danger} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('access.denied')}
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('access.deniedDesc', { role: t(`format.role.${currentUserRole}`) })}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {t('access.deniedHint')}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color="#FFF" />
          <Text style={styles.backBtnText}>{t('access.backToDashboard')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center' as const,
    maxWidth: 420,
    width: '100%' as const,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  description: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center' as const,
    lineHeight: 18,
    marginBottom: 24,
  },
  backBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
