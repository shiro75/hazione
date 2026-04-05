/**
 * components/stock/stockStyles.ts
 * Styles partagés entre toutes les sections de l'écran Stock.
 */

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // ── Résumés ───────────────────────────────────────────────────────────────
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },

  // ── Filtres & tri ─────────────────────────────────────────────────────────
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '500' },

  // ── Tableau ───────────────────────────────────────────────────────────────
  tableCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  productRow: { paddingHorizontal: 16, paddingVertical: 12 },
  productRowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600' },
  productSku: { fontSize: 12, marginTop: 2 },

  // ── Barres de stock ───────────────────────────────────────────────────────
  stockBarContainer: { marginTop: 6, width: '100%', maxWidth: 120 },
  stockBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  stockBarFill: { height: 4, borderRadius: 2 },
  stockBadgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  stockTextLarge: { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, gap: 4 },
  adjustBtnText: { fontSize: 12, fontWeight: '600' },
  negativeStockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
  negativeStockBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // ── En-têtes inventaire ───────────────────────────────────────────────────
  inventoryHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  inventoryHeaderRowMobile: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 10, marginBottom: 4 },
  inventoryColHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' },

  // ── Variantes inventaire ──────────────────────────────────────────────────
  variantSubRow: { paddingHorizontal: 16, paddingVertical: 8 },
  variantDot: { width: 8, height: 8, borderRadius: 4 },
  variantAttrText: { fontSize: 12, fontWeight: '500' },
  variantStockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  variantStockText: { fontSize: 12, fontWeight: '600' },
  variantStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  variantStatusText: { fontSize: 10, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },

  // ── Mouvements ────────────────────────────────────────────────────────────
  timelineContainer: { gap: 0 },
  timelineItem: { flexDirection: 'row', minHeight: 80 },
  timelineLeft: { width: 40, alignItems: 'center' },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -4 },
  timelineContent: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, marginLeft: 8, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  timelineContentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  timelineQtyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  timelineQtyText: { fontSize: 13, fontWeight: '700' },
  timelineDate: { fontSize: 11, marginTop: 4 },
  movementRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 44, alignItems: 'center' },
  movementInfo: { flex: 1 },
  movementProduct: { fontSize: 14, fontWeight: '600' },
  movementMeta: { fontSize: 12, marginTop: 2 },
  movementNotes: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },

  // ── États vides ───────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // ── Formulaires ───────────────────────────────────────────────────────────
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },

  // ── Entrepôts ─────────────────────────────────────────────────────────────
  whAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  whAddBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  whTransferBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 6 },
  whTransferBtnText: { fontSize: 14, fontWeight: '600' },
  whCard: { borderWidth: 1, borderRadius: 14, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  whCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whCardName: { fontSize: 16, fontWeight: '700' },
  whCardAddress: { fontSize: 12, marginTop: 2 },
  whDefaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  whDefaultBadgeText: { fontSize: 10, fontWeight: '600' },
  whIconBtn: { padding: 8, borderRadius: 6 },
  whSectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  whSelectChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  whSelectChipText: { fontSize: 13, fontWeight: '500' },
});