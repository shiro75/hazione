/**
 * @fileoverview Toast notification overlay container.
 * Renders success/error/info toast messages in the top-right corner.
 * Toasts are managed by the DataContext (toasts, dismissToast).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';

export default function ToastContainer() {
  const { toasts, dismissToast } = useData();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => {
        const iconColor = toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#DC2626' : '#2563EB';
        const bgColor = toast.type === 'success' ? '#ECFDF5' : toast.type === 'error' ? '#FEF2F2' : '#EFF6FF';
        const borderColor = toast.type === 'success' ? '#A7F3D0' : toast.type === 'error' ? '#FECACA' : '#BFDBFE';
        const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : Info;

        return (
          <View key={toast.id} style={[styles.toast, { backgroundColor: bgColor, borderColor }]}>
            <Icon size={18} color={iconColor} />
            <Text style={[styles.toastText, { color: '#1F2937' }]}>{toast.message}</Text>
            <TouchableOpacity onPress={() => dismissToast(toast.id)} hitSlop={8}>
              <X size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    maxWidth: 400,
  },
  toast: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
