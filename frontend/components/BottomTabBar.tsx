/**
 * @fileoverview Mobile bottom tab bar with overflow "Plus" menu.
 * Primary tabs (dashboard, ventes, achats, stock, cashflow) are always visible.
 * Overflow tabs (caisse, boutique, settings, admin) appear in a modal sheet.
 * Routes use /boutique for the admin shop page (not /shop, which is the public storefront).
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Package,
  MoreHorizontal,
  ShoppingBag,
  Settings,
  Shield,
  Store,
  CreditCard,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import type { ModuleKey } from '@/types';

interface TabItem {
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  route: string;
  moduleKey: ModuleKey;
}

const PRIMARY_TABS: TabItem[] = [
  { labelKey: 'nav.home', icon: LayoutDashboard, route: '/', moduleKey: 'dashboard' },
  { labelKey: 'nav.sales', icon: ShoppingCart, route: '/ventes', moduleKey: 'ventes' },
  { labelKey: 'nav.purchases', icon: Truck, route: '/achats', moduleKey: 'achats' },
  { labelKey: 'nav.stock', icon: Package, route: '/stock', moduleKey: 'stock' },
  { labelKey: 'nav.cashier', icon: ShoppingBag, route: '/sales', moduleKey: 'sales' },
];

const OVERFLOW_TABS: TabItem[] = [
  { labelKey: 'nav.boutique', icon: Store, route: '/boutique', moduleKey: 'shop' },
  { labelKey: 'nav.payments', icon: CreditCard, route: '/payments', moduleKey: 'payments' },
  { labelKey: 'nav.settings', icon: Settings, route: '/settings', moduleKey: 'settings' },
  { labelKey: 'nav.admin', icon: Shield, route: '/admin', moduleKey: 'admin' },
];

export default React.memo(function BottomTabBar() {
  const { colors } = useTheme();
  const { isModuleEnabled } = useData();
  const { canAccess } = useRole();
  const { hasElevatedAccess } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const scaleAnims = useRef<Record<string, Animated.Value>>({}).current;

  const visiblePrimary = useMemo(
    () => PRIMARY_TABS.filter((t) => isModuleEnabled(t.moduleKey) && canAccess(t.moduleKey)),
    [isModuleEnabled, canAccess]
  );

  const visibleOverflow = useMemo(() => {
    const items = OVERFLOW_TABS.filter((t) => isModuleEnabled(t.moduleKey) && canAccess(t.moduleKey));
    if (hasElevatedAccess) {
      items.push({ labelKey: 'nav.console', icon: Shield, route: '/super-admin', moduleKey: 'admin' });
    }
    return items;
  }, [isModuleEnabled, canAccess, hasElevatedAccess]);

  const isActive = useCallback(
    (route: string) => {
      if (route === '/') return pathname === '/' || pathname === '';
      return pathname.startsWith(route);
    },
    [pathname]
  );

  const isInOverflow = useMemo(() => {
    return visibleOverflow.some((t) => isActive(t.route));
  }, [visibleOverflow, isActive]);

  const getScale = useCallback(
    (key: string) => {
      if (!scaleAnims[key]) {
        scaleAnims[key] = new Animated.Value(1);
      }
      return scaleAnims[key];
    },
    [scaleAnims]
  );

  const handlePress = useCallback(
    (route: string, key: string) => {
      const scale = getScale(key);
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
      router.push(route as never);
    },
    [router, getScale]
  );

  const handleOverflowNav = useCallback(
    (route: string) => {
      setMoreOpen(false);
      router.push(route as never);
    },
    [router]
  );

  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {visiblePrimary.map((tab) => {
          const active = isActive(tab.route);
          const scale = getScale(tab.route);
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tab}
              onPress={() => handlePress(tab.route, tab.route)}
              activeOpacity={0.7}
              testID={`tab-${tab.moduleKey}`}
            >
              <Animated.View
                style={[
                  styles.tabInner,
                  { transform: [{ scale }] },
                  active && { backgroundColor: 'rgba(255,255,255,0.2)' },
                ]}
              >
                <tab.icon size={20} color={active ? colors.tabBarActive : colors.tabBarText} />
              </Animated.View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.tabBarActive : colors.tabBarText },
                  active && styles.tabLabelActive,
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}

        {visibleOverflow.length > 0 && (
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setMoreOpen(true)}
            activeOpacity={0.7}
            testID="tab-more"
          >
            <Animated.View
              style={[
                styles.tabInner,
                isInOverflow && { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            >
              <MoreHorizontal
                size={20}
                color={isInOverflow ? colors.tabBarActive : colors.tabBarText}
              />
            </Animated.View>
            <Text
              style={[
                styles.tabLabel,
                { color: isInOverflow ? colors.tabBarActive : colors.tabBarText },
                isInOverflow && styles.tabLabelActive,
              ]}
            >
              {t('nav.more')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setMoreOpen(false)}>
          <View style={styles.overlayInner} />
        </Pressable>
        <View
          style={[
            styles.moreSheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: bottomPadding + 12,
            },
          ]}
        >
          <View style={[styles.moreHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.moreTitle, { color: colors.text }]}>{t('nav.navigation')}</Text>
            <TouchableOpacity onPress={() => setMoreOpen(false)} hitSlop={12}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.moreGrid}>
            {visibleOverflow.map((tab) => {
              const active = isActive(tab.route);
              return (
                <TouchableOpacity
                  key={tab.route}
                  style={[
                    styles.moreItem,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.background,
                      borderColor: active ? colors.primary + '40' : colors.border,
                    },
                  ]}
                  onPress={() => handleOverflowNav(tab.route)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.moreIcon,
                      { backgroundColor: active ? colors.primary + '20' : colors.surfaceHover },
                    ]}
                  >
                    <tab.icon size={22} color={active ? colors.primary : colors.textSecondary} />
                  </View>
                  <Text
                    style={[
                      styles.moreLabel,
                      { color: active ? colors.primary : colors.text },
                      active && styles.moreLabelActive,
                    ]}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
  },
  tabInner: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '600' as const,
  },
  overlay: {
    flex: 1,
  },
  overlayInner: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  moreSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 16,
        }),
  },
  moreHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  moreTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  moreGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    padding: 16,
    gap: 10,
  },
  moreItem: {
    width: '30%' as never,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    gap: 8,
  },
  moreIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  moreLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  moreLabelActive: {
    fontWeight: '600' as const,
  },
});
