import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  useWindowDimensions, Platform,
} from 'react-native';
import Svg, {
  Path, Defs, LinearGradient, Stop, Line, Circle, G,
  Text as SvgText, Rect,
} from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { formatCurrencyInteger } from '@/utils/format';
import ActionableEmptyState from '@/components/ActionableEmptyState';
import { LegendRow } from '@/components/charts/DashboardCharts';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

const COLOR_REVENUE = '#3B82F6';
const COLOR_EXPENSES = '#EF4444';
const COLOR_PROFIT = '#059669';
const COLOR_LOSS = '#DC2626';

interface MonthData {
  label: string;
  revenue: number;
  expenses: number;
  margin: number;
}

function compact(v: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : '';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k${suffix}`;
  return `${Math.round(v)}${suffix}`;
}

function buildSmoothPath(
  data: number[],
  chartW: number,
  chartH: number,
  min: number,
  max: number,
): { points: { x: number; y: number }[]; path: string } {
  if (data.length < 2) return { points: [], path: '' };
  const range = max - min || 1;
  const stepX = chartW / (data.length - 1);
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: chartH - ((v - min) / range) * chartH,
  }));
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    path += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return { points, path };
}

function buildSegmentZones(
  revData: number[],
  expData: number[],
  chartW: number,
  chartH: number,
  min: number,
  max: number,
): { profitPaths: string[]; lossPaths: string[] } {
  if (revData.length < 2) return { profitPaths: [], lossPaths: [] };
  const range = max - min || 1;
  const stepX = chartW / (revData.length - 1);
  const profitPaths: string[] = [];
  const lossPaths: string[] = [];

  for (let i = 0; i < revData.length - 1; i++) {
    const x0 = i * stepX;
    const x1 = (i + 1) * stepX;
    const cpX = (x0 + x1) / 2;

    const ry0 = chartH - ((revData[i] - min) / range) * chartH;
    const ry1 = chartH - ((revData[i + 1] - min) / range) * chartH;
    const ey0 = chartH - ((expData[i] - min) / range) * chartH;
    const ey1 = chartH - ((expData[i + 1] - min) / range) * chartH;

    let seg = `M ${x0} ${ry0}`;
    seg += ` C ${cpX} ${ry0} ${cpX} ${ry1} ${x1} ${ry1}`;
    seg += ` L ${x1} ${ey1}`;
    seg += ` C ${cpX} ${ey1} ${cpX} ${ey0} ${x0} ${ey0}`;
    seg += ' Z';

    const avgRev = (revData[i] + revData[i + 1]) / 2;
    const avgExp = (expData[i] + expData[i + 1]) / 2;
    if (avgRev >= avgExp) {
      profitPaths.push(seg);
    } else {
      lossPaths.push(seg);
    }
  }

  return { profitPaths, lossPaths };
}

interface RevenueVsExpensesChartProps {
  currency?: string;
}

export default React.memo(function RevenueVsExpensesChart({
  currency = 'XOF',
}: RevenueVsExpensesChartProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { sales, invoices, activeSupplierInvoices, cashMovements, activeExpenses } = useData();
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const chartContainerWidth = isMobile ? screenWidth - 48 : 480;

  const COMPANY_ID = user?.id ?? 'anonymous';

  const { data: supabaseMonthly, isLoading } = useQuery({
    queryKey: ['revenue-vs-expenses-6m', COMPANY_ID],
    queryFn: async (): Promise<MonthData[]> => {
      if (!isSupabaseConfigured) return [];

      const now = new Date();
      const months: MonthData[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
        const dISO = d.toISOString();
        const eISO = end.toISOString();

        let revenue = 0;
        let expenses = 0;

        try {
          const { data: salesData } = await supabase
            .from('sales')
            .select('total_ttc')
            .eq('company_id', COMPANY_ID)
            .eq('status', 'paid')
            .gte('created_at', dISO)
            .lt('created_at', eISO);

          if (salesData) {
            revenue = salesData.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);
          }
        } catch (e) {
          console.log('[RevenueVsExpenses] sales fetch error for', label, e);
        }

        try {
          const { data: invoicesData } = await supabase
            .from('invoices')
            .select('total_ttc')
            .eq('company_id', COMPANY_ID)
            .eq('status', 'paid')
            .gte('issue_date', dISO)
            .lt('issue_date', eISO);

          if (invoicesData) {
            revenue += invoicesData.reduce((sum, row) => sum + (Number(row.total_ttc) || 0), 0);
          }
        } catch (e) {
          console.log('[RevenueVsExpenses] invoices fetch error for', label, e);
        }

        try {
          const { data: expData } = await supabase
            .from('expenses')
            .select('amount')
            .eq('company_id', COMPANY_ID)
            .in('status', ['approved', 'paid'])
            .gte('date', dISO)
            .lt('date', eISO);

          if (expData) {
            expenses = expData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
          }
        } catch (e) {
          console.log('[RevenueVsExpenses] expenses fetch error for', label, e);
        }

        try {
          const { data: siData } = await supabase
            .from('supplier_invoices')
            .select('total')
            .eq('company_id', COMPANY_ID)
            .gte('date', dISO)
            .lt('date', eISO);

          if (siData) {
            expenses += siData.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
          }
        } catch (e) {
          console.log('[RevenueVsExpenses] supplier_invoices fetch error for', label, e);
        }

        try {
          const { data: cmData } = await supabase
            .from('cash_movements')
            .select('amount')
            .eq('company_id', COMPANY_ID)
            .eq('type', 'expense')
            .is('source_type', null)
            .gte('date', dISO)
            .lt('date', eISO);

          if (cmData) {
            expenses += cmData.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
          }
        } catch (e) {
          console.log('[RevenueVsExpenses] cash_movements fetch error for', label, e);
        }

        months.push({ label, revenue, expenses, margin: revenue - expenses });
      }

      console.log('[RevenueVsExpenses] Supabase data loaded:', months);
      return months;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isSupabaseConfigured && COMPANY_ID !== 'anonymous',
  });

  const fallbackData = useMemo((): MonthData[] => {
    const now = new Date();
    const convertedIds = new Set(
      sales.filter(s => s.convertedToInvoiceId).map(s => s.convertedToInvoiceId!)
    );
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      const dISO = d.toISOString();
      const eISO = end.toISOString();

      const invRev = invoices
        .filter(inv => inv.status === 'paid' && inv.issueDate >= dISO && inv.issueDate < eISO)
        .reduce((s, inv) => s + inv.totalTTC, 0);
      const saleRev = sales
        .filter(s2 => s2.status === 'paid' && s2.createdAt >= dISO && s2.createdAt < eISO &&
          (!s2.convertedToInvoiceId || !convertedIds.has(s2.convertedToInvoiceId)))
        .reduce((s3, sale) => s3 + sale.totalTTC, 0);

      const exp = activeSupplierInvoices
        .filter(si => si.date >= dISO && si.date < eISO)
        .reduce((s, si) => s + (si.total || 0), 0);
      const cashExp = cashMovements
        .filter(cm => cm.type === 'expense' && cm.date >= dISO && cm.date < eISO && !cm.sourceType)
        .reduce((s, cm) => s + cm.amount, 0);
      const compExp = activeExpenses
        .filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= dISO && e.date < eISO)
        .reduce((s, e) => s + e.amount, 0);

      const revenue = invRev + saleRev;
      const expenses = exp + cashExp + compExp;
      return { label, revenue, expenses, margin: revenue - expenses };
    });
  }, [sales, invoices, activeSupplierInvoices, cashMovements, activeExpenses]);

  const monthlyData = supabaseMonthly && supabaseMonthly.length > 0 ? supabaseMonthly : fallbackData;

  const monthsWithData = useMemo(
    () => monthlyData.filter(m => m.revenue > 0 || m.expenses > 0).length,
    [monthlyData]
  );
  const isEmpty = monthsWithData === 0;
  const isSparse = monthsWithData > 0 && monthsWithData < 2;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleTap = useCallback((idx: number) => {
    setSelectedIndex(prev => (prev === idx ? null : idx));
  }, []);

  const paddingLeft = 48;
  const paddingBottom = 32;
  const paddingTop = 16;
  const paddingRight = 12;
  const chartW = chartContainerWidth - paddingLeft - paddingRight;
  const chartH = 180;
  const svgH = chartH + paddingBottom + paddingTop;

  const { revPath, expPath, revPoints, expPoints, gridLines, stepX, profitPaths, lossPaths, max } = useMemo(() => {
    const revData = monthlyData.map(m => m.revenue);
    const expData = monthlyData.map(m => m.expenses);
    const allVals = [...revData, ...expData];
    const rawMax = Math.max(...allVals, 1);
    const computedMax = rawMax * 1.2;
    const computedMin = 0;

    const rev = buildSmoothPath(revData, chartW, chartH, computedMin, computedMax);
    const exp = buildSmoothPath(expData, chartW, chartH, computedMin, computedMax);
    const zones = buildSegmentZones(revData, expData, chartW, chartH, computedMin, computedMax);

    const lines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
      y: chartH - ratio * chartH,
      label: compact(computedMin + ratio * computedMax, '€'),
    }));

    const sX = revData.length > 1 ? chartW / (revData.length - 1) : 0;

    return {
      revPath: rev.path,
      expPath: exp.path,
      revPoints: rev.points,
      expPoints: exp.points,
      gridLines: lines,
      stepX: sX,
      profitPaths: zones.profitPaths,
      lossPaths: zones.lossPaths,
      max: computedMax,
    };
  }, [monthlyData, chartW, chartH]);

  const avgLine = useMemo(() => {
    const revData = monthlyData.map(m => m.revenue);
    const nonZero = revData.filter(v => v > 0);
    if (nonZero.length === 0) return null;
    const avg = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
    const y = chartH - (avg / max) * chartH;
    return { y, value: avg };
  }, [monthlyData, chartH, max]);

  if (isEmpty || isSparse) {
    return (
      <View style={[chartStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={chartStyles.cardHeaderRow}>
          <View>
            <Text style={[chartStyles.cardTitle, { color: colors.text }]}>CA vs Dépenses</Text>
            <Text style={[chartStyles.cardSubtitle, { color: colors.textTertiary }]}>
              Évolution sur 6 mois glissants
            </Text>
          </View>
        </View>
        <ActionableEmptyState
          icon="wallet"
          message={
            isEmpty
              ? "Enregistrez au moins 2 mois de ventes et de dépenses pour voir l'évolution"
              : "Il faut au moins 2 mois de données pour afficher le graphique"
          }
          ctaLabel="Ajouter une dépense"
          onCtaPress={() => router.push('/cashflow')}
        />
      </View>
    );
  }

  const selectedMonth = selectedIndex !== null ? monthlyData[selectedIndex] : null;

  return (
    <View style={[chartStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={chartStyles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[chartStyles.cardTitle, { color: colors.text }]}>CA vs Dépenses</Text>
          <Text style={[chartStyles.cardSubtitle, { color: colors.textTertiary }]}>
            Évolution sur 6 mois glissants
          </Text>
        </View>
        <LegendRow
          items={[
            { color: COLOR_REVENUE, label: 'CA' },
            { color: COLOR_EXPENSES, label: 'Dépenses' },
          ]}
          textColor={colors.textSecondary}
        />
      </View>

      {selectedMonth && selectedIndex !== null && (
        <View style={[chartStyles.tooltip, {
          backgroundColor: colors.text === '#FFFFFF' ? '#1F2937' : '#111827',
        }]}>
          <Text style={chartStyles.tooltipTitle}>{selectedMonth.label.toUpperCase()}</Text>
          <View style={chartStyles.tooltipRow}>
            <View style={[chartStyles.tooltipDot, { backgroundColor: COLOR_REVENUE }]} />
            <Text style={chartStyles.tooltipLabel}>CA</Text>
            <Text style={chartStyles.tooltipValue}>{formatCurrencyInteger(selectedMonth.revenue, currency)}</Text>
          </View>
          <View style={chartStyles.tooltipRow}>
            <View style={[chartStyles.tooltipDot, { backgroundColor: COLOR_EXPENSES }]} />
            <Text style={chartStyles.tooltipLabel}>Dépenses</Text>
            <Text style={chartStyles.tooltipValue}>{formatCurrencyInteger(selectedMonth.expenses, currency)}</Text>
          </View>
          <View style={[chartStyles.tooltipDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
          <View style={chartStyles.tooltipRow}>
            <View style={[chartStyles.tooltipDot, { backgroundColor: selectedMonth.margin >= 0 ? COLOR_PROFIT : COLOR_LOSS }]} />
            <Text style={chartStyles.tooltipLabel}>Marge</Text>
            <Text style={[chartStyles.tooltipValue, {
              color: selectedMonth.margin >= 0 ? '#34D399' : '#FCA5A5',
            }]}>
              {selectedMonth.margin >= 0 ? '+' : ''}{formatCurrencyInteger(selectedMonth.margin, currency)}
            </Text>
          </View>
        </View>
      )}

      <View style={{ marginTop: SPACING.MD }}>
        <Svg width={chartContainerWidth} height={svgH}>
          <Defs>
            <LinearGradient id="gradRevRvsE" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLOR_REVENUE} stopOpacity="0.18" />
              <Stop offset="1" stopColor={COLOR_REVENUE} stopOpacity="0.02" />
            </LinearGradient>
            <LinearGradient id="gradExpRvsE" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLOR_EXPENSES} stopOpacity="0.12" />
              <Stop offset="1" stopColor={COLOR_EXPENSES} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
            {gridLines.map((gl, i) => (
              <G key={`grid-${i}`}>
                <Line
                  x1={0} y1={gl.y} x2={chartW} y2={gl.y}
                  stroke={colors.border || '#E5E7EB'}
                  strokeWidth={0.7}
                  strokeDasharray="3,3"
                />
                <SvgText
                  x={-6} y={gl.y + 3}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  {gl.label}
                </SvgText>
              </G>
            ))}

            {profitPaths.map((p, i) => (
              <Path key={`profit-${i}`} d={p} fill={COLOR_PROFIT} opacity={0.12} />
            ))}
            {lossPaths.map((p, i) => (
              <Path key={`loss-${i}`} d={p} fill={COLOR_LOSS} opacity={0.12} />
            ))}

            {expPath ? (
              <Path
                d={expPath}
                stroke={COLOR_EXPENSES}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6,3"
              />
            ) : null}
            {revPath ? (
              <Path
                d={revPath}
                stroke={COLOR_REVENUE}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {avgLine && (
              <>
                <Line
                  x1={0} y1={avgLine.y} x2={chartW} y2={avgLine.y}
                  stroke={COLOR_REVENUE}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.35}
                />
                <SvgText
                  x={chartW} y={avgLine.y - 5}
                  fontSize={8}
                  fill={COLOR_REVENUE}
                  textAnchor="end"
                  fontWeight="600"
                  opacity={0.6}
                >
                  Moy. {compact(avgLine.value, '€')}
                </SvgText>
              </>
            )}

            {revPoints.map((pt, i) => {
              const isSelected = selectedIndex === i;
              return (
                <G key={`rev-pt-${i}`}>
                  <Circle
                    cx={pt.x} cy={pt.y}
                    r={isSelected ? 5 : 3.5}
                    fill={isSelected ? COLOR_REVENUE : '#fff'}
                    stroke={COLOR_REVENUE}
                    strokeWidth={isSelected ? 2.5 : 2}
                  />
                </G>
              );
            })}
            {expPoints.map((pt, i) => {
              const isSelected = selectedIndex === i;
              return (
                <G key={`exp-pt-${i}`}>
                  <Circle
                    cx={pt.x} cy={pt.y}
                    r={isSelected ? 4 : 2.5}
                    fill={isSelected ? COLOR_EXPENSES : '#fff'}
                    stroke={COLOR_EXPENSES}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                </G>
              );
            })}

            {selectedIndex !== null && revPoints[selectedIndex] && (
              <Line
                x1={revPoints[selectedIndex].x}
                y1={0}
                x2={revPoints[selectedIndex].x}
                y2={chartH}
                stroke={colors.textTertiary}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.4}
              />
            )}

            {monthlyData.map((m, i) => (
              <SvgText
                key={`lbl-${i}`}
                x={i * stepX}
                y={chartH + 16}
                fontSize={10}
                fill={selectedIndex === i ? colors.text : colors.textTertiary}
                textAnchor="middle"
                fontWeight={selectedIndex === i ? '700' : '500'}
              >
                {m.label}
              </SvgText>
            ))}

            {monthlyData.map((m, i) => {
              const isProfit = m.margin >= 0;
              return (
                <SvgText
                  key={`margin-${i}`}
                  x={i * stepX}
                  y={chartH + 28}
                  fontSize={8}
                  fill={isProfit ? COLOR_PROFIT : COLOR_LOSS}
                  textAnchor="middle"
                  fontWeight="600"
                  opacity={0.8}
                >
                  {isProfit ? '+' : ''}{compact(m.margin)}
                </SvgText>
              );
            })}

            {monthlyData.map((_, i) => (
              <Rect
                key={`hit-${i}`}
                x={i * stepX - (stepX / 2)}
                y={0}
                width={stepX}
                height={chartH + paddingBottom}
                fill="transparent"
                onPress={() => handleTap(i)}
              />
            ))}
          </G>
        </Svg>
      </View>

      {Platform.OS === 'web' && (
        <View style={chartStyles.tapHintRow}>
          {monthlyData.map((m, i) => (
            <Pressable
              key={`tap-${i}`}
              style={[
                chartStyles.tapTarget,
                { flex: 1 },
                selectedIndex === i && { backgroundColor: `${colors.primary}08` },
              ]}
              onPress={() => handleTap(i)}
            >
              <Text style={[
                chartStyles.tapLabel,
                { color: selectedIndex === i ? colors.text : 'transparent' },
              ]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isLoading && (
        <View style={chartStyles.loadingOverlay}>
          <Text style={[chartStyles.loadingText, { color: colors.textTertiary }]}>
            Chargement des données...
          </Text>
        </View>
      )}
    </View>
  );
});

const chartStyles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    padding: SPACING.XXXL,
    marginBottom: SPACING.XL,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: SPACING.SM,
    gap: SPACING.MD,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.SIZE.SUBTITLE,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.SIZE.SMALL,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
    marginTop: 2,
  },
  tooltip: {
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.LG,
    marginTop: SPACING.MD,
    gap: 6,
  },
  tooltipTitle: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  tooltipRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  tooltipDivider: {
    height: 1,
    marginVertical: 2,
  },
  tapHintRow: {
    flexDirection: 'row' as const,
    marginTop: -4,
    paddingHorizontal: 4,
  },
  tapTarget: {
    alignItems: 'center' as const,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tapLabel: {
    fontSize: 9,
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: RADIUS.LG,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
