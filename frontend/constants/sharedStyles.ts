/**
 * sharedStyles.ts
 * Shared StyleSheet presets for layout, cards, lists, buttons, detail panels,
 * tab bars, and forms. All values reference the central theme tokens.
 * Import specific style groups as needed to maintain visual consistency.
 *
 * Usage:
 *   import { layoutStyles, cardStyles, buttonStyles } from '@/constants/sharedStyles';
 */

import { StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS, SIZES, SEMANTIC_COLORS } from './theme';

export const layoutStyles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { padding: SPACING['6XL'], gap: SPACING.XXXL },
  formRow: { flexDirection: 'row' as const, gap: SPACING.XL },
  formCol: { flex: 1 },
  searchRow: { flexDirection: 'row' as const, gap: SPACING.LG, alignItems: 'center' as const },
  mainContent: { flex: 1, flexDirection: 'row' as const, gap: SPACING.XXXL },
});

export const cardStyles = StyleSheet.create({
  tableCard: {
    borderWidth: 1,
    borderRadius: RADIUS.XXL,
    overflow: 'hidden' as const,
    ...SHADOWS.LG,
  },
  summaryRow: { flexDirection: 'row' as const, gap: SPACING.XL },
  summaryCard: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: RADIUS.XXL,
    padding: SPACING['4XL'],
    gap: SPACING.XXL,
    ...SHADOWS.LG,
  },
  summaryIcon: {
    width: SIZES.CARD.SUMMARY_ICON,
    height: SIZES.CARD.SUMMARY_ICON,
    borderRadius: SIZES.CARD.SUMMARY_ICON_RADIUS,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryInfo: { flex: 1 },
  summaryValue: {
    fontSize: TYPOGRAPHY.SIZE.DISPLAY,
    fontWeight: TYPOGRAPHY.WEIGHT.EXTRABOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.TIGHT,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    marginTop: SPACING.XS,
    opacity: 0.7,
  },
});

export const listStyles = StyleSheet.create({
  listRow: {
    paddingHorizontal: SPACING.XXXL,
    paddingVertical: SPACING.XXL,
  },
  listRowMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.LG,
  },
  listRowInfo: { flex: 1 },
  listRowTitle: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  listRowSub: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    marginTop: SPACING.XXS,
  },
  listRowValue: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  listRowActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.SM,
  },
});

export const buttonStyles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.XXXL,
    paddingVertical: SPACING.LG,
    borderRadius: RADIUS.MD,
    gap: SPACING.SM,
  },
  addBtnText: {
    color: SEMANTIC_COLORS.WHITE,
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  iconBtn: {
    padding: SPACING.SM,
    borderRadius: RADIUS.SM,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.LG,
    borderRadius: RADIUS.MD,
    gap: SPACING.SM,
    flex: 1,
    justifyContent: 'center' as const,
  },
  actionBtnText: {
    color: SEMANTIC_COLORS.WHITE,
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});

export const detailStyles = StyleSheet.create({
  detailPanel: {
    width: SIZES.DETAIL_PANEL.WIDTH,
    borderWidth: 1,
    borderRadius: RADIUS.XL,
    padding: SPACING['6XL'],
  },
  detailHeader: {
    alignItems: 'center' as const,
    marginBottom: SPACING['5XL'],
  },
  detailIcon: {
    width: SIZES.CARD.DETAIL_ICON,
    height: SIZES.CARD.DETAIL_ICON,
    borderRadius: SIZES.CARD.DETAIL_ICON_RADIUS,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: SPACING.XL,
  },
  detailNum: {
    fontSize: TYPOGRAPHY.SIZE.TITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  detailDivider: { height: 1, marginBottom: SPACING.XXXL },
  detailSection: { marginBottom: SPACING['5XL'] },
  sectionTitle: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDEST,
    marginBottom: SPACING.MD,
  },
  detailText: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  lineItem: { marginBottom: SPACING.LG },
  lineProduct: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  lineDetail: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    marginTop: SPACING.XXS,
  },
  lineTotal: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    marginTop: SPACING.XXS,
  },
  totalSection: {
    borderWidth: 1,
    borderRadius: RADIUS.MD,
    padding: SPACING.XXL,
    marginBottom: SPACING['5XL'],
    gap: SPACING.SM,
  },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  totalRowFinal: {
    borderTopWidth: 1,
    paddingTop: SPACING.MD,
    marginTop: SPACING.XS,
  },
  totalRowLabel: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL },
  totalRowValue: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  totalRowLabelBold: {
    fontSize: TYPOGRAPHY.SIZE.BODY,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  totalRowValueBold: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});

export const tabBarStyles = StyleSheet.create({
  tabBarWrapper: {
    paddingHorizontal: SPACING['6XL'],
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.XS,
  },
  tabBar: { gap: SPACING.MD },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.XXXL,
    paddingVertical: 9,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    gap: SPACING.MD,
  },
  tabText: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});

export const formStyles = StyleSheet.create({
  formSection: { gap: SPACING.XL },
  formSectionTitle: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    letterSpacing: TYPOGRAPHY.LETTER_SPACING.WIDEST,
  },
  errorBanner: { padding: SPACING.XL, borderRadius: RADIUS.MD },
  errorText: {
    fontSize: TYPOGRAPHY.SIZE.BODY_SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
});
