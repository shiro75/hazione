import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, useWindowDimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Target, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from '@/constants/theme';

interface MonthlyGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number) => void;
  currentGoal: number | null;
  currency: string;
}

function MonthlyGoalModal({
  visible,
  onClose,
  onSave,
  currentGoal,
  currency,
}: MonthlyGoalModalProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const modalWidth = isMobile ? screenWidth - 32 : Math.min(420, screenWidth - 48);

  const [inputValue, setInputValue] = useState<string>(
    currentGoal && currentGoal > 0 ? String(currentGoal) : ''
  );

  const handleOpen = useCallback(() => {
    setInputValue(currentGoal && currentGoal > 0 ? String(currentGoal) : '');
  }, [currentGoal]);

  const handleSave = useCallback(() => {
    const numVal = parseFloat(inputValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(numVal) && numVal > 0) {
      onSave(Math.round(numVal));
      onClose();
    }
  }, [inputValue, onSave, onClose]);

  const handleClear = useCallback(() => {
    onSave(0);
    onClose();
  }, [onSave, onClose]);

  const isValid = (() => {
    const numVal = parseFloat(inputValue.replace(/[^0-9.]/g, ''));
    return !isNaN(numVal) && numVal > 0;
  })();

  const presets = [50000, 100000, 250000, 500000, 1000000];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={modalStyles.overlay} onPress={onClose}>
          <Pressable
            style={[modalStyles.container, { backgroundColor: colors.card, width: modalWidth }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={modalStyles.header}>
              <View style={[modalStyles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                <Target size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[modalStyles.title, { color: colors.text }]}>Objectif CA mensuel</Text>
                <Text style={[modalStyles.subtitle, { color: colors.textTertiary }]}>
                  Fixez un objectif pour suivre votre progression
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.inputSection}>
              <Text style={[modalStyles.inputLabel, { color: colors.textSecondary }]}>
                Montant cible ({currency})
              </Text>
              <View style={[modalStyles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[modalStyles.input, { color: colors.text }]}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder="Ex: 500000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  autoFocus
                  testID="goal-input"
                />
                <Text style={[modalStyles.inputUnit, { color: colors.textTertiary }]}>{currency}</Text>
              </View>
            </View>

            <View style={modalStyles.presetsSection}>
              <Text style={[modalStyles.presetsLabel, { color: colors.textTertiary }]}>Suggestions</Text>
              <View style={modalStyles.presetsRow}>
                {presets.map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      modalStyles.presetChip,
                      {
                        backgroundColor: inputValue === String(val) ? colors.primary + '15' : colors.background,
                        borderColor: inputValue === String(val) ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setInputValue(String(val))}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        modalStyles.presetText,
                        { color: inputValue === String(val) ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      {val >= 1000000 ? `${val / 1000000}M` : val >= 1000 ? `${val / 1000}k` : String(val)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modalStyles.actions}>
              {currentGoal && currentGoal > 0 ? (
                <TouchableOpacity
                  style={[modalStyles.clearBtn, { borderColor: colors.border }]}
                  onPress={handleClear}
                  activeOpacity={0.7}
                >
                  <Text style={[modalStyles.clearBtnText, { color: '#DC2626' }]}>Supprimer</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  modalStyles.saveBtn,
                  { backgroundColor: isValid ? colors.primary : colors.primary + '40', flex: 1 },
                ]}
                onPress={handleSave}
                activeOpacity={0.7}
                disabled={!isValid}
                testID="goal-save"
              >
                <Text style={modalStyles.saveBtnText}>
                  {currentGoal && currentGoal > 0 ? 'Modifier' : 'Définir l\'objectif'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default React.memo(MonthlyGoalModal);

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  container: {
    borderRadius: RADIUS.XL,
    padding: SPACING['5XL'],
    ...SHADOWS.SM,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.XL,
    marginBottom: SPACING['5XL'],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: SPACING.XXXL,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    marginBottom: SPACING.MD,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderRadius: RADIUS.LG,
    paddingHorizontal: SPACING.XXXL,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.SIZE.TITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    paddingVertical: SPACING.XXL,
  },
  inputUnit: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    marginLeft: SPACING.MD,
  },
  presetsSection: {
    marginBottom: SPACING['5XL'],
  },
  presetsLabel: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDE,
    marginBottom: SPACING.MD,
  },
  presetsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.MD,
  },
  presetChip: {
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.ROUND,
    borderWidth: 1,
  },
  presetText: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: SPACING.MD,
  },
  clearBtn: {
    paddingHorizontal: SPACING.XXXL,
    paddingVertical: SPACING.XXL,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  clearBtnText: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  saveBtn: {
    paddingVertical: SPACING.XXL,
    borderRadius: RADIUS.LG,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});
