import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Key, Copy, Trash2, Plus, ExternalLink, BarChart3, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import ConfirmModal from '@/components/ConfirmModal';
import type { ApiKey } from '@/types';

interface ApiKeysManagerProps {
  apiKeys: ApiKey[];
  onGenerate: () => void;
  onRevoke: (id: string) => void;
}

export default React.memo(function ApiKeysManager({ apiKeys, onGenerate, onRevoke }: ApiKeysManagerProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeKeys = apiKeys.filter(k => k.isActive);

  const handleCopy = useCallback(async (key: string, id: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(key);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
    }
  }, []);

  const handleRevoke = useCallback(() => {
    if (revokeId) {
      onRevoke(revokeId);
      setRevokeId(null);
    }
  }, [revokeId, onRevoke]);

  return (
    <View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <Key size={20} color={colors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('api.keySection')}</Text>
          </View>
          {activeKeys.length === 0 ? (
            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: colors.primary }]}
              onPress={onGenerate}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#FFF" />
              <Text style={styles.generateBtnText}>{t('api.generate')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {activeKeys.length === 0 ? (
          <View style={styles.emptyState}>
            <Shield size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('api.noKey')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>{t('api.noKeyHint')}</Text>
          </View>
        ) : (
          <View style={styles.keyList}>
            {activeKeys.map(apiKey => (
              <View key={apiKey.id} style={[styles.keyRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.keyInfo}>
                  <Text style={[styles.keyName, { color: colors.text }]}>{apiKey.name}</Text>
                  <Text style={[styles.keyValue, { color: colors.textSecondary }]} numberOfLines={1}>
                    {apiKey.key.slice(0, 12)}...{apiKey.key.slice(-6)}
                  </Text>
                  <View style={styles.keyMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5' }]}>
                      <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={[styles.statusText, { color: '#16A34A' }]}>{t('api.active')}</Text>
                    </View>
                    <Text style={[styles.keyDate, { color: colors.textTertiary }]}>
                      {new Date(apiKey.createdAt).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
                <View style={styles.keyActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: copiedId === apiKey.id ? '#ECFDF5' : colors.surfaceHover }]}
                    onPress={() => handleCopy(apiKey.key, apiKey.id)}
                    hitSlop={8}
                  >
                    <Copy size={14} color={copiedId === apiKey.id ? '#16A34A' : colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.dangerLight }]}
                    onPress={() => setRevokeId(apiKey.id)}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {copiedId ? (
          <View style={[styles.copiedToast, { backgroundColor: '#ECFDF5', borderColor: '#86EFAC' }]}>
            <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600' as const }}>{t('api.copied')}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: '#7C3AED15' }]}>
            <BarChart3 size={20} color="#7C3AED" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('api.callsThisMonth')}</Text>
          </View>
        </View>
        <Text style={[styles.callsValue, { color: colors.text }]}>
          {activeKeys.reduce((s, k) => s + k.callsThisMonth, 0)}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: '#059669' + '15' }]}>
            <ExternalLink size={20} color="#059669" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('api.documentation')}</Text>
          </View>
        </View>
        <View style={[styles.docPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.docText, { color: colors.textTertiary }]}>{t('api.docComingSoon')}</Text>
        </View>
      </View>

      <ConfirmModal
        visible={!!revokeId}
        title={t('api.revokeConfirm')}
        message={t('api.revokeMsg')}
        onConfirm={handleRevoke}
        onClose={() => setRevokeId(null)}
        destructive
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' as const },
  generateBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  generateBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
  emptyState: { alignItems: 'center' as const, paddingVertical: 20, gap: 6 },
  emptyTitle: { fontSize: 13, fontWeight: '600' as const },
  emptyHint: { fontSize: 12, textAlign: 'center' as const },
  keyList: { gap: 8 },
  keyRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    borderRadius: 10, borderWidth: 1, padding: 12, gap: 10,
  },
  keyInfo: { flex: 1, gap: 3 },
  keyName: { fontSize: 13, fontWeight: '600' as const },
  keyValue: { fontSize: 11, fontFamily: 'monospace' as const },
  keyMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '600' as const },
  keyDate: { fontSize: 10 },
  keyActions: { flexDirection: 'row' as const, gap: 6 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  copiedToast: {
    marginTop: 8, paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, alignSelf: 'center' as const,
  },
  callsValue: { fontSize: 28, fontWeight: '800' as const, textAlign: 'center' as const, paddingVertical: 8 },
  docPlaceholder: { borderRadius: 8, borderWidth: 1, padding: 20, alignItems: 'center' as const },
  docText: { fontSize: 13, fontStyle: 'italic' as const },
});
