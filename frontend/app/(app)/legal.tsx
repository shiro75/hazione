import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FileText, Shield, Scale, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import PageHeader from '@/components/PageHeader';

type LegalTab = 'mentions' | 'cgu' | 'privacy';

const TAB_CONFIG: { key: LegalTab; labelFr: string; labelEn: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { key: 'mentions', labelFr: 'Mentions légales', labelEn: 'Legal Notice', icon: Scale },
  { key: 'cgu', labelFr: 'CGU', labelEn: 'Terms of Use', icon: FileText },
  { key: 'privacy', labelFr: 'Confidentialité', labelEn: 'Privacy Policy', icon: Shield },
];

function MentionsLegalesFR() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Mentions légales</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Éditeur de l'application</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'application HaziOne est éditée par HaziOne SAS.{'\n\n'}
        Siège social : Genève, Suisse{'\n'}
        Email de contact : contact@hazione.com{'\n'}
        Directeur de la publication : Soidrou Imamou
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Hébergement</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'application est hébergée par :{'\n\n'}
        Supabase Inc.{'\n'}
        970 Toa Payoh North #07-04, Singapore 318992{'\n'}
        Site web : https://supabase.com{'\n\n'}
        Les services web sont distribués via les infrastructures cloud de Vercel et AWS.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Propriété intellectuelle</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'ensemble des éléments constituant l'application HaziOne (textes, graphismes, logiciels, images, vidéos, sons, plans, noms, logos, marques, créations et œuvres protégeables diverses, bases de données, etc.) ainsi que le site et chacun des éléments qui le composent sont la propriété exclusive de HaziOne SAS.{'\n\n'}
        Toute représentation ou reproduction, intégrale ou partielle, faite sans le consentement de HaziOne SAS est illicite.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Contact</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Pour toute question relative aux mentions légales, vous pouvez nous contacter à l'adresse : contact@hazione.com
      </Text>
    </View>
  );
}

function MentionsLegalesEN() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Legal Notice</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Application Publisher</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The HaziOne application is published by HaziOne SAS.{'\n\n'}
        Registered office: To be defined{'\n'}
        Contact email: contact@hazione.com{'\n'}
        Publication director: Soidrou Imamou
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Hosting</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The application is hosted by:{'\n\n'}
        Supabase Inc.{'\n'}
        970 Toa Payoh North #07-04, Singapore 318992{'\n'}
        Website: https://supabase.com{'\n\n'}
        Web services are distributed via Vercel and AWS cloud infrastructure.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Intellectual Property</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        All elements constituting the HaziOne application (texts, graphics, software, images, videos, sounds, plans, names, logos, brands, creations and various protectable works, databases, etc.) as well as the site and each of its components are the exclusive property of HaziOne SAS.{'\n\n'}
        Any representation or reproduction, in whole or in part, made without the consent of HaziOne SAS is unlawful.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Contact</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        For any questions regarding the legal notice, you can contact us at: contact@hazione.com
      </Text>
    </View>
  );
}

function CGUFR() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Conditions Générales d'Utilisation</Text>
      <Text style={[styles.lastUpdate, { color: colors.textTertiary }]}>Dernière mise à jour : Mars 2026</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Objet</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Les présentes Conditions Générales d'Utilisation (ci-après "CGU") ont pour objet de définir les modalités et conditions d'utilisation de l'application HaziOne (ci-après "l'Application"), ainsi que de définir les droits et obligations des parties dans ce cadre.{'\n\n'}
        L'Application est un outil de gestion tout-en-un destiné aux entrepreneurs, permettant la gestion des ventes, de l'inventaire, de la facturation, des clients et de la comptabilité.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Inscription et compte utilisateur</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'accès à l'Application nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription.{'\n\n'}
        L'utilisateur est seul responsable de la confidentialité de ses identifiants de connexion et de toute activité effectuée sous son compte. En cas d'utilisation non autorisée de son compte, l'utilisateur doit en informer immédiatement HaziOne.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Utilisation de l'Application</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'utilisateur s'engage à utiliser l'Application conformément à sa destination et aux présentes CGU. Il est notamment interdit de :{'\n\n'}
        • Utiliser l'Application à des fins illicites ou frauduleuses{'\n'}
        • Tenter de compromettre la sécurité de l'Application{'\n'}
        • Reproduire, copier ou revendre tout ou partie de l'Application{'\n'}
        • Collecter les données d'autres utilisateurs{'\n'}
        • Utiliser des robots ou des systèmes automatisés pour accéder à l'Application
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Responsabilité</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne met tout en œuvre pour assurer la disponibilité et le bon fonctionnement de l'Application. Toutefois, HaziOne ne saurait être tenue responsable :{'\n\n'}
        • Des interruptions temporaires pour maintenance ou mise à jour{'\n'}
        • Des dysfonctionnements liés à l'environnement technique de l'utilisateur{'\n'}
        • Des dommages indirects résultant de l'utilisation de l'Application{'\n'}
        • De la perte de données en cas de force majeure
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Propriété intellectuelle</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'Application et tous ses éléments constitutifs (code source, interfaces, design, textes, logos, etc.) sont protégés par le droit de la propriété intellectuelle. L'utilisateur bénéficie d'un droit d'usage personnel, non exclusif et non transférable, limité à l'utilisation de l'Application dans le cadre de son activité professionnelle.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>6. Données de l'utilisateur</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'utilisateur reste propriétaire de toutes les données qu'il saisit dans l'Application. HaziOne s'engage à ne pas utiliser ces données à d'autres fins que le fonctionnement du service.{'\n\n'}
        L'utilisateur peut à tout moment exporter ses données ou demander leur suppression.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Résiliation</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        L'utilisateur peut résilier son compte à tout moment depuis les paramètres de l'Application. La résiliation entraîne la suppression définitive de toutes les données associées au compte après un délai de grâce de 30 jours.{'\n\n'}
        HaziOne se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes CGU, après notification préalable à l'utilisateur.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>8. Modification des CGU</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par notification dans l'Application. La poursuite de l'utilisation de l'Application après modification vaut acceptation des nouvelles CGU.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>9. Droit applicable et juridiction</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Les présentes CGU sont régies par le droit applicable dans le pays d'enregistrement de HaziOne SAS. Tout litige relatif à l'interprétation ou à l'exécution des présentes sera soumis aux tribunaux compétents.
      </Text>
    </View>
  );
}

function CGUEN() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Terms of Use</Text>
      <Text style={[styles.lastUpdate, { color: colors.textTertiary }]}>Last updated: March 2026</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Purpose</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        These Terms of Use (hereinafter "Terms") define the terms and conditions of use of the HaziOne application (hereinafter "the Application"), as well as the rights and obligations of the parties.{'\n\n'}
        The Application is an all-in-one management tool for entrepreneurs, enabling sales management, inventory, invoicing, customer management, and accounting.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Registration and User Account</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Access to the Application requires creating a user account. The user agrees to provide accurate, complete, and up-to-date information during registration.{'\n\n'}
        The user is solely responsible for the confidentiality of their login credentials and all activity under their account. In case of unauthorized use, the user must immediately notify HaziOne.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Use of the Application</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The user agrees to use the Application in accordance with its purpose and these Terms. It is prohibited to:{'\n\n'}
        • Use the Application for illegal or fraudulent purposes{'\n'}
        • Attempt to compromise the security of the Application{'\n'}
        • Reproduce, copy, or resell all or part of the Application{'\n'}
        • Collect data from other users{'\n'}
        • Use bots or automated systems to access the Application
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Liability</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne makes every effort to ensure the availability and proper functioning of the Application. However, HaziOne shall not be liable for:{'\n\n'}
        • Temporary interruptions for maintenance or updates{'\n'}
        • Malfunctions related to the user's technical environment{'\n'}
        • Indirect damages resulting from the use of the Application{'\n'}
        • Data loss in cases of force majeure
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Intellectual Property</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The Application and all its constituent elements (source code, interfaces, design, texts, logos, etc.) are protected by intellectual property law. The user has a personal, non-exclusive, and non-transferable right of use, limited to using the Application for their professional activity.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>6. User Data</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The user retains ownership of all data they enter into the Application. HaziOne commits to not using this data for purposes other than operating the service.{'\n\n'}
        The user can export their data or request its deletion at any time.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Termination</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The user may terminate their account at any time from the Application settings. Termination results in the permanent deletion of all data associated with the account after a 30-day grace period.{'\n\n'}
        HaziOne reserves the right to suspend or terminate an account in case of violation of these Terms, after prior notification to the user.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>8. Modifications</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne reserves the right to modify these Terms at any time. Users will be informed of any substantial modification by notification in the Application. Continued use of the Application after modification constitutes acceptance of the new Terms.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>9. Governing Law</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        These Terms are governed by the applicable law in the country of registration of HaziOne SAS. Any dispute relating to the interpretation or execution of these Terms shall be submitted to the competent courts.
      </Text>
    </View>
  );
}

function PrivacyFR() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Politique de confidentialité</Text>
      <Text style={[styles.lastUpdate, { color: colors.textTertiary }]}>Dernière mise à jour : Mars 2026</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Responsable du traitement</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Le responsable du traitement des données à caractère personnel est HaziOne SAS.{'\n\n'}
        Contact DPO : dpo@hazione.com
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Données collectées</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Dans le cadre de l'utilisation de l'Application, nous collectons les données suivantes :{'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Données d'identification :</Text>{'\n'}
        • Nom, prénom, adresse email{'\n'}
        • Numéro de téléphone{'\n'}
        • Informations de l'entreprise (raison sociale, SIRET, adresse){'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Données d'utilisation :</Text>{'\n'}
        • Logs de connexion{'\n'}
        • Données de navigation dans l'Application{'\n'}
        • Préférences de l'utilisateur{'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Données commerciales :</Text>{'\n'}
        • Factures, devis, bons de commande{'\n'}
        • Informations sur les clients et fournisseurs{'\n'}
        • Données de stock et d'inventaire{'\n'}
        • Historique des ventes et transactions
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Finalités du traitement</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Les données sont traitées pour les finalités suivantes :{'\n\n'}
        • Fourniture et gestion du service HaziOne{'\n'}
        • Gestion des comptes utilisateurs{'\n'}
        • Amélioration de l'Application et de l'expérience utilisateur{'\n'}
        • Communication avec les utilisateurs (support, notifications){'\n'}
        • Conformité aux obligations légales et réglementaires{'\n'}
        • Statistiques anonymisées d'utilisation
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Base légale du traitement</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Le traitement des données repose sur :{'\n\n'}
        • L'exécution du contrat (fourniture du service){'\n'}
        • Le consentement de l'utilisateur{'\n'}
        • L'intérêt légitime de HaziOne (amélioration du service, sécurité){'\n'}
        • Le respect des obligations légales
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Durée de conservation</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Les données personnelles sont conservées pendant la durée de l'utilisation du service, puis :{'\n\n'}
        • Données du compte : supprimées 30 jours après la résiliation{'\n'}
        • Données comptables et de facturation : conservées 10 ans (obligation légale){'\n'}
        • Logs de connexion : conservés 12 mois{'\n'}
        • Données de navigation : conservées 6 mois
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>6. Droits de l'utilisateur (RGPD)</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :{'\n\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit d'accès :</Text> obtenir une copie de vos données personnelles{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit de rectification :</Text> corriger vos données inexactes{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit à l'effacement :</Text> demander la suppression de vos données{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit à la portabilité :</Text> recevoir vos données dans un format structuré{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit d'opposition :</Text> vous opposer au traitement de vos données{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Droit à la limitation :</Text> restreindre le traitement de vos données{'\n\n'}
        Pour exercer vos droits, contactez notre DPO : dpo@hazione.com{'\n\n'}
        Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Sécurité des données</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données :{'\n\n'}
        • Chiffrement des données en transit (TLS/SSL){'\n'}
        • Chiffrement des données au repos{'\n'}
        • Authentification sécurisée{'\n'}
        • Sauvegardes régulières{'\n'}
        • Contrôle d'accès strict aux données
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>8. Transferts de données</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Vos données peuvent être hébergées sur des serveurs situés en dehors de l'Union Européenne (services cloud). Dans ce cas, HaziOne s'assure que des garanties appropriées sont mises en place conformément au RGPD.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>9. Contact</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Pour toute question relative à la protection de vos données personnelles :{'\n\n'}
        Email DPO : dpo@hazione.com{'\n'}
        Email général : contact@hazione.com
      </Text>
    </View>
  );
}

function PrivacyEN() {
  const { colors } = useTheme();
  return (
    <View style={styles.legalContent}>
      <Text style={[styles.legalTitle, { color: colors.text }]}>Privacy Policy</Text>
      <Text style={[styles.lastUpdate, { color: colors.textTertiary }]}>Last updated: March 2026</Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Data Controller</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        The data controller for personal data is HaziOne SAS.{'\n\n'}
        DPO contact: dpo@hazione.com
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Data Collected</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        When using the Application, we collect the following data:{'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Identification data:</Text>{'\n'}
        • Name, email address{'\n'}
        • Phone number{'\n'}
        • Company information (name, registration number, address){'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Usage data:</Text>{'\n'}
        • Connection logs{'\n'}
        • Navigation data within the Application{'\n'}
        • User preferences{'\n\n'}
        <Text style={{ fontWeight: '600' as const }}>Business data:</Text>{'\n'}
        • Invoices, quotes, purchase orders{'\n'}
        • Client and supplier information{'\n'}
        • Stock and inventory data{'\n'}
        • Sales history and transactions
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>3. Purposes of Processing</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Data is processed for the following purposes:{'\n\n'}
        • Provision and management of the HaziOne service{'\n'}
        • User account management{'\n'}
        • Improvement of the Application and user experience{'\n'}
        • Communication with users (support, notifications){'\n'}
        • Compliance with legal and regulatory obligations{'\n'}
        • Anonymized usage statistics
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>4. Legal Basis</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Data processing is based on:{'\n\n'}
        • Performance of the contract (service provision){'\n'}
        • User consent{'\n'}
        • Legitimate interest of HaziOne (service improvement, security){'\n'}
        • Compliance with legal obligations
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>5. Data Retention</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Personal data is retained for the duration of service use, then:{'\n\n'}
        • Account data: deleted 30 days after termination{'\n'}
        • Accounting and billing data: retained 10 years (legal obligation){'\n'}
        • Connection logs: retained 12 months{'\n'}
        • Navigation data: retained 6 months
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>6. User Rights (GDPR)</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Under the General Data Protection Regulation (GDPR), you have the following rights:{'\n\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right of access:</Text> obtain a copy of your personal data{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right to rectification:</Text> correct inaccurate data{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right to erasure:</Text> request deletion of your data{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right to portability:</Text> receive your data in a structured format{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right to object:</Text> object to the processing of your data{'\n'}
        • <Text style={{ fontWeight: '600' as const }}>Right to restriction:</Text> restrict the processing of your data{'\n\n'}
        To exercise your rights, contact our DPO: dpo@hazione.com{'\n\n'}
        You also have the right to lodge a complaint with your local data protection authority.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>7. Data Security</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        HaziOne implements appropriate technical and organizational measures to protect your data:{'\n\n'}
        • Encryption of data in transit (TLS/SSL){'\n'}
        • Encryption of data at rest{'\n'}
        • Secure authentication{'\n'}
        • Regular backups{'\n'}
        • Strict data access controls
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>8. Data Transfers</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        Your data may be hosted on servers located outside the European Union (cloud services). In this case, HaziOne ensures that appropriate safeguards are in place in accordance with the GDPR.
      </Text>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>9. Contact</Text>
      <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
        For any questions regarding the protection of your personal data:{'\n\n'}
        DPO email: dpo@hazione.com{'\n'}
        General email: contact@hazione.com
      </Text>
    </View>
  );
}

export default function LegalScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { colors } = useTheme();
  const { locale } = useI18n();
  const scrollRef = React.useRef<ScrollView>(null);

  const initialTab = (params.tab as LegalTab) || 'mentions';
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'mentions':
        return locale === 'fr' ? <MentionsLegalesFR /> : <MentionsLegalesEN />;
      case 'cgu':
        return locale === 'fr' ? <CGUFR /> : <CGUEN />;
      case 'privacy':
        return locale === 'fr' ? <PrivacyFR /> : <PrivacyEN />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={locale === 'fr' ? 'Informations légales' : 'Legal Information'}
        action={
          <TouchableOpacity
            style={[styles.scrollTopBtn, { backgroundColor: colors.surface }]}
            onPress={scrollToTop}
            activeOpacity={0.7}
          >
            <ChevronUp size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TAB_CONFIG.map((tab) => {
            const active = activeTab === tab.key;
            const label = locale === 'fr' ? tab.labelFr : tab.labelEn;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarInner: { flexDirection: 'row' as const },
  tabItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 14, fontWeight: '600' as const },
  scrollView: { flex: 1 },
  scrollContent: { padding: 24 },
  contentCard: { borderWidth: 1, borderRadius: 12, padding: 24 },
  legalContent: { gap: 0 },
  legalTitle: { fontSize: 22, fontWeight: '700' as const, marginBottom: 8 },
  lastUpdate: { fontSize: 12, marginBottom: 20 },
  sectionHeading: { fontSize: 16, fontWeight: '700' as const, marginTop: 24, marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 22, marginBottom: 4 },
  scrollTopBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
});
