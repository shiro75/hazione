/**
 * components/settings/BankingConfigSection.tsx
 * Configuration du compte de paiement (Stripe ou CinetPay).
 * Utilise BankingContext pour connecter / déconnecter.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Shield, CreditCard } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useBanking, type PaymentProviderType } from '@/contexts/BankingContext';
import { styles } from './settingsStyles';

export default function BankingConfigSection() {
  const { colors } = useTheme();
  const { config, connectAccount, disconnectAccount } = useBanking();
  const { successAlert, errorAlert, confirm } = useConfirm();

  const [connectingProvider, setConnectingProvider] = useState<PaymentProviderType>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>(null);

  const handleConnect = React.useCallback(async () => {
    if (!selectedProvider || !accountIdInput.trim()) return;
    setConnectingProvider(selectedProvider);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await connectAccount(selectedProvider, accountIdInput.trim());
      setShowConnectForm(false);
      setAccountIdInput('');
      setSelectedProvider(null);
      successAlert(
        'Connexion réussie',
        `Votre compte ${selectedProvider === 'stripe' ? 'Stripe' : 'CinetPay'} a été connecté avec succès.`
      );
    } catch {
      errorAlert('Erreur', 'Impossible de connecter le compte. Veuillez réessayer.');
    } finally {
      setConnectingProvider(null);
    }
  }, [selectedProvider, accountIdInput, connectAccount, successAlert, errorAlert]);

  const handleDisconnect = React.useCallback(() => {
    confirm(
      'Déconnecter',
      'Voulez-vous vraiment déconnecter votre compte de paiement ? Les paiements CB et Mobile Money seront désactivés.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: async () => { await disconnectAccount(); } },
      ]
    );
  }, [disconnectAccount, confirm]);

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations bancaires</Text>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
        Configurez votre compte de paiement pour accepter les paiements CB et Mobile Money.
      </Text>

      {/* Statut connexion */}
      <View style={[bankingStyles.statusCard, { borderColor: config.isConnected ? '#05966940' : colors.danger + '40' }]}>
        <View style={[bankingStyles.statusDotLg, { backgroundColor: config.isConnected ? '#059669' : colors.danger }]} />
        <View style={{ flex: 1 }}>
          <Text style={[bankingStyles.statusTitle, { color: colors.text }]}>
            {config.isConnected ? 'Connecté' : 'Non configuré'}
          </Text>
          {config.isConnected && config.provider ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {config.provider === 'stripe' ? 'Stripe (CB)' : 'CinetPay (Mobile Money)'} · ID: {config.connectedAccountId.substring(0, 12)}...
            </Text>
          ) : null}
          {config.isConnected && config.connectedAt ? (
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Connecté le {new Date(config.connectedAt).toLocaleDateString('fr-FR')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      {config.isConnected ? (
        <TouchableOpacity style={[bankingStyles.disconnectBtn, { borderColor: colors.danger }]} onPress={handleDisconnect} activeOpacity={0.7}>
          <Text style={[bankingStyles.disconnectBtnText, { color: colors.danger }]}>Déconnecter le compte</Text>
        </TouchableOpacity>
      ) : !showConnectForm ? (
        <TouchableOpacity style={[bankingStyles.connectBtn, { backgroundColor: colors.primary }]} onPress={() => setShowConnectForm(true)} activeOpacity={0.8}>
          <Text style={bankingStyles.connectBtnText}>Connecter mon compte de paiement</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Choisir un fournisseur</Text>
          <View style={bankingStyles.providerGrid}>
            {/* Stripe */}
            <TouchableOpacity
              style={[bankingStyles.providerCard, { backgroundColor: selectedProvider === 'stripe' ? '#635BFF18' : colors.background, borderColor: selectedProvider === 'stripe' ? '#635BFF' : colors.border, borderWidth: selectedProvider === 'stripe' ? 2 : 1 }]}
              onPress={() => setSelectedProvider('stripe')}
              activeOpacity={0.7}
            >
              <CreditCard size={24} color={selectedProvider === 'stripe' ? '#635BFF' : colors.textSecondary} />
              <Text style={[bankingStyles.providerName, { color: selectedProvider === 'stripe' ? '#635BFF' : colors.text }]}>Stripe</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Carte Bancaire</Text>
            </TouchableOpacity>
            {/* CinetPay */}
            <TouchableOpacity
              style={[bankingStyles.providerCard, { backgroundColor: selectedProvider === 'cinetpay' ? '#00D4AA18' : colors.background, borderColor: selectedProvider === 'cinetpay' ? '#00D4AA' : colors.border, borderWidth: selectedProvider === 'cinetpay' ? 2 : 1 }]}
              onPress={() => setSelectedProvider('cinetpay')}
              activeOpacity={0.7}
            >
              <CreditCard size={24} color={selectedProvider === 'cinetpay' ? '#00D4AA' : colors.textSecondary} />
              <Text style={[bankingStyles.providerName, { color: selectedProvider === 'cinetpay' ? '#00D4AA' : colors.text }]}>CinetPay</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Mobile Money</Text>
            </TouchableOpacity>
          </View>

          {selectedProvider ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>
                {selectedProvider === 'stripe' ? 'Stripe Connected Account ID' : 'CinetPay Site ID / API Key'}
              </Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                value={accountIdInput}
                onChangeText={setAccountIdInput}
                placeholder={selectedProvider === 'stripe' ? 'acct_XXXXXXXXXXXX' : 'XXXXXXXX'}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity style={[bankingStyles.formCancelBtn, { borderColor: colors.border }]} onPress={() => { setShowConnectForm(false); setSelectedProvider(null); setAccountIdInput(''); }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[bankingStyles.formSubmitBtn, { backgroundColor: (selectedProvider && accountIdInput.trim()) ? colors.primary : colors.textTertiary }]}
              onPress={handleConnect}
              disabled={!selectedProvider || !accountIdInput.trim() || connectingProvider !== null}
              activeOpacity={0.8}
            >
              {connectingProvider ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Connecter</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Info fonctionnement */}
      <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Shield size={16} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Fonctionnement</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Chaque commerçant HaziOne dispose de son propre compte connecté.{'\n'}
            Les paiements CB transitent via Stripe Connect et les paiements Mobile Money via CinetPay, directement vers votre compte.{'\n'}
            Les clés sont stockées de manière sécurisée par utilisateur.
          </Text>
        </View>
      </View>

      {/* Info restrictions */}
      <View style={[styles.infoBox, { backgroundColor: colors.warningLight, borderColor: colors.warning, marginTop: 12 }]}>
        <CreditCard size={16} color={colors.warning} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.warning }]}>Restrictions</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Sans configuration bancaire :{'\n'}
            {'•'} Paiement en espèces : toujours disponible{'\n'}
            {'•'} CB / Mobile Money : désactivés en Caisse et Factures{'\n'}
            Après connexion, tous les modes sont disponibles.
          </Text>
        </View>
      </View>
    </View>
  );
}

const bankingStyles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 16 },
  statusDotLg: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontWeight: '600' },
  connectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10 },
  connectBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1.5 },
  disconnectBtnText: { fontSize: 14, fontWeight: '600' },
  providerGrid: { flexDirection: 'row', gap: 12 },
  providerCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 12, gap: 6 },
  providerName: { fontSize: 15, fontWeight: '700' },
  formCancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  formSubmitBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
});