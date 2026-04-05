/**
 * components/ventes/RelancesSection.tsx
 * Extrait de VentesScreen.tsx — logique et rendu identiques.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform, Linking } from 'react-native';
import { AlertCircle, Mail, Smartphone, MessageSquare } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import { sendEmail, buildReminderEmailBody } from '@/services/emailService';
import { styles } from './ventesStyles';

export default function RelancesSection({ isMobile: _isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const { lateInvoices, reminderLogs, sendReminder, activeClients, company, showToast } = useData();
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const buildReminderMessage = useCallback((inv: { clientName: string; invoiceNumber: string; totalTTC: number; paidAmount: number }) => {
    const remaining = inv.totalTTC - inv.paidAmount;
    return `Bonjour ${inv.clientName}, vous avez un solde impayé de ${formatCurrency(remaining, company.currency || 'EUR')} chez ${company.name || 'notre entreprise'}. Merci de régulariser. Ref: ${inv.invoiceNumber}`;
  }, [company]);

  const handleSendSMS = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    if (!client?.phone) { showToast('Aucun numéro de téléphone pour ce client', 'error'); return; }
    const message = buildReminderMessage(inv);
    const smsUrl = Platform.OS === 'ios' ? `sms:${client.phone}&body=${encodeURIComponent(message)}` : `sms:${client.phone}?body=${encodeURIComponent(message)}`;
    if (Platform.OS === 'web') window.open(smsUrl, '_blank');
    else void Linking.openURL(smsUrl).catch(() => showToast('Impossible d\'ouvrir l\'app SMS', 'error'));
    showToast('App SMS ouverte avec le message pré-rempli');
  }, [lateInvoices, activeClients, buildReminderMessage, showToast]);

  const handleSendWhatsApp = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const phone = client?.phone?.replace(/\s/g, '').replace(/^0/, '+33');
    if (!phone) { showToast('Aucun numéro de téléphone pour ce client', 'error'); return; }
    const waUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(buildReminderMessage(inv))}`;
    if (Platform.OS === 'web') window.open(waUrl, '_blank');
    else void Linking.openURL(waUrl).catch(() => showToast('Impossible d\'ouvrir WhatsApp', 'error'));
    showToast('WhatsApp ouvert avec le message pré-rempli');
  }, [lateInvoices, activeClients, buildReminderMessage, showToast]);

  const handleSendReminderEmail = useCallback((invoiceId: string) => {
    const inv = lateInvoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = activeClients.find((c) => c.id === inv.clientId);
    const nextLevel = Math.min(reminderLogs.filter((r) => r.invoiceId === invoiceId).length + 1, 3);
    const { subject, body } = buildReminderEmailBody({ companyName: company.name, clientName: inv.clientName, invoiceNumber: inv.invoiceNumber, totalTTC: inv.totalTTC, paidAmount: inv.paidAmount, dueDate: inv.dueDate, level: nextLevel, currency: company.currency || 'EUR' });
    setEmailTo(client?.email || ''); setEmailSubject(subject); setEmailBody(body); setEmailModalVisible(true);
    sendReminder(invoiceId);
  }, [lateInvoices, activeClients, company, reminderLogs, sendReminder]);

  const handleSendEmail = useCallback(async () => {
    if (!emailTo) return;
    await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody });
    setEmailModalVisible(false);
    showToast('Relance envoyée');
  }, [emailTo, emailSubject, emailBody, showToast]);

  return (
    <>
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.dangerLight }]}><AlertCircle size={20} color={colors.danger} /></View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{lateInvoices.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Factures en retard</Text>
        </View>
        <Text style={[styles.summaryTotal, { color: colors.danger }]}>
          {formatCurrency(lateInvoices.reduce((s, i) => s + i.totalTTC - i.paidAmount, 0), company.currency || 'EUR')}
        </Text>
      </View>

      {lateInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune facture en retard</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Bonne nouvelle, tout est à jour !</Text>
        </View>
      ) : (
        <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {lateInvoices.map((inv, i) => {
            const lastLevel = reminderLogs.filter((r) => r.invoiceId === inv.id).length > 0
              ? Math.max(...reminderLogs.filter((r) => r.invoiceId === inv.id).map((r) => r.level)) : 0;
            const daysLate = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            return (
              <View key={inv.id} style={[styles.listRow, i < lateInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={styles.listRowMain}>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{inv.clientName} · {daysLate}j de retard</Text>
                    {lastLevel > 0 && <Text style={[styles.reminderLevel, { color: colors.warning }]}>Relance niv. {lastLevel} envoyée</Text>}
                  </View>
                  <Text style={[styles.listRowValue, { color: colors.danger }]}>{formatCurrency(inv.totalTTC - inv.paidAmount, company.currency || 'EUR')}</Text>
                  <View style={styles.reminderActions}>
                    <TouchableOpacity onPress={() => handleSendReminderEmail(inv.id)} style={[styles.reminderActionBtn, { backgroundColor: colors.warningLight }]} disabled={lastLevel >= 3}>
                      <Mail size={13} color={colors.warning} /><Text style={[styles.reminderActionLabel, { color: colors.warning }]}>Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSendSMS(inv.id)} style={[styles.reminderActionBtn, { backgroundColor: '#EFF6FF' }]}>
                      <Smartphone size={13} color="#2563EB" /><Text style={[styles.reminderActionLabel, { color: '#2563EB' }]}>SMS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSendWhatsApp(inv.id)} style={[styles.reminderActionBtn, { backgroundColor: '#F0FDF4' }]}>
                      <MessageSquare size={13} color="#16A34A" /><Text style={[styles.reminderActionLabel, { color: '#16A34A' }]}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <FormModal visible={emailModalVisible} onClose={() => setEmailModalVisible(false)} title="Envoyer la relance" subtitle="Email de relance au client" onSubmit={handleSendEmail} submitLabel="Ouvrir le client mail">
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Destinataire</Text><TextInput style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailTo} onChangeText={setEmailTo} placeholder="email@exemple.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" /></View>
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Objet</Text><TextInput style={[styles.emailFieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailSubject} onChangeText={setEmailSubject} /></View>
        <View style={styles.emailField}><Text style={[styles.emailFieldLabel, { color: colors.textTertiary }]}>Message</Text><TextInput style={[styles.emailFieldInput, styles.emailBodyField, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} value={emailBody} onChangeText={setEmailBody} multiline numberOfLines={8} textAlignVertical="top" /></View>
      </FormModal>

      {reminderLogs.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique des relances</Text>
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {reminderLogs.slice(0, 20).map((rl, i) => (
              <View key={rl.id} style={[styles.listRow, i < Math.min(reminderLogs.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={styles.listRowMain}>
                  <View style={[styles.levelBadge, { backgroundColor: rl.level >= 3 ? colors.dangerLight : rl.level >= 2 ? colors.warningLight : colors.primaryLight }]}>
                    <Text style={[styles.levelBadgeText, { color: rl.level >= 3 ? colors.danger : rl.level >= 2 ? colors.warning : colors.primary }]}>Niv. {rl.level}</Text>
                  </View>
                  <View style={styles.listRowInfo}>
                    <Text style={[styles.listRowTitle, { color: colors.text }]}>{rl.invoiceNumber || rl.invoiceId}</Text>
                    <Text style={[styles.listRowSub, { color: colors.textTertiary }]}>{rl.clientName} · {formatDate(rl.sentAt)}</Text>
                  </View>
                  <View style={[styles.methodBadge, { backgroundColor: colors.surfaceHover }]}>
                    <Text style={[styles.methodBadgeText, { color: colors.textSecondary }]}>{rl.method}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}