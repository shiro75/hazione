/**
 * @fileoverview Notification center slide-in modal.
 * Shows alerts for low stock, late invoices, pending supplier orders, etc.
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { X, Package, FileText, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ visible, onClose }: NotificationCenterProps) {
  const { colors } = useTheme();
  const { notifications } = useData();
  const router = useRouter();

  const handleNotifPress = useCallback((notif: { id: string; type: string; title: string; message: string }) => {
    onClose();
    setTimeout(() => {
      const entityId = notif.id.split('-').slice(1).join('-');
      if (notif.type === 'stock') {
        console.log('Navigation vers:', `/stock?tab=inventaire`);
        router.push('/stock?tab=inventaire' as any);
      } else if (notif.type === 'invoice') {
        router.push(`/ventes?tab=relances&selectedId=${entityId}` as any);
      } else if (notif.type === 'late_invoice') {
        router.push('/ventes?tab=relances' as any);
      } else if (notif.type === 'credit_note') {
        router.push('/ventes?tab=avoirs' as any);
      } else if (notif.type === 'payment') {
        router.push('/cashflow' as any);
      } else if (notif.type === 'quote') {
        router.push(`/ventes?tab=devis&selectedId=${entityId}` as any);
      } else if (notif.type === 'order') {
        router.push('/ventes?tab=commandes' as any);
      } else if (notif.type === 'delivery') {
        router.push('/ventes?tab=livraisons' as any);
      } else if (notif.type === 'supplier') {
        router.push('/achats?tab=fournisseurs' as any);
      } else if (notif.type === 'purchase_order') {
        router.push('/achats?tab=commandes' as any);
      } else if (notif.type === 'supplier_invoice') {
        router.push('/achats?tab=factures' as any);
      } else {
        router.push('/ventes' as any);
      }
    }, 200);
  }, [onClose, router]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'stock': return <Package size={16} color={colors.warning} />;
      case 'invoice': return <FileText size={16} color={colors.danger} />;
      default: return <Bell size={16} color={colors.primary} />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'stock': return colors.warningLight;
      case 'invoice': return colors.dangerLight;
      default: return colors.primaryLight;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Bell size={18} color={colors.text} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{notifications.length}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Bell size={32} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucune notification</Text>
              </View>
            ) : (
              notifications.map(notif => (
                <TouchableOpacity
                  key={notif.id}
                  style={[styles.notifRow, { borderBottomColor: colors.borderLight }]}
                  onPress={() => handleNotifPress(notif)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.notifIcon, { backgroundColor: getIconBg(notif.type) }]}>
                    {getIcon(notif.type)}
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>{notif.title}</Text>
                    <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{notif.message}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 16 },
  modal: { width: 360, borderRadius: 16, maxHeight: '60%', overflow: 'hidden' },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600' as const },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  list: { maxHeight: 400 },
  emptyState: { alignItems: 'center' as const, paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14 },
  notifRow: { flexDirection: 'row' as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12, alignItems: 'center' as const },
  notifIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 13, fontWeight: '600' as const },
  notifMessage: { fontSize: 12 },
});
