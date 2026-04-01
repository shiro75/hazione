import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Linking, Platform,
} from 'react-native';
import {
  CheckCircle, MessageCircle, MessageSquare, Mail, Download, Printer, ShoppingCart, X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useData } from '@/contexts/DataContext';
import type { Sale } from '@/types';
import { generateReceiptHTML, generateAndSharePDF, printPDF } from '@/services/pdfService';
import { formatCurrency, formatDate } from '@/utils/format';

interface SaleConfirmationModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
  onNewSale: () => void;
}

const PAYMENT_LABELS_FR: Record<string, string> = {
  cash: 'Espèces', card: 'Carte bancaire', transfer: 'Virement',
  twint: 'TWINT', check: 'Chèque', mobile_wave: 'Wave',
  mobile_om: 'Orange Money', mixed: 'Paiement mixte',
};

const PAYMENT_LABELS_EN: Record<string, string> = {
  cash: 'Cash', card: 'Card', transfer: 'Transfer',
  twint: 'TWINT', check: 'Check', mobile_wave: 'Wave',
  mobile_om: 'Orange Money', mixed: 'Mixed payment',
};

export default React.memo(function SaleConfirmationModal({
  visible, sale, onClose, onNewSale,
}: SaleConfirmationModalProps) {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const { company, clients } = useData();

  const client = useMemo(() => {
    if (!sale?.clientId) return null;
    return clients.find(c => c.id === sale.clientId) ?? null;
  }, [sale?.clientId, clients]);

  const cur = company.currency || 'XOF';
  const payLabels = locale === 'en' ? PAYMENT_LABELS_EN : PAYMENT_LABELS_FR;

  const buildWhatsAppMessage = useCallback(() => {
    if (!sale) return '';
    const items = sale.items.map(i =>
      `${i.productName} x${i.quantity} — ${formatCurrency(i.totalTTC, cur)}`
    ).join('\n');
    return `*${t('saleConfirm.receipt')} — ${company.name || 'HaziOne'}*\n${formatDate(sale.createdAt)}\nN° ${sale.saleNumber}\n\n${items}\n\n*Total TTC : ${formatCurrency(sale.totalTTC, cur)}*\n${t('saleConfirm.paidBy')} : ${payLabels[sale.paymentMethod] || sale.paymentMethod}\n\n${t('saleConfirm.thankYou')} 🙏`;
  }, [sale, company.name, cur, t, payLabels]);

  const buildSMSMessage = useCallback(() => {
    if (!sale) return '';
    return `${company.name || 'HaziOne'} - ${t('saleConfirm.receipt')} ${sale.saleNumber} - Total: ${formatCurrency(sale.totalTTC, cur)} - ${t('saleConfirm.thankYou')}`;
  }, [sale, company.name, cur, t]);

  const handleWhatsApp = useCallback(() => {
    const msg = encodeURIComponent(buildWhatsAppMessage());
    const phone = client?.phone?.replace(/[\s+()-]/g, '') || '';
    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    Linking.openURL(url).catch(() => {});
  }, [buildWhatsAppMessage, client?.phone]);

  const handleSMS = useCallback(() => {
    const msg = encodeURIComponent(buildSMSMessage());
    const phone = client?.phone?.replace(/[\s+()-]/g, '') || '';
    const url = Platform.OS === 'ios'
      ? `sms:${phone}&body=${msg}`
      : `sms:${phone}?body=${msg}`;
    Linking.openURL(url).catch(() => {});
  }, [buildSMSMessage, client?.phone]);

  const handleEmail = useCallback(() => {
    if (!sale) return;
    const email = client?.email || '';
    if (!email) return;
    const subject = encodeURIComponent(`${t('saleConfirm.receipt')} ${sale.saleNumber} - ${company.name || 'HaziOne'}`);
    const body = encodeURIComponent(buildWhatsAppMessage().replace(/\*/g, ''));
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {});
  }, [sale, client?.email, buildWhatsAppMessage, company.name, t]);

  const handleDownloadPDF = useCallback(async () => {
    if (!sale) return;
    const html = generateReceiptHTML(sale, company);
    await generateAndSharePDF(html, `Recu_${sale.saleNumber}.pdf`);
  }, [sale, company]);

  const handlePrint = useCallback(async () => {
    if (!sale) return;
    const html = generateReceiptHTML(sale, company);
    await printPDF(html);
  }, [sale, company]);

  if (!sale) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.overlayBg} />
      </Pressable>
      <View style={styles.centeredWrap}>
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surfaceHover }]} onPress={onClose} hitSlop={8}>
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.successSection}>
              <View style={[styles.checkCircle, { backgroundColor: '#ECFDF5' }]}>
                <CheckCircle size={40} color="#16A34A" />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>{t('saleConfirm.title')}</Text>
              <Text style={[styles.saleNumber, { color: colors.primary }]}>
                {t('saleConfirm.saleNumber', { number: sale.saleNumber })}
              </Text>
            </View>

            <View style={[styles.receiptCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textTertiary }]}>Date</Text>
                <Text style={[styles.receiptValue, { color: colors.text }]}>{formatDate(sale.createdAt)}</Text>
              </View>
              {sale.clientName ? (
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { color: colors.textTertiary }]}>Client</Text>
                  <Text style={[styles.receiptValue, { color: colors.text }]}>{sale.clientName}</Text>
                </View>
              ) : null}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {sale.items.map((item, idx) => (
                <View key={item.id || idx} style={styles.itemRow}>
                  <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.productName}</Text>
                  <Text style={[styles.itemQty, { color: colors.textSecondary }]}>x{item.quantity}</Text>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>{formatCurrency(item.totalTTC, cur)}</Text>
                </View>
              ))}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total TTC</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>{formatCurrency(sale.totalTTC, cur)}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.textTertiary }]}>{t('saleConfirm.paidBy')}</Text>
                <Text style={[styles.receiptValue, { color: colors.text }]}>{payLabels[sale.paymentMethod] || sale.paymentMethod}</Text>
              </View>
            </View>

            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
                onPress={handleWhatsApp}
                activeOpacity={0.7}
              >
                <MessageCircle size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{t('saleConfirm.sendWhatsApp')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                onPress={handleSMS}
                activeOpacity={0.7}
              >
                <MessageSquare size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{t('saleConfirm.sendSMS')}</Text>
              </TouchableOpacity>

              {client?.email ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
                  onPress={handleEmail}
                  activeOpacity={0.7}
                >
                  <Mail size={18} color="#FFF" />
                  <Text style={styles.actionBtnText}>{t('saleConfirm.sendEmail')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleDownloadPDF}
                activeOpacity={0.7}
              >
                <Download size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{t('saleConfirm.downloadPDF')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#6B7280' }]}
                onPress={handlePrint}
                activeOpacity={0.7}
              >
                <Printer size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{t('saleConfirm.print')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.newSaleBtn, { backgroundColor: colors.primary }]}
              onPress={onNewSale}
              activeOpacity={0.7}
            >
              <ShoppingCart size={18} color="#FFF" />
              <Text style={styles.newSaleBtnText}>{t('saleConfirm.newSale')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  centeredWrap: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center' as const, alignItems: 'center' as const, padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 420, maxHeight: '90%',
    borderRadius: 16, borderWidth: 1, overflow: 'hidden' as const,
  },
  closeBtn: {
    position: 'absolute' as const, top: 12, right: 12, zIndex: 10,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  scrollContent: { padding: 24, paddingTop: 20 },
  successSection: { alignItems: 'center' as const, marginBottom: 20 },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12,
  },
  successTitle: { fontSize: 20, fontWeight: '700' as const, marginBottom: 4 },
  saleNumber: { fontSize: 14, fontWeight: '600' as const },
  receiptCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
  receiptRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingVertical: 4,
  },
  receiptLabel: { fontSize: 12, fontWeight: '500' as const },
  receiptValue: { fontSize: 13, fontWeight: '600' as const },
  divider: { height: 1, marginVertical: 10 },
  itemRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 3, gap: 8,
  },
  itemName: { flex: 1, fontSize: 13, fontWeight: '500' as const },
  itemQty: { fontSize: 12, fontWeight: '500' as const, minWidth: 30, textAlign: 'center' as const },
  itemPrice: { fontSize: 13, fontWeight: '600' as const, minWidth: 80, textAlign: 'right' as const },
  totalRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingVertical: 6,
  },
  totalLabel: { fontSize: 15, fontWeight: '700' as const },
  totalValue: { fontSize: 17, fontWeight: '800' as const },
  actionsGrid: { gap: 10, marginBottom: 16 },
  actionBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, gap: 8,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  newSaleBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  newSaleBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
});
