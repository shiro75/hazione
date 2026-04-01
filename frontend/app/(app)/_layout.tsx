import React, { useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Modal, Pressable, TouchableOpacity, Text } from 'react-native';
import { Slot } from 'expo-router';
import { X } from 'lucide-react-native';
import Sidebar from '@/components/Sidebar';
import BottomTabBar from '@/components/BottomTabBar';
import OfflineBanner from '@/components/OfflineBanner';
import OfflineSyncBridge from '@/components/OfflineSyncBridge';
import TrialBanner from '@/components/TrialBanner';
import UpgradeModal from '@/components/UpgradeModal';
import { useTheme } from '@/contexts/ThemeContext';
import { MobileMenuProvider, useMobileMenu } from '@/contexts/MobileMenuContext';

const TABLET_BREAKPOINT = 768;

function AppLayoutInner() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= TABLET_BREAKPOINT;
  const [collapsed, setCollapsed] = useState(false);
  const { mobileMenuOpen, closeMenu } = useMobileMenu();

  const handleToggle = useCallback(() => setCollapsed((p) => !p), []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {isDesktop && (
        <Sidebar
          collapsed={collapsed}
          onToggle={handleToggle}
          mobileOpen={false}
          onMobileClose={() => {}}
        />
      )}
      <View style={styles.content}>
        <TrialBanner />
        <OfflineBanner />
        <OfflineSyncBridge />
        <Slot />
        <UpgradeModal />
      </View>
      {!isDesktop && <BottomTabBar />}

      {!isDesktop && (
        <Modal
          visible={mobileMenuOpen}
          transparent
          animationType="slide"
          onRequestClose={closeMenu}
        >
          <Pressable style={styles.overlay} onPress={closeMenu}>
            <View style={styles.overlayBg} />
          </Pressable>
          <View style={[styles.mobileSheet, { backgroundColor: colors.sidebar }]}>
            <View style={[styles.mobileSheetHeader, { borderBottomColor: colors.sidebarBorder }]}>
              <Text style={[styles.mobileSheetTitle, { color: colors.sidebarText }]}>Navigation</Text>
              <TouchableOpacity onPress={closeMenu} hitSlop={12}>
                <X size={20} color={colors.sidebarText} />
              </TouchableOpacity>
            </View>
            <Sidebar
              collapsed={false}
              onToggle={() => {}}
              mobileOpen={true}
              onMobileClose={closeMenu}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function AppLayout() {
  return (
    <MobileMenuProvider>
      <AppLayoutInner />
    </MobileMenuProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row' as const,
  },
  content: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  mobileSheet: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
  },
  mobileSheetHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  mobileSheetTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
});
