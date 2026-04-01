import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingCart, BarChart3, Package, FileText, Globe, Truck, LayoutDashboard, WifiOff,
  ArrowRight, Star, CheckCircle, Quote,
} from 'lucide-react-native';
import { useI18n, type AppLocale } from '@/contexts/I18nContext';

const FEATURES = [
  { key: 'POS', icon: ShoppingCart, labelKey: 'landing.featurePOS', descKey: 'landing.featurePOSDesc', color: '#2563EB' },
  { key: 'Sales', icon: BarChart3, labelKey: 'landing.featureSales', descKey: 'landing.featureSalesDesc', color: '#7C3AED' },
  { key: 'Stock', icon: Package, labelKey: 'landing.featureStock', descKey: 'landing.featureStockDesc', color: '#059669' },
  { key: 'Invoices', icon: FileText, labelKey: 'landing.featureInvoices', descKey: 'landing.featureInvoicesDesc', color: '#D97706' },
  { key: 'Shop', icon: Globe, labelKey: 'landing.featureShop', descKey: 'landing.featureShopDesc', color: '#DC2626' },
  { key: 'Purchases', icon: Truck, labelKey: 'landing.featurePurchases', descKey: 'landing.featurePurchasesDesc', color: '#0891B2' },
  { key: 'Dashboard', icon: LayoutDashboard, labelKey: 'landing.featureDashboard', descKey: 'landing.featureDashboardDesc', color: '#4F46E5' },
  { key: 'Offline', icon: WifiOff, labelKey: 'landing.featureOffline', descKey: 'landing.featureOfflineDesc', color: '#BE185D' },
];

const PLANS = [
  { key: 'free', nameKey: 'landing.free', priceKey: 'landing.freePrice', featuresKey: 'landing.freeFeatures', color: '#64748B', popular: false },
  { key: 'pro', nameKey: 'landing.pro', priceKey: 'landing.proPrice', featuresKey: 'landing.proFeatures', color: '#2563EB', popular: true },
  { key: 'business', nameKey: 'landing.business', priceKey: 'landing.businessPrice', featuresKey: 'landing.businessFeatures', color: '#7C3AED', popular: false },
];

const TESTIMONIALS = [
  { nameKey: 'landing.testimonial1Name', roleKey: 'landing.testimonial1Role', textKey: 'landing.testimonial1Text' },
  { nameKey: 'landing.testimonial2Name', roleKey: 'landing.testimonial2Role', textKey: 'landing.testimonial2Text' },
  { nameKey: 'landing.testimonial3Name', roleKey: 'landing.testimonial3Role', textKey: 'landing.testimonial3Text' },
];

const LANGUAGE_FLAGS: { value: AppLocale; flag: string; label: string }[] = [
  { value: 'fr', flag: '🇫🇷', label: 'FR' },
  { value: 'en', flag: '🇬🇧', label: 'EN' },
  { value: 'km', flag: '🇰🇲', label: 'KM' },
];

export default function LandingPage() {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const goToAuth = useCallback(() => {
    router.push('/auth');
  }, [router]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <LinearGradient colors={['#0F172A', '#1E3A5F', '#0F172A']} style={styles.heroGradient}>
        <View style={[styles.nav, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.logoText}>HaziOne</Text>
          <View style={styles.navRight}>
            <View style={styles.langRow}>
              {LANGUAGE_FLAGS.map(l => (
                <TouchableOpacity key={l.value} onPress={() => setLocale(l.value)} style={[styles.langBtn, locale === l.value && styles.langBtnActive]} activeOpacity={0.7}>
                  <Text style={styles.langEmoji}>{l.flag}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.loginBtn} onPress={goToAuth} activeOpacity={0.7}>
              <Text style={styles.loginBtnText}>{t('landing.login')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
          <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>{t('landing.hero')}</Text>
          <Text style={[styles.heroSubtitle, isDesktop && styles.heroSubDesktop]}>{t('landing.heroSub')}</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={goToAuth} activeOpacity={0.8}>
            <Text style={styles.ctaBtnText}>{t('landing.cta')}</Text>
            <ArrowRight size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('landing.features')}</Text>
        <View style={[styles.featGrid, isDesktop && styles.featGridDesktop]}>
          {FEATURES.map(f => (
            <View key={f.key} style={[styles.featCard, isDesktop && styles.featCardDesktop]}>
              <View style={[styles.featIconWrap, { backgroundColor: f.color + '15' }]}>
                <f.icon size={22} color={f.color} />
              </View>
              <Text style={styles.featName}>{t(f.labelKey)}</Text>
              <Text style={styles.featDesc}>{t(f.descKey)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.section, styles.pricingSection]}>
        <Text style={styles.sectionTitle}>{t('landing.pricing')}</Text>
        <View style={[styles.planGrid, isDesktop && styles.planGridDesktop]}>
          {PLANS.map(plan => {
            const features = t(plan.featuresKey).split('|');
            return (
              <View key={plan.key} style={[styles.planCard, plan.popular && styles.planCardPopular, plan.popular && { borderColor: plan.color }]}>
                {plan.popular ? (
                  <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                    <Star size={10} color="#FFF" />
                    <Text style={styles.popularText}>{t('landing.popular')}</Text>
                  </View>
                ) : null}
                <Text style={[styles.planName, { color: plan.color }]}>{t(plan.nameKey)}</Text>
                <Text style={styles.planPrice}>{t(plan.priceKey)}</Text>
                <View style={styles.planFeatures}>
                  {features.map((feat, i) => (
                    <View key={i} style={styles.planFeatureRow}>
                      <CheckCircle size={14} color={plan.color} />
                      <Text style={styles.planFeatureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={[styles.planBtn, { backgroundColor: plan.color }]} onPress={goToAuth} activeOpacity={0.7}>
                  <Text style={styles.planBtnText}>{t('landing.choosePlan')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('landing.testimonials')}</Text>
        <View style={[styles.testimGrid, isDesktop && styles.testimGridDesktop]}>
          {TESTIMONIALS.map((test, idx) => (
            <View key={idx} style={styles.testimCard}>
              <View style={styles.testimQuoteIcon}>
                <Quote size={20} color="#2563EB" />
              </View>
              <Text style={styles.testimText}>{t(test.textKey)}</Text>
              <View style={styles.testimAuthor}>
                <View style={styles.testimAvatar}>
                  <Text style={styles.testimAvatarText}>{t(test.nameKey).charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.testimName}>{t(test.nameKey)}</Text>
                  <Text style={styles.testimRole}>{t(test.roleKey)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLogo}>HaziOne</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>{t('landing.footer.legal')}</Text>
          <Text style={styles.footerSep}>·</Text>
          <Text style={styles.footerLink}>{t('landing.footer.privacy')}</Text>
          <Text style={styles.footerSep}>·</Text>
          <Text style={styles.footerLink}>{t('landing.footer.contact')}</Text>
        </View>
        <Text style={styles.footerCopy}>© {new Date().getFullYear()} HaziOne. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  heroGradient: { paddingBottom: 60 },
  nav: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingHorizontal: 20,
  },
  logoText: { fontSize: 22, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: -0.5 },
  navRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  langRow: { flexDirection: 'row' as const, gap: 4 },
  langBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2, borderColor: 'transparent' },
  langBtnActive: { borderColor: '#3B82F6' },
  langEmoji: { fontSize: 16 },
  loginBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  loginBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' as const },
  heroContent: { alignItems: 'center' as const, paddingHorizontal: 24, paddingTop: 50 },
  heroContentDesktop: { paddingTop: 80, maxWidth: 700, alignSelf: 'center' as const },
  heroTitle: { fontSize: 32, fontWeight: '800' as const, color: '#FFFFFF', textAlign: 'center' as const, letterSpacing: -1, lineHeight: 40 },
  heroTitleDesktop: { fontSize: 48, lineHeight: 56 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center' as const, marginTop: 16, lineHeight: 22, maxWidth: 500 },
  heroSubDesktop: { fontSize: 17, lineHeight: 26 },
  ctaBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#2563EB',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 28, gap: 8,
    shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },
  section: { paddingHorizontal: 20, paddingTop: 48 },
  sectionTitle: { fontSize: 24, fontWeight: '800' as const, color: '#0F172A', textAlign: 'center' as const, marginBottom: 28, letterSpacing: -0.5 },
  featGrid: { gap: 16 },
  featGridDesktop: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const },
  featCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  featCardDesktop: { width: '22%' as unknown as number, minWidth: 200, margin: 8 },
  featIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 12 },
  featName: { fontSize: 15, fontWeight: '700' as const, color: '#0F172A', marginBottom: 4 },
  featDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  pricingSection: { backgroundColor: '#F8FAFC', marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 48 },
  planGrid: { gap: 16 },
  planGridDesktop: { flexDirection: 'row' as const, justifyContent: 'center' as const },
  planCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center' as const,
  },
  planCardPopular: { borderWidth: 2, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  popularBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12,
  },
  popularText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  planName: { fontSize: 18, fontWeight: '700' as const, marginBottom: 4 },
  planPrice: { fontSize: 22, fontWeight: '800' as const, color: '#0F172A', marginBottom: 16 },
  planFeatures: { gap: 8, marginBottom: 20, alignSelf: 'stretch' as const },
  planFeatureRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  planFeatureText: { fontSize: 13, color: '#475569' },
  planBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, alignSelf: 'stretch' as const, alignItems: 'center' as const },
  planBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  testimGrid: { gap: 16 },
  testimGridDesktop: { flexDirection: 'row' as const, justifyContent: 'center' as const },
  testimCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  testimQuoteIcon: { marginBottom: 10 },
  testimText: { fontSize: 14, color: '#334155', lineHeight: 20, fontStyle: 'italic' as const, marginBottom: 14 },
  testimAuthor: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  testimAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center' as const, justifyContent: 'center' as const },
  testimAvatarText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  testimName: { fontSize: 13, fontWeight: '700' as const, color: '#0F172A' },
  testimRole: { fontSize: 11, color: '#64748B' },
  footer: { alignItems: 'center' as const, paddingVertical: 32, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 48 },
  footerLogo: { fontSize: 18, fontWeight: '800' as const, color: '#0F172A', marginBottom: 12 },
  footerLinks: { flexDirection: 'row' as const, gap: 6, marginBottom: 8 },
  footerLink: { fontSize: 12, color: '#64748B' },
  footerSep: { fontSize: 12, color: '#CBD5E1' },
  footerCopy: { fontSize: 11, color: '#94A3B8' },
});
