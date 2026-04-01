/**
 * @fileoverview Desktop sidebar navigation component.
 * Displays nav items filtered by enabled modules, with collapsible mode.
 * Routes use /boutique for the admin shop page (not /shop, which is the public storefront).
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Building2,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Store,
  CreditCard,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import type { ModuleKey } from '@/types';

interface NavItem {
  labelKey: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  route: string;
  moduleKey: ModuleKey;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, route: '/', moduleKey: 'dashboard' },
  { labelKey: 'nav.sales', icon: ShoppingCart, route: '/ventes', moduleKey: 'ventes' },
  { labelKey: 'nav.purchases', icon: Truck, route: '/achats', moduleKey: 'achats' },
  { labelKey: 'nav.products', icon: Package, route: '/stock', moduleKey: 'stock' },
  { labelKey: 'nav.pos', icon: ShoppingBag, route: '/sales', moduleKey: 'sales' },
  { labelKey: 'nav.shop', icon: Store, route: '/boutique', moduleKey: 'shop' },
  { labelKey: 'nav.payments', icon: CreditCard, route: '/payments', moduleKey: 'payments' },
  { labelKey: 'nav.settings', icon: Settings, route: '/settings', moduleKey: 'settings' },
  { labelKey: 'nav.admin', icon: Shield, route: '/admin', moduleKey: 'admin' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default React.memo(function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { colors, mode, toggleTheme } = useTheme();
  const { isModuleEnabled } = useData();
  const { canAccess } = useRole();
  const { hasElevatedAccess } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const visibleNavItems = useMemo(() => {
    const items = NAV_ITEMS.filter((item) => isModuleEnabled(item.moduleKey) && canAccess(item.moduleKey));
    if (hasElevatedAccess) {
      items.push({ labelKey: 'nav.console', icon: Shield, route: '/super-admin', moduleKey: 'admin' });
    }
    return items;
  }, [isModuleEnabled, canAccess, hasElevatedAccess]);

  const getLabel = useCallback((labelKey: string) => t(labelKey), [t]);

  const handleNav = useCallback((route: string) => {
    router.push(route as never);
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [router, mobileOpen, onMobileClose]);

  const isActive = useCallback((route: string) => {
    if (route === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(route);
  }, [pathname]);

  const sidebarWidth = collapsed ? 72 : 260;

  const containerStyle = useMemo(() => [
    styles.container,
    {
      width: sidebarWidth,
      backgroundColor: colors.sidebar,
      borderRightColor: colors.sidebarBorder,
    },
  ], [sidebarWidth, colors]);

  return (
    <View style={containerStyle}>
      <View style={[styles.header, { borderBottomColor: colors.sidebarBorder }]}>
        {!collapsed ? (
          <TouchableOpacity style={styles.logoRow} onPress={() => handleNav('/')}>
            <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
              <Building2 size={18} color="#FFFFFF" />
            </View>
            <View style={styles.logoText}>
              <Text style={[styles.logoTitle, { color: colors.sidebarText }]}>HaziOne</Text>
              <Text style={[styles.logoSubtitle, { color: colors.sidebarTextSecondary }]}>{t('nav.simplifyBusiness')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.logoIconOnly} onPress={() => handleNav('/')}>
            <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
              <Building2 size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {visibleNavItems.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                active && { backgroundColor: colors.sidebarActive },
                !active && Platform.OS === 'web' && { cursor: 'pointer' as never },
              ]}
              onPress={() => handleNav(item.route)}
              activeOpacity={0.7}
            >
              <item.icon
                size={20}
                color={active ? '#FFFFFF' : colors.sidebarTextSecondary}
              />
              {!collapsed && (
                <Text
                  style={[
                    styles.navLabel,
                    { color: active ? '#FFFFFF' : colors.sidebarText },
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {getLabel(item.labelKey)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.sidebarBorder, paddingBottom: 8 }]}>
        <TouchableOpacity
          style={[styles.footerBtn, collapsed && styles.footerBtnCollapsed]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          {mode === 'light' ? (
            <Moon size={18} color={colors.sidebarTextSecondary} />
          ) : (
            <Sun size={18} color={colors.sidebarTextSecondary} />
          )}
          {!collapsed && (
            <Text style={[styles.footerLabel, { color: colors.sidebarTextSecondary }]}>
              {mode === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerBtn, collapsed && styles.footerBtnCollapsed]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          {collapsed ? (
            <ChevronRight size={18} color={colors.sidebarTextSecondary} />
          ) : (
            <ChevronLeft size={18} color={colors.sidebarTextSecondary} />
          )}
          {!collapsed && (
            <Text style={[styles.footerLabel, { color: colors.sidebarTextSecondary }]}>
              {t('nav.collapse')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: '100%' as const,
    borderRightWidth: 1,
    zIndex: 99,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  logoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  logoIconOnly: {
    alignItems: 'center' as const,
    width: '100%' as const,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoText: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  logoSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  nav: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
    gap: 12,
  },
  navItemCollapsed: {
    justifyContent: 'center' as const,
    paddingHorizontal: 0,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  navLabelActive: {
    fontWeight: '600' as const,
  },
  footer: {
    padding: 8,
    borderTopWidth: 1,
    gap: 2,
  },
  footerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  footerBtnCollapsed: {
    justifyContent: 'center' as const,
    paddingHorizontal: 0,
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
