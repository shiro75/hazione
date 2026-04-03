/**
 * @fileoverview Global page header with title, collapsible mode, search,
 * notifications, and optional action button. Used on every main screen.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Search, Bell, Menu, ChevronUp, ChevronDown, LogOut } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlobalSearch from '@/components/GlobalSearch';
import NotificationCenter from '@/components/NotificationCenter';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useI18n, type AppLocale } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';

const LANGUAGE_FLAGS: { value: AppLocale; flag: string; label: string }[] = [
  { value: 'fr', flag: '🇫🇷', label: 'FR' },
  { value: 'en', flag: '🇬🇧', label: 'EN' },
  { value: 'km', flag: '🇰🇲', label: 'KM' },
];

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  rightContent?: React.ReactNode;
  onMenuPress?: () => void;
}

function LanguageSwitcher() {
  const { colors } = useTheme();
  const { locale, setLocale } = useI18n();

  return (
    <View style={styles.langRow}>
      {LANGUAGE_FLAGS.map((lang) => {
        const isActive = locale === lang.value;
        return (
          <TouchableOpacity
            key={lang.value}
            style={[
              styles.langFlag,
              isActive && styles.langFlagActive,
              isActive && { borderColor: colors.primary },
            ]}
            onPress={() => setLocale(lang.value)}
            activeOpacity={0.7}
            hitSlop={4}
          >
            <Text style={[styles.langFlagEmoji, !isActive && styles.langFlagInactive]}>
              {lang.flag}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default React.memo(function PageHeader({ title, action, rightContent }: PageHeaderProps) {
  const { colors } = useTheme();
  const { notifications } = useData();
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 768;
  const [searchVisible, setSearchVisible] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { openMenu } = useMobileMenu();

  if (collapsed) {
    return (
      <View
        style={[
          styles.headerCollapsed,
          {
            backgroundColor: colors.header,
            borderBottomColor: colors.headerBorder,
            paddingTop: isMobile ? insets.top + 4 : 4,
          },
        ]}
      >
        {isMobile && (
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={openMenu}
            hitSlop={4}
            testID="hamburger-menu"
          >
            <Menu size={16} color={colors.headerText} />
          </TouchableOpacity>
        )}
        <Text style={[styles.collapsedTitle, { color: colors.headerText }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>
          <LanguageSwitcher />
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={() => setSearchVisible(true)}
            hitSlop={4}
          >
            <Search size={15} color={colors.headerIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={() => setNotifVisible(true)}
            hitSlop={4}
          >
            <Bell size={15} color={colors.headerIcon} />
            {notifications.length > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.notifBadgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          {action != null ? <>{action}</> : null}
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={() => void signOut()}
            hitSlop={4}
            testID="header-logout"
          >
            <LogOut size={15} color={colors.headerIcon} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={() => setCollapsed(false)}
            hitSlop={4}
          >
            <ChevronDown size={15} color={colors.headerIcon} />
          </TouchableOpacity>
        </View>
        <GlobalSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />
        <NotificationCenter visible={notifVisible} onClose={() => setNotifVisible(false)} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.header,
          borderBottomColor: colors.headerBorder,
          paddingTop: isMobile ? insets.top + 6 : 10,
        },
        isMobile && styles.headerMobile,
      ]}
    >
      <View style={styles.left}>
        <View style={styles.titleRow}>
          {isMobile && (
            <TouchableOpacity
              style={[styles.hamburgerBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
              onPress={openMenu}
              hitSlop={4}
              testID="hamburger-menu"
            >
              <Menu size={18} color={colors.headerText} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: colors.headerText }, isMobile && styles.titleMobile]} numberOfLines={1}>
            {title}
          </Text>
          {rightContent ?? null}
        </View>
      </View>
      <View style={styles.right}>
        <LanguageSwitcher />
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => setSearchVisible(true)}
          hitSlop={4}
        >
          <Search size={16} color={colors.headerIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => setNotifVisible(true)}
          hitSlop={4}
        >
          <Bell size={16} color={colors.headerIcon} />
          {notifications.length > 0 && (
            <View style={[styles.notifBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.notifBadgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        {action != null ? <>{action}</> : null}
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => void signOut()}
          hitSlop={4}
          testID="header-logout"
        >
          <LogOut size={16} color={colors.headerIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          onPress={() => setCollapsed(true)}
          hitSlop={4}
        >
          <ChevronUp size={16} color={colors.headerIcon} />
        </TouchableOpacity>
      </View>
      <GlobalSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />
      <NotificationCenter visible={notifVisible} onClose={() => setNotifVisible(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerMobile: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  headerCollapsed: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  left: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  hamburgerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  titleMobile: {
    fontSize: 17,
  },
  collapsedTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  right: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginLeft: 6,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  notifBadge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700' as const,
  },
  langRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    marginRight: 2,
  },
  langFlag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langFlagActive: {
    borderWidth: 2,
  },
  langFlagEmoji: {
    fontSize: 18,
  },
  langFlagInactive: {
    opacity: 0.4,
  },
});
