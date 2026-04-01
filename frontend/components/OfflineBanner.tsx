/**
 * @fileoverview Offline status banner displayed at the top of the app.
 * Shows connection status, sync progress, and pending sales count.
 * Animated entrance/exit with color-coded states (offline, syncing, synced).
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { WifiOff, RefreshCw, CloudOff, CheckCircle, AlertTriangle, X } from 'lucide-react-native';
import { useOffline } from '@/contexts/OfflineContext';
import { useI18n } from '@/contexts/I18nContext';

export default function OfflineBanner() {
  const {
    isOnline, pendingSalesCount, isSyncing, syncProgress,
    syncPendingSales, lastSyncResult, dismissSyncResult,
  } = useOffline();
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  const showBanner = !isOnline || pendingSalesCount > 0 || isSyncing;
  const showResult = !!lastSyncResult;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showBanner ? 0 : -80,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showBanner, slideAnim]);

  useEffect(() => {
    if (isSyncing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing, pulseAnim]);

  useEffect(() => {
    if (showResult) {
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(resultAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => dismissSyncResult());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultAnim, dismissSyncResult]);

  const handleDismissResult = useCallback(() => {
    Animated.timing(resultAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => dismissSyncResult());
  }, [resultAnim, dismissSyncResult]);

  const bgColor = !isOnline ? '#FEF3C7' : isSyncing ? '#EFF6FF' : '#FFF7ED';
  const borderColor = !isOnline ? '#FCD34D' : isSyncing ? '#BFDBFE' : '#FED7AA';
  const textColor = !isOnline ? '#92400E' : isSyncing ? '#2563EB' : '#D97706';
  const iconColor = !isOnline ? '#D97706' : isSyncing ? '#3B82F6' : '#F59E0B';

  const progressText = syncProgress
    ? ` (${syncProgress.current}/${syncProgress.total})`
    : '';

  const bannerTitle = !isOnline
    ? t('offline.offlineMode')
    : isSyncing
    ? t('offline.syncInProgress', { progress: progressText })
    : t('offline.pendingSales', { count: pendingSalesCount });

  const bannerSubtitle = !isOnline
    ? t('offline.dataOutdated')
    : isSyncing
    ? t('offline.sendingToServer')
    : t('offline.willSyncOnReconnect');

  return (
    <>
      {showBanner && (
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: bgColor, borderBottomColor: borderColor, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconWrap}>
              <Animated.View style={{ opacity: isSyncing ? pulseAnim : 1 }}>
                {!isOnline ? (
                  <WifiOff size={18} color={iconColor} />
                ) : isSyncing ? (
                  <RefreshCw size={18} color={iconColor} />
                ) : (
                  <CloudOff size={18} color={iconColor} />
                )}
              </Animated.View>
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.title, { color: textColor }]}>
                {bannerTitle}
              </Text>
              <Text style={[styles.subtitle, { color: textColor }]}>
                {bannerSubtitle}
              </Text>
            </View>
            {isOnline && pendingSalesCount > 0 && !isSyncing && (
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: '#D97706' }]}
                onPress={() => void syncPendingSales()}
                activeOpacity={0.7}
              >
                <RefreshCw size={12} color="#FFF" />
                <Text style={styles.syncBtnText}>Sync</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {showResult && (
        <Animated.View
          style={[
            styles.resultContainer,
            {
              backgroundColor: lastSyncResult?.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              borderBottomColor: lastSyncResult?.type === 'success' ? '#86EFAC' : '#FECACA',
              opacity: resultAnim,
              transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
            },
          ]}
        >
          <View style={styles.content}>
            {lastSyncResult?.type === 'success' ? (
              <CheckCircle size={16} color="#16A34A" />
            ) : (
              <AlertTriangle size={16} color="#DC2626" />
            )}
            <Text
              style={[
                styles.resultText,
                { color: lastSyncResult?.type === 'success' ? '#166534' : '#991B1B' },
              ]}
            >
              {lastSyncResult?.type === 'success' ? '' : ''}
              {lastSyncResult?.message}
            </Text>
            <TouchableOpacity onPress={handleDismissResult} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={lastSyncResult?.type === 'success' ? '#166534' : '#991B1B'} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400' as const,
    marginTop: 1,
    opacity: 0.8,
  },
  syncBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  resultContainer: {
    borderBottomWidth: 1,
    zIndex: 99,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
