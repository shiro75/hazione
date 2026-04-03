import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useTheme } from '@/contexts/ThemeContext';

interface ConfirmButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  buttons: ConfirmButton[];
  type: 'destructive' | 'info' | 'success';
}

const INITIAL: ConfirmState = { visible: false, title: '', message: '', buttons: [], type: 'info' };

export const [ConfirmProvider, useConfirm] = createContextHook(() => {
  const [state, setState] = useState<ConfirmState>(INITIAL);

  const confirm = useCallback((
    title: string,
    message: string,
    buttons?: ConfirmButton[],
  ) => {
    const hasDestructive = buttons?.some(b => b.style === 'destructive');
    setState({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      type: hasDestructive ? 'destructive' : 'info',
    });
  }, []);

  const successAlert = useCallback((title: string, message: string, onDismiss?: () => void) => {
    setState({
      visible: true,
      title,
      message,
      buttons: [{ text: 'OK', style: 'default', onPress: onDismiss }],
      type: 'success',
    });
  }, []);

  const errorAlert = useCallback((title: string, message: string) => {
    setState({
      visible: true,
      title,
      message,
      buttons: [{ text: 'OK', style: 'default' }],
      type: 'destructive',
    });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL);
  }, []);

  return useMemo(() => ({ state, confirm, successAlert, errorAlert, close }), [state, confirm, successAlert, errorAlert, close]);
});

export function ConfirmModalRenderer() {
  const { state, close } = useConfirm();
  const { colors } = useTheme();

  if (!state.visible) return null;

  const cancelBtn = state.buttons.find(b => b.style === 'cancel');
  const actionBtns = state.buttons.filter(b => b.style !== 'cancel');

  const iconColor = state.type === 'destructive'
    ? colors.danger
    : state.type === 'success'
      ? (colors.success || '#059669')
      : colors.primary;

  const iconBg = state.type === 'destructive'
    ? colors.dangerLight
    : state.type === 'success'
      ? (colors.successLight || '#ECFDF5')
      : (colors.primaryLight || '#EEF2FF');

  const IconComponent = state.type === 'destructive'
    ? AlertTriangle
    : state.type === 'success'
      ? CheckCircle
      : Info;

  return (
    <Modal visible={state.visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={() => {
        const cancel = state.buttons.find(b => b.style === 'cancel');
        cancel?.onPress?.();
        close();
      }}>
        <Pressable style={[styles.container, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <IconComponent size={24} color={iconColor} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{state.title}</Text>
          {state.message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{state.message}</Text>
          ) : null}
          <View style={styles.actions}>
            {cancelBtn && (
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { cancelBtn.onPress?.(); close(); }}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{cancelBtn.text}</Text>
              </TouchableOpacity>
            )}
            {actionBtns.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const bgColor = isDestructive ? colors.danger : colors.primary;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.confirmBtn, { backgroundColor: bgColor }]}
                  onPress={() => { btn.onPress?.(); close(); }}
                >
                  <Text style={styles.confirmText}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  container: {
    borderRadius: 16,
    padding: 28,
    width: 380,
    maxWidth: '90%' as unknown as number,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: 10,
    width: '100%' as unknown as number,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  confirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
