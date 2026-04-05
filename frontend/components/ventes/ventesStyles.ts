/**
 * components/ventes/ventesStyles.ts
 *
 * Styles partagés entre toutes les sections de l'écran Ventes.
 * Centralisés ici pour éviter la duplication dans chaque fichier.
 */

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // ── Recherche & actions ──────────────────────────────────────────────────
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  iconActionBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // ── Tri & filtres ────────────────────────────────────────────────────────
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '500' },

  // ── Tableau / liste ──────────────────────────────────────────────────────
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  listRow: { paddingHorizontal: 16, paddingVertical: 14 },
  listRowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listRowInfo: { flex: 1 },
  listRowTitle: { fontSize: 14, fontWeight: '600' },
  listRowSub: { fontSize: 12, marginTop: 2 },
  listRowValue: { fontSize: 14, fontWeight: '600' },
  listRowActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  iconBtn: { padding: 6, borderRadius: 6 },

  // ── Clients ───────────────────────────────────────────────────────────────
  clientHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  clientColHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  clientRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  clientContactText: { fontSize: 13, fontWeight: '500' },
  clientStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  clientStatText: { fontSize: 11, fontWeight: '600' },
  clientRevenueText: { fontSize: 13, fontWeight: '600' },
  clientMobileStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  clientMobileStatText: { fontSize: 12 },

  // ── États vides ───────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, marginTop: 8 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // ── Formulaires ───────────────────────────────────────────────────────────
  formRow: { flexDirection: 'row', gap: 12 },
  formCol: { flex: 1 },
  formSection: { gap: 12 },
  formSectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' },
  discountBanner: { padding: 10, borderRadius: 8, borderWidth: 1, marginVertical: 4 },
  deliveryToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },

  // ── Panneaux détail ───────────────────────────────────────────────────────
  detailPanel: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailHeaderTitle: { fontSize: 15, fontWeight: '700' },
  detailInfoRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  detailInfoCol: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 13, fontWeight: '500' },
  detailSectionTitle: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  detailLineItem: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  detailLineName: { fontSize: 13, fontWeight: '600' },
  detailLineMeta: { fontSize: 11 },
  detailLineTotal: { fontSize: 13, fontWeight: '600' },
  detailTotals: { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  detailTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailTotalLabel: { fontSize: 13 },
  detailTotalValue: { fontSize: 13 },
  detailTotalRowMain: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  detailTotalLabelMain: { fontSize: 15, fontWeight: '700' },
  detailTotalValueMain: { fontSize: 16, fontWeight: '800' },
  detailNotes: { fontSize: 12, fontStyle: 'italic' },
  detailActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  detailActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  detailActionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // ── Badges & indicateurs ──────────────────────────────────────────────────
  convertedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 3 },
  convertedBadgeText: { fontSize: 11, fontWeight: '600' },
  partialBanner: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  summaryBar: { borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1 },
  summaryBarText: { fontSize: 13, color: '#374151' },
  summaryBarBold: { fontWeight: '700', color: '#1E40AF' },

  // ── Résumés ───────────────────────────────────────────────────────────────
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  summaryTotal: { fontSize: 16, fontWeight: '700' },

  // ── Relances ──────────────────────────────────────────────────────────────
  reminderLevel: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  reminderActions: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  reminderActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 4 },
  reminderActionLabel: { fontSize: 11, fontWeight: '600' },

  // ── Email ─────────────────────────────────────────────────────────────────
  emailField: { gap: 6 },
  emailFieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  emailFieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  emailBodyField: { height: 160, textAlignVertical: 'top' },

  // ── Historique ────────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodBadgeText: { fontSize: 11, fontWeight: '500' },

  // ── Boutons ───────────────────────────────────────────────────────────────
  validateBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  validateBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
});