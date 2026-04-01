/**
 * @fileoverview Barre d'onglets horizontale avec icônes et indicateur sous-ligné.
 * Style unifié basé sur le module Caisse (POS) : indicateur bottom-border bleu, pas de fond rempli.
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface TabConfig<T extends string> {
  key: T;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  badge?: number;
  count?: number;
}

interface SectionTabBarProps<T extends string> {
  tabs: TabConfig<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

export default function SectionTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: SectionTabBarProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bar}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </Text>
              {(tab.badge ?? 0) > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              )}
              {tab.count !== undefined && (
                <View style={[styles.countBadge, { backgroundColor: active ? colors.primary + '20' : colors.surfaceHover ?? '#F0F0F5' }]}>
                  <Text style={[styles.countText, { color: active ? colors.primary : colors.textTertiary }]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    paddingHorizontal: 24,
  },
  bar: {
    flexDirection: 'row' as const,
    gap: 0,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
