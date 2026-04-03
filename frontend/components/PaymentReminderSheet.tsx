/**
 * @fileoverview Payment reminder bottom sheet for unpaid invoices.
 * Lets the user send a pre-filled SMS or WhatsApp message to the client.
 * Logs each reminder in the payment reminder history.
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity,
  TextInput, ScrollView, Linking, Platform,
} from 'react-native';
import {
  X, MessageSquare, Smartphone, User, Calendar,
  FileText, DollarSign, Send, AlertCircle, Clock, Pencil,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useData } from '@/contexts/DataContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Invoice, PaymentReminderChannel } from '@/types';

interface PaymentReminderSheetProps {
  visible: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onEditClient?: (clientId: string) => void;
}

export default function PaymentReminderSheet({
  visible, onClose, invoice, onEditClient,
}: PaymentReminderSheetProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { errorAlert } = useConfirm();
  const { activeClients, company, logPaymentReminder, getClientReminderLogs } = useData();
  const cur = company.currency || 'EUR';

  const client = useMemo(() => {
    if (!invoice) return null;
    return activeClients.find(c => c.id === invoice.clientId) ?? null;
  }, [invoice, activeClients]);

  const clientName = client
    ? (client.companyName || `${client.firstName} ${client.lastName}`)
    : invoice?.clientName || '';

  const amountDue = invoice ? invoice.totalTTC - invoice.paidAmount : 0;

  const defaultMessage = useMemo(() => {
    if (!invoice) return '';
    return t('reminder.defaultMessage', {
      clientName,
      amount: formatCurrency(amountDue, cur),
      companyName: company.name || 'Notre entreprise',
      invoiceRef: invoice.invoiceNumber || invoice.id,
    });
  }, [invoice, clientName, amountDue, cur, company.name, t]);

  const [message, setMessage] = useState('');

  React.useEffect(() => {
    if (visible && defaultMessage) {
      setMessage(defaultMessage);
    }
  }, [visible, defaultMessage]);

  const clientPhone = client?.phone || '';
  const hasPhone = clientPhone.length > 3;

  const reminderHistory = useMemo(() => {
    if (!client) return [];
    return getClientReminderLogs(client.id);
  }, [client, getClientReminderLogs]);

  const cleanPhone = useCallback((phone: string) => {
    return phone.replace(/\s/g, '').replace(/^\+/, '');
  }, []);

  const handleSendSMS = useCallback(() => {
    if (!hasPhone || !invoice || !client) return;
    const cleaned = clientPhone.replace(/\s/g, '');
    const encoded = encodeURIComponent(message);
    const url = Platform.OS === 'ios'
      ? `sms:${cleaned}&body=${encoded}`
      : `sms:${cleaned}?body=${encoded}`;

    logPaymentReminder({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      clientId: client.id,
      clientName,
      clientPhone: cleaned,
      channel: 'sms' as PaymentReminderChannel,
      amountDue,
      message,
      sentAt: new Date().toISOString(),
    });

    Linking.openURL(url).catch(() => {
      errorAlert('Erreur', 'Impossible d\'ouvrir l\'application SMS');
    });
    onClose();
  }, [hasPhone, invoice, client, clientPhone, message, logPaymentReminder, clientName, amountDue, onClose, errorAlert]);

  const handleSendWhatsApp = useCallback(() => {
    if (!hasPhone || !invoice || !client) return;
    const cleaned = cleanPhone(clientPhone);
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleaned}?text=${encoded}`;

    logPaymentReminder({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber || invoice.id,
      clientId: client.id,
      clientName,
      clientPhone: cleaned,
      channel: 'whatsapp' as PaymentReminderChannel,
      amountDue,
      message,
      sentAt: new Date().toISOString(),
    });

    Linking.openURL(url).catch(() => {
      errorAlert('Erreur', 'Impossible d\'ouvrir WhatsApp');
    });
    onClose();
  }, [hasPhone, invoice, client, clientPhone, message, cleanPhone, logPaymentReminder, clientName, amountDue, onClose, errorAlert]);

  if (!invoice) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.overlayBg} />
      </Pressable>
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.headerIcon, { backgroundColor: colors.warningLight }]}>
            <Send size={18} color={colors.warning} />
          </View>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('reminder.title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
            <View style={styles.summaryRow}>
              <User size={14} color={colors.textTertiary} />
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('reminder.client')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>{clientName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <DollarSign size={14} color={colors.textTertiary} />
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('reminder.amountDue')}</Text>
              <Text style={[styles.summaryValueHighlight, { color: colors.danger }]}>
                {formatCurrency(amountDue, cur)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Calendar size={14} color={colors.textTertiary} />
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('reminder.invoiceDate')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <FileText size={14} color={colors.textTertiary} />
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('reminder.invoiceRef')}</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {invoice.invoiceNumber || 'Brouillon'}
              </Text>
            </View>
          </View>

          <View style={styles.messageSection}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('reminder.message')}</Text>
            <TextInput
              style={[styles.messageInput, {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
              }]}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {!hasPhone ? (
            <View style={[styles.noPhoneBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <AlertCircle size={16} color="#92400E" />
              <View style={styles.noPhoneContent}>
                <Text style={[styles.noPhoneText, { color: '#92400E' }]}>
                  {t('reminder.noPhone')}
                </Text>
                {onEditClient && client && (
                  <TouchableOpacity
                    style={styles.editClientLink}
                    onPress={() => { onClose(); onEditClient(client.id); }}
                    activeOpacity={0.7}
                  >
                    <Pencil size={12} color="#D97706" />
                    <Text style={[styles.editClientText, { color: '#D97706' }]}>
                      {t('reminder.editClient')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.sendButtons}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: '#059669' }]}
                onPress={handleSendSMS}
                activeOpacity={0.8}
              >
                <Smartphone size={18} color="#FFF" />
                <Text style={styles.sendBtnText}>{t('reminder.sendSMS')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: '#25D366' }]}
                onPress={handleSendWhatsApp}
                activeOpacity={0.8}
              >
                <MessageSquare size={18} color="#FFF" />
                <Text style={styles.sendBtnText}>{t('reminder.sendWhatsApp')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {reminderHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>
                {t('reminder.history')}
              </Text>
              {reminderHistory.slice(0, 5).map((log) => (
                <View
                  key={log.id}
                  style={[styles.historyItem, { borderBottomColor: colors.borderLight }]}
                >
                  <View style={[
                    styles.historyDot,
                    { backgroundColor: log.channel === 'sms' ? '#059669' : '#25D366' },
                  ]} />
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyChannel, { color: colors.text }]}>
                      {t('reminder.sentVia', {
                        channel: log.channel === 'sms' ? t('reminder.sms') : t('reminder.whatsapp'),
                      })}
                    </Text>
                    <Text style={[styles.historyMeta, { color: colors.textTertiary }]}>
                      {formatDate(log.sentAt)} · {formatCurrency(log.amountDue, cur)}
                    </Text>
                  </View>
                  <Clock size={12} color={colors.textTertiary} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  sheetBody: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    width: 90,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  summaryValueHighlight: {
    fontSize: 16,
    fontWeight: '800' as const,
    flex: 1,
  },
  messageSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
  },
  noPhoneBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  noPhoneContent: {
    flex: 1,
    gap: 8,
  },
  noPhoneText: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  editClientLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  editClientText: {
    fontSize: 13,
    fontWeight: '600' as const,
    textDecorationLine: 'underline' as const,
  },
  sendButtons: {
    gap: 10,
  },
  sendBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  historySection: {
    gap: 8,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  historyItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyChannel: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  historyMeta: {
    fontSize: 11,
    marginTop: 2,
  },
});
