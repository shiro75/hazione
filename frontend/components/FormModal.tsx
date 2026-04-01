/**
 * @fileoverview Reusable modal dialog with header, scrollable body, and footer actions.
 * Used for all create/edit forms (clients, products, invoices, quotes, etc.).
 * Adapts width to screen size (full-width on mobile, centered on desktop).
 *
 * NOTE: Subtitle display uses ternary (subtitle ? <Text> : null) to avoid
 * React Native Web "Unexpected text node" errors with empty strings.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface FormModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitColor?: string;
  showCancel?: boolean;
  cancelLabel?: string;
  width?: number;
  headerActions?: React.ReactNode;
}

export default React.memo(function FormModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  submitLabel = 'Enregistrer',
  submitDisabled = false,
  submitColor,
  showCancel = true,
  cancelLabel = 'Annuler',
  width: customWidth,
  headerActions,
}: FormModalProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const modalWidth = isMobile ? screenWidth - 24 : (customWidth ?? Math.min(520, screenWidth - 48));

  const handleOverlayPress = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <Pressable
          style={[styles.container, { backgroundColor: colors.card, width: modalWidth }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
            </View>
            <View style={styles.headerRight}>
              {headerActions}
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceHover }]} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {(onSubmit || showCancel) && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {showCancel && (
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
                  <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{cancelLabel}</Text>
                </TouchableOpacity>
              )}
              {onSubmit && (
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: submitColor || colors.primary, opacity: submitDisabled ? 0.5 : 1 }]}
                  onPress={onSubmit}
                  disabled={submitDisabled}
                >
                  <Text style={styles.submitText}>{submitLabel}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  container: {
    borderRadius: 16,
    maxHeight: '90%' as unknown as number,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, marginRight: 16 },
  headerRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, marginTop: 4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  body: { maxHeight: 520 },
  bodyContent: { padding: 20, gap: 14 },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelText: { fontSize: 14, fontWeight: '500' as const },
  submitBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
});
