/**
 * @fileoverview Styles for the POS (Point of Sale) screen and its sub-components.
 * Extracted from sales.tsx for maintainability.
 */

import { StyleSheet, Platform } from 'react-native';

const salesStyles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 24 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 6, marginBottom: -1 },

  splitLayout: { flex: 1, flexDirection: 'row' },
  cartPanel: { width: '32%' as unknown as number, minWidth: 280, borderLeftWidth: 1, flexDirection: 'column' },
  productsPanel: { flex: 1 },

  productsSection: { flex: 1, paddingHorizontal: 12, paddingTop: 4, gap: 0 },
  posSearchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 2 },
  posSearchInput: { flex: 1, fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },

  categoryTabs: { flexDirection: 'row', gap: 5, paddingBottom: 0, paddingHorizontal: 1 },
  categoryTab: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, height: 28, justifyContent: 'center' as const },
  categoryTabText: { fontSize: 11, fontWeight: '600' as const },

  quickActions: { flexDirection: 'row', gap: 6, marginTop: 2, marginBottom: 0 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  quickBtnText: { fontSize: 12, fontWeight: '600' as const },
  barcodeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, gap: 5 },
  barcodeInput: { flex: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  barcodeOkBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  productGridContent: { paddingBottom: 80, gap: 0, paddingTop: 4 },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
    alignItems: 'flex-start' as const,
  },
  productTile: { borderRadius: 12, overflow: 'hidden' as const, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  tileImage: { width: '100%' as unknown as number, height: 56 },
  tileImageLarge: { width: '100%' as unknown as number, height: 80 },
  tilePlaceholder: { width: '100%' as unknown as number, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  tilePlaceholderLarge: { width: '100%' as unknown as number, height: 64, alignItems: 'center' as const, justifyContent: 'center' as const },

  viewToggle: { flexDirection: 'row', gap: 2, marginLeft: 4 },
  viewToggleBtn: { width: 28, height: 28, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 6 },

  categoryGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 6, marginBottom: 4 },
  categoryGroupHeaderText: { fontSize: 12, fontWeight: '700' as const, flex: 1 },
  categoryGroupHeaderCount: { fontSize: 11, fontWeight: '500' as const },

  listContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' as const, marginBottom: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  listThumb: { width: 38, height: 38, borderRadius: 8 },
  listThumbPlaceholder: { width: 38, height: 38, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  listName: { fontSize: 13, fontWeight: '600' as const },
  listPrice: { fontSize: 13, fontWeight: '800' as const },
  listStock: { fontSize: 11, fontWeight: '500' as const, minWidth: 30, textAlign: 'right' as const },
  tileOutOfStock: { opacity: 0.45 },
  tileRuptureBadge: { position: 'absolute' as const, top: 4, right: 4, backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tileRuptureBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '700' as const, letterSpacing: 0.3 },
  tileCartBadge: { position: 'absolute' as const, top: 6, right: 6, backgroundColor: '#3B82F6', width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  tileCartBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  tileVariantBadge: { position: 'absolute' as const, top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  tileBody: { padding: 6, gap: 1 },
  tileName: { fontSize: 11, fontWeight: '600' as const, lineHeight: 15 },
  tileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' as const, marginTop: 2 },
  tilePrice: { fontSize: 15, fontWeight: '800' as const },
  tileStockSmall: { fontSize: 9, fontWeight: '500' as const },

  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  cartHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartTitle: { fontSize: 16, fontWeight: '700' as const },
  clientSelector: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 6, marginBottom: 4 },
  clientSelectorText: { flex: 1, fontSize: 13 },
  clientDropdown: { marginHorizontal: 16, borderRadius: 10, borderWidth: 1, maxHeight: 200, marginBottom: 6, overflow: 'hidden' as const },
  clientDropdownSearch: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderBottomWidth: 1, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  clientDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },

  cartList: { flex: 1, paddingHorizontal: 12 },
  cartEmpty: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },
  cartEmptyText: { fontSize: 14, fontWeight: '500' as const },
  cartEmptyHint: { fontSize: 12 },
  cartItem: { paddingVertical: 12, borderBottomWidth: 1 },
  cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cartItemName: { fontSize: 13, fontWeight: '600' as const, flex: 1, marginRight: 8 },
  cartItemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyText: { fontSize: 16, fontWeight: '700' as const, minWidth: 24, textAlign: 'center' as const },
  cartItemTotal: { fontSize: 15, fontWeight: '700' as const },

  cartFooter: { borderTopWidth: 1, padding: 12 },
  totalsBlock: { marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },

  receiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 6, marginTop: 8 },
  receiptBtnText: { fontSize: 13, fontWeight: '600' as const },

  floatingCartBtn: { position: 'absolute' as const, bottom: 20, right: 20, left: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  floatingCartBadge: { backgroundColor: '#FFF', width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  floatingCartBadgeText: { fontSize: 13, fontWeight: '800' as const, color: '#3B82F6' },
  floatingCartTotal: { color: '#FFF', fontSize: 17, fontWeight: '700' as const },

  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end' as const },
  bottomSheetBackdrop: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { maxHeight: '85%' as unknown as number, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  bottomSheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' as const, marginBottom: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const },
  paymentModal: { borderRadius: 16, maxHeight: '90%' as unknown as number, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12, overflow: 'hidden' as const },
  paymentModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  paymentModalTitle: { fontSize: 18, fontWeight: '700' as const },
  paymentModalFooter: { padding: 20, borderTopWidth: 1 },

  paymentRecap: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 4 },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentMethodBtn: { width: '30%' as unknown as number, flexGrow: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  paymentClientBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 8 },

  cashCalcSection: { padding: 16, borderRadius: 12, borderWidth: 1 },
  cashInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600' as const, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  cardConfirmBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  cardConfirmCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const },
  cashQuickBtns: { flexDirection: 'row', gap: 8 },
  cashQuickBtn: { flex: 1, alignItems: 'center' as const, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  changeDisplay: { padding: 16, borderRadius: 10, alignItems: 'center' as const, gap: 4 },

  validateSaleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 10 },
  validateSaleBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },

  vatChip: { flex: 1, alignItems: 'center' as const, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },

  variantModal: { borderRadius: 16, maxHeight: '80%' as unknown as number, overflow: 'hidden' as const },
  variantOption: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  historyContainer: { padding: 20, gap: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  historySearchBar: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dateFilters: { flexDirection: 'row', gap: 6 },
  dateFilterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  salesTable: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' as const, maxHeight: 600 },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  thCell: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#6B7280' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  mobileCard: { padding: 14, borderBottomWidth: 1 },
  saleDetail: { padding: 16, borderBottomWidth: 1 },
  actionBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center' as const, justifyContent: 'center' as const },
  mobileActionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },

  emptyState: { alignItems: 'center' as const, paddingVertical: 40, gap: 8 },

  saleFormError: { padding: 12, borderRadius: 8 },
  saleFormClientBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, gap: 8 },
  saleFormDropdown: { borderRadius: 10, borderWidth: 1, maxHeight: 200, overflow: 'hidden' as const },
  saleFormDropdownSearch: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderBottomWidth: 1, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  saleFormDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  saleFormPaymentBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, gap: 6 },
  saleFormProductSearch: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  saleFormProductInput: { flex: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  saleFormItem: { borderWidth: 1, borderRadius: 10, padding: 12 },
  saleFormQtyBtn: { width: 26, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },

  assignOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, alignItems: 'center' as const, zIndex: 1000 },
  assignModal: { width: 340, maxHeight: 420, borderRadius: 14, borderWidth: 1, overflow: 'hidden' as const },
  assignSearch: { marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, fontSize: 13, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) },
  assignItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  assignBtn: { margin: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' as const },
  mixedMethodChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, gap: 4 },
  expandedVariantRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, gap: 12, flexWrap: 'nowrap' as const },
  cinetpayBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, gap: 12 },
});

export default salesStyles;
