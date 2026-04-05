/**
 * components/settings/settingsStyles.ts
 * Styles partagés entre toutes les sections de l'écran Paramètres.
 */

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────────────────
  container: { flex: 1 },
  body: { flex: 1 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarInner: { flexDirection: 'row', gap: 0 },
  tabItemUnified: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabelUnified: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1 },
  contentInner: { padding: 24 },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: { borderWidth: 1, borderRadius: 12, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  bankingSubSection: { borderTopWidth: 1, paddingTop: 20, marginTop: 20 },

  // ── Champs formulaire ─────────────────────────────────────────────────────
  fieldsGrid: { flexDirection: 'row', gap: 16 },
  fieldGroup: { flex: 1, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },

  // ── Toggles ───────────────────────────────────────────────────────────────
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, marginBottom: 8 },
  switchInfo: { flex: 1, marginRight: 16 },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },

  // ── Boîtes d'information ──────────────────────────────────────────────────
  infoBox: { borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 8, marginBottom: 16, borderLeftWidth: 3, flexDirection: 'row', gap: 12 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 12, lineHeight: 18 },

  // ── TVA ───────────────────────────────────────────────────────────────────
  vatRatesSection: { marginTop: 8 },
  vatRatesTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  vatRatesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vatRateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  vatRateText: { fontSize: 13, fontWeight: '500' },
  vatRateDesc: { fontSize: 10, marginTop: 2 },

  // ── Relances ──────────────────────────────────────────────────────────────
  reminderDays: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reminderDayChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  reminderDayText: { fontSize: 14, fontWeight: '600' },

  // ── E-facturation ─────────────────────────────────────────────────────────
  readinessCard: { borderWidth: 1, borderRadius: 10, padding: 20, marginBottom: 16 },
  readinessTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  readinessList: { gap: 10 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessLabel: { flex: 1, fontSize: 13 },
  readinessStatus: { fontSize: 12, fontWeight: '600' },

  // ── Modules ───────────────────────────────────────────────────────────────
  modulesList: { gap: 0 },
  moduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  moduleInfo: { flex: 1, marginRight: 16 },
  moduleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  moduleName: { fontSize: 14, fontWeight: '600' },
  moduleTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  moduleTagText: { fontSize: 10, fontWeight: '600' },
  moduleDesc: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  modulePlanBadges: { flexDirection: 'row', gap: 4 },
  modulePlanBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  modulePlanBadgeText: { fontSize: 10, fontWeight: '500' },

  // ── Boutons sauvegarde ────────────────────────────────────────────────────
  sectionSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, gap: 8, marginTop: 20 },
  sectionSaveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },

  // ── Mentions légales ──────────────────────────────────────────────────────
  legalSection: { borderWidth: 1, borderRadius: 12, padding: 20 },
  legalSectionTitle: { fontSize: 15, fontWeight: '700' },
  legalLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1 },
  legalLinkText: { fontSize: 14, fontWeight: '500' },

  // ── Zone de danger ────────────────────────────────────────────────────────
  dangerSection: { borderWidth: 1, borderRadius: 12, padding: 20, marginTop: 8 },
  dangerSectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  dangerSectionDesc: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1.5 },
  deleteAccountText: { fontSize: 14, fontWeight: '600' },


  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { width: '100%' as any, maxWidth: 440, borderRadius: 16, padding: 28 },
  iconContainer: { alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  confirmLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  confirmInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '600', letterSpacing: 2, marginBottom: 20 },
  passwordError: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  deleteText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

});