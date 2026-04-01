/**
 * @fileoverview Email sending modal for invoices and quotes.
 * Pre-fills recipient, subject, and body; shows attachment info.
 */
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import FormModal from '@/components/FormModal';

interface EmailModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title?: string;
  subtitle?: string;
  emailTo: string;
  onEmailToChange: (text: string) => void;
  emailSubject: string;
  onEmailSubjectChange: (text: string) => void;
  emailBody: string;
  onEmailBodyChange: (text: string) => void;
  attachment?: string;
}

export default React.memo(function EmailModal({
  visible,
  onClose,
  onSubmit,
  title = 'Envoyer par email',
  subtitle = 'Envoyer ce document par email',
  emailTo,
  onEmailToChange,
  emailSubject,
  onEmailSubjectChange,
  emailBody,
  onEmailBodyChange,
  attachment,
}: EmailModalProps) {
  const { colors } = useTheme();

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      onSubmit={onSubmit}
      submitLabel="Ouvrir le client mail"
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>DESTINATAIRE</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={emailTo}
          onChangeText={onEmailToChange}
          placeholder="email@exemple.com"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>OBJET</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={emailSubject}
          onChangeText={onEmailSubjectChange}
          placeholder="Objet du mail"
          placeholderTextColor={colors.textTertiary}
        />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>MESSAGE</Text>
        <TextInput
          style={[styles.input, styles.bodyInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
          value={emailBody}
          onChangeText={onEmailBodyChange}
          placeholder="Message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
      </View>
      {attachment ? (
        <View style={[styles.attachmentRow, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}>
          <Text style={[styles.attachmentIcon, { color: colors.primary }]}>📎</Text>
          <View style={styles.attachmentInfo}>
            <Text style={[styles.attachmentLabel, { color: colors.textTertiary }]}>PIÈCE JOINTE</Text>
            <Text style={[styles.attachmentName, { color: colors.primary }]}>{attachment}</Text>
          </View>
        </View>
      ) : null}
    </FormModal>
  );
});

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  bodyInput: { height: 160, textAlignVertical: 'top' as const },
  attachmentRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, padding: 12, borderRadius: 8, borderWidth: 1 },
  attachmentIcon: { fontSize: 16 },
  attachmentInfo: { flex: 1 },
  attachmentLabel: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5, marginBottom: 2 },
  attachmentName: { fontSize: 13, fontWeight: '600' as const },
});
