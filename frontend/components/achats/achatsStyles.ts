/**
 * components/achats/achatsStyles.ts
 * Styles partagés entre toutes les sections de l'écran Achats.
 */

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // ── Recherche & actions ──────────────────────────────────────────────────
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, outlineStyle: 'none' as never },
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
  listRowActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6 },

  // ── Fournisseurs ──────────────────────────────────────────────────────────
  supplierHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  supplierColHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  supplierRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  supplierContactText: { fontSize: 13, fontWeight: '500' },
  supplierMobileStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },
  supplierMobileStatText: { fontSize: 12 },
  supplierStatBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  supplierStatText: { fontSize: 11, fontWeight: '600' },
  supplierAmountText: { fontSize: 13, fontWeight: '600' },

  // ── États vides ───────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // ── Formulaires ───────────────────────────────────────────────────────────
  formRow: { flexDirection: 'row', gap: 12 },
  formCol: { flex: 1 },
  formFieldGroup: { gap: 10 },
  formFieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formLabel: { fontSize: 13, fontWeight: '500' },
  formLabelRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  errorBanner: { padding: 12, borderRadius: 8 },
  errorText: { fontSize: 13, fontWeight: '500' },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  selectChipText: { fontSize: 13, fontWeight: '500' },
  formPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  formPickerDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  formPickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },

  // ── Panneaux détail ───────────────────────────────────────────────────────
  detailPanel: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
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
  detailNotes: { fontSize: 12, fontStyle: 'italic' },
  detailActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  detailActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  detailActionBtnText: { fontSize: 12, fontWeight: '600' },

  // ── Résumés ───────────────────────────────────────────────────────────────
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  summaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryInfo: { flex: 1 },
  summaryValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 12, marginTop: 4, opacity: 0.7 },

  // ── Commandes ─────────────────────────────────────────────────────────────
  addLineBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  addLineBtnText: { fontSize: 12, fontWeight: '600' },
  lineItemRow: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  lineItemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineItemBottom: { flexDirection: 'row', gap: 8 },
  lineItemLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  lineInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  lineProductHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  quickCreateBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 3 },
  quickCreateBtnText: { fontSize: 11, fontWeight: '600' },
  poTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1 },
  poTotalLabel: { fontSize: 13, fontWeight: '500' },
  poTotalValue: { fontSize: 16, fontWeight: '700' },
  invoiceCreatedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, gap: 3 },
  invoiceCreatedText: { fontSize: 11, fontWeight: '600' },
  createInvoiceBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 },
  createInvoiceBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  // ── Dropdowns produits ────────────────────────────────────────────────────
  productSelectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  productSelectText: { flex: 1, fontSize: 13, fontWeight: '500' },
  productDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, maxHeight: 200, overflow: 'hidden' },
  productDropdownSearch: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 6, borderBottomWidth: 1 },
  productDropdownSearchInput: { flex: 1, fontSize: 13, outlineStyle: 'none' as never },
  productDropdownList: { maxHeight: 160 },
  productDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  productDropdownName: { fontSize: 13, fontWeight: '500' },
  productDropdownSku: { fontSize: 11, marginTop: 1 },
  productDropdownEmpty: { padding: 16, textAlign: 'center', fontSize: 13 },

  // ── Factures reçues ───────────────────────────────────────────────────────
  invoiceSummaryBar: { backgroundColor: '#F0F9FF', borderRadius: 8, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  invoiceSummaryText: { fontSize: 13, color: '#374151' },
  invoiceSummaryBold: { fontWeight: '700', color: '#1E40AF' },
  importedDocBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  importedDocText: { fontSize: 11, fontWeight: '600' },
  ocrSupplierBanner: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  ocrSupplierText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  ocrCreateSupplierBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, gap: 6, marginTop: 2 },
  ocrCreateSupplierBtnText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  ocrAttachmentBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  ocrAttachmentText: { fontSize: 13, fontWeight: '500', flex: 1 },
});