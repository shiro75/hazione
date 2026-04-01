/**
 * @fileoverview Email service for sending invoices, quotes, and reminders.
 * Uses mailto: links on web and Linking API on native.
 * Includes template builders for reminder and quote emails.
 */

import { Platform, Linking } from 'react-native';

interface EmailParams {
  to: string;
  subject: string;
  body: string;
  isHTML?: boolean;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const { to, subject, body } = params;

  try {
    if (Platform.OS === 'web') {
      const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
      return true;
    }

    try {
      const MailComposer = await import('expo-mail-composer');
      const isAvailable = await MailComposer.isAvailableAsync();
      if (isAvailable) {
        await MailComposer.composeAsync({
          recipients: [to],
          subject,
          body,
          isHtml: params.isHTML ?? false,
        });
        return true;
      }
    } catch {
    }

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function buildInvoiceEmailBody(params: {
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  totalTTC: number;
  dueDate: string;
  currency?: string;
}): { subject: string; body: string } {
  const { companyName, clientName, invoiceNumber, totalTTC, dueDate, currency = 'EUR' } = params;
  const formattedAmount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(totalTTC);
  const formattedDate = new Date(dueDate).toLocaleDateString('fr-FR');

  return {
    subject: `Facture ${invoiceNumber} - ${companyName}`,
    body: `Bonjour ${clientName},\n\nVeuillez trouver ci-joint la facture ${invoiceNumber} d'un montant de ${formattedAmount} TTC.\n\nDate d'échéance : ${formattedDate}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${companyName}`,
  };
}

export function buildQuoteEmailBody(params: {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  totalTTC: number;
  expirationDate: string;
  currency?: string;
}): { subject: string; body: string } {
  const { companyName, clientName, quoteNumber, totalTTC, expirationDate, currency = 'EUR' } = params;
  const formattedAmount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(totalTTC);
  const formattedDate = new Date(expirationDate).toLocaleDateString('fr-FR');

  return {
    subject: `Devis ${quoteNumber} - ${companyName}`,
    body: `Bonjour ${clientName},\n\nVeuillez trouver ci-joint notre devis ${quoteNumber} d'un montant de ${formattedAmount} TTC.\n\nCe devis est valable jusqu'au ${formattedDate}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${companyName}`,
  };
}

export function buildReminderEmailBody(params: {
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  totalTTC: number;
  paidAmount: number;
  dueDate: string;
  level: number;
  currency?: string;
}): { subject: string; body: string } {
  const { companyName, clientName, invoiceNumber, totalTTC, paidAmount, dueDate, level, currency = 'EUR' } = params;
  const remaining = totalTTC - paidAmount;
  const formattedAmount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(remaining);
  const formattedDate = new Date(dueDate).toLocaleDateString('fr-FR');

  const levelTexts: Record<number, string> = {
    1: `Nous nous permettons de vous rappeler que la facture ${invoiceNumber} d'un montant de ${formattedAmount} est arrivée à échéance le ${formattedDate}.\n\nNous vous remercions de bien vouloir procéder à son règlement dans les meilleurs délais.`,
    2: `Sauf erreur de notre part, la facture ${invoiceNumber} d'un montant de ${formattedAmount}, échue le ${formattedDate}, reste impayée.\n\nNous vous prions de bien vouloir régulariser cette situation dans les plus brefs délais.`,
    3: `Malgré nos précédentes relances, la facture ${invoiceNumber} d'un montant de ${formattedAmount}, échue le ${formattedDate}, demeure impayée.\n\nSans règlement de votre part sous 8 jours, nous nous verrons dans l'obligation d'engager des poursuites.`,
  };

  return {
    subject: `${level === 1 ? 'Rappel' : level === 2 ? '2ème relance' : 'Dernière relance'} - Facture ${invoiceNumber} - ${companyName}`,
    body: `Bonjour ${clientName},\n\n${levelTexts[level] || levelTexts[1]}\n\nCordialement,\n${companyName}`,
  };
}
