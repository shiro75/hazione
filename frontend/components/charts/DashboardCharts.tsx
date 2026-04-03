/**
 * DashboardCharts.tsx
 *
 * Composants graphiques natifs React Native / Web pour le dashboard HaziOne.
 * Tous ces composants sont construits avec des primitives View/Text/SVG pures,
 * sans dependance externe a une librairie de charts, pour garantir
 * la compatibilite web + mobile (Expo Router).
 *
 * Composants exportes :
 *   - AreaChart         : graphe aire pour CA vs Depenses sur 6 mois
 *   - HorizontalBarChart: barres horizontales pour Marge par categorie
 *   - WeekHeatmap       : heatmap jours de la semaine / tranches horaires
 *   - TreasuryLineChart : ligne continue pour evolution du solde de tresorerie
 *   - ProjectionBars    : barres semi-transparentes pour projections de tresorerie
 *   - ClientDonut       : donut nouveaux vs recurrents
 *   - ProgressGauge     : barre de progression pour objectif CA mensuel
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, G, Text as SvgText } from 'react-native-svg';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES INTERNES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convertit un tableau de valeurs numeriques en chemin SVG pour un area chart.
 * Retourne le chemin de la ligne et le chemin de la zone remplie.
 */
function buildAreaPath(
  data: number[],
  width: number,
  height: number,
  min: number,
  max: number,
): { linePath: string; areaPath: string } {
  if (data.length < 2) return { linePath: '', areaPath: '' };
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * height,
  }));

  // Construction du chemin en courbe bezier pour un rendu plus fluide
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    linePath += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { linePath, areaPath };
}

/**
 * Formate un nombre de facon compacte : 1 200 000 => 1.2M, 50 000 => 50k, etc.
 */
function compact(v: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : '';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k${suffix}`;
  return `${Math.round(v)}${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AREA CHART — CA vs Depenses superposees sur 6 mois
// ─────────────────────────────────────────────────────────────────────────────

interface AreaChartProps {
  revenueData: number[];
  expensesData: number[];
  labels: string[];
  width: number;
  height?: number;
  colorRevenue?: string;
  colorExpenses?: string;
  textColor?: string;
  unit?: string;
}

export function AreaChart({
  revenueData,
  expensesData,
  labels,
  width,
  height = 180,
  colorRevenue = '#6366F1',
  colorExpenses = '#EF4444',
  textColor = '#9CA3AF',
  unit = '€',
}: AreaChartProps) {
  const paddingLeft = 44;
  const paddingBottom = 28;
  const paddingTop = 12;
  const chartW = width - paddingLeft - 8;
  const chartH = height - paddingBottom - paddingTop;

  const allValues = useMemo(() => [...revenueData, ...expensesData].filter(v => v > 0), [revenueData, expensesData]);
  const min = 0;
  const max = useMemo(() => Math.max(...allValues, 1), [allValues]);

  const revPaths = useMemo(() => buildAreaPath(revenueData, chartW, chartH, min, max), [revenueData, chartW, chartH, max]);
  const expPaths = useMemo(() => buildAreaPath(expensesData, chartW, chartH, min, max), [expensesData, chartW, chartH, max]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: chartH - ratio * chartH,
    label: compact(min + ratio * max, unit),
  }));

  const stepX = revenueData.length > 1 ? chartW / (revenueData.length - 1) : 0;
  const range = max - min || 1;

  const profitLossPath = useMemo(() => {
    if (revenueData.length < 2 || expensesData.length < 2) return '';
    const revPoints = revenueData.map((v, i) => ({
      x: i * stepX,
      y: chartH - ((v - min) / range) * chartH,
    }));
    const expPoints = expensesData.map((v, i) => ({
      x: i * stepX,
      y: chartH - ((v - min) / range) * chartH,
    }));
    let path = `M ${revPoints[0].x} ${revPoints[0].y}`;
    for (let i = 1; i < revPoints.length; i++) {
      const prev = revPoints[i - 1];
      const curr = revPoints[i];
      const cpX = (prev.x + curr.x) / 2;
      path += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
    }
    for (let i = expPoints.length - 1; i >= 0; i--) {
      if (i === expPoints.length - 1) {
        path += ` L ${expPoints[i].x} ${expPoints[i].y}`;
      } else {
        const next = expPoints[i + 1];
        const curr = expPoints[i];
        const cpX = (next.x + curr.x) / 2;
        path += ` C ${cpX} ${next.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
      }
    }
    path += ' Z';
    return path;
  }, [revenueData, expensesData, stepX, chartH, min, range]);

  const isProfit = useMemo(() => {
    const totalRev = revenueData.reduce((s, v) => s + v, 0);
    const totalExp = expensesData.reduce((s, v) => s + v, 0);
    return totalRev >= totalExp;
  }, [revenueData, expensesData]);

  return (
    <Svg width={width} height={height + paddingTop}>
      <Defs>
        <LinearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorRevenue} stopOpacity="0.25" />
          <Stop offset="1" stopColor={colorRevenue} stopOpacity="0.02" />
        </LinearGradient>
        <LinearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colorExpenses} stopOpacity="0.18" />
          <Stop offset="1" stopColor={colorExpenses} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
        {gridLines.map((gl, i) => (
          <G key={i}>
            <Line x1={0} y1={gl.y} x2={chartW} y2={gl.y} stroke="#E5E7EB" strokeWidth={0.8} strokeDasharray="3,3" />
            <SvgText x={-4} y={gl.y + 4} fontSize={9} fill={textColor} textAnchor="end">{gl.label}</SvgText>
          </G>
        ))}

        {profitLossPath ? (
          <Path d={profitLossPath} fill={isProfit ? '#05966912' : '#EF444412'} />
        ) : null}

        {expPaths.areaPath ? <Path d={expPaths.areaPath} fill="url(#gradExp)" /> : null}
        {revPaths.areaPath ? <Path d={revPaths.areaPath} fill="url(#gradRev)" /> : null}

        {expPaths.linePath ? <Path d={expPaths.linePath} stroke={colorExpenses} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" /> : null}
        {revPaths.linePath ? <Path d={revPaths.linePath} stroke={colorRevenue} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {revenueData.map((v, i) => {
          const cx = i * stepX;
          const cy = chartH - ((v - min) / range) * chartH;
          return (
            <G key={`rev-${i}`}>
              <Circle cx={cx} cy={cy} r={3} fill="#fff" stroke={colorRevenue} strokeWidth={1.8} />
              {(i === 0 || i === revenueData.length - 1) && v > 0 && (
                <SvgText x={cx} y={cy - 8} fontSize={8} fill={colorRevenue} textAnchor="middle" fontWeight="600">
                  {compact(v, unit)}
                </SvgText>
              )}
            </G>
          );
        })}
        {expensesData.map((v, i) => {
          const cx = i * stepX;
          const cy = chartH - ((v - min) / range) * chartH;
          return (
            <G key={`exp-${i}`}>
              <Circle cx={cx} cy={cy} r={2.5} fill="#fff" stroke={colorExpenses} strokeWidth={1.5} />
              {(i === 0 || i === expensesData.length - 1) && v > 0 && (
                <SvgText x={cx} y={cy + 14} fontSize={8} fill={colorExpenses} textAnchor="middle" fontWeight="600">
                  {compact(v, unit)}
                </SvgText>
              )}
            </G>
          );
        })}

        {labels.map((label, i) => (
          <SvgText
            key={i}
            x={i * (chartW / (labels.length - 1))}
            y={chartH + 18}
            fontSize={9}
            fill={textColor}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART — Marge par categorie produit
// ─────────────────────────────────────────────────────────────────────────────

interface HBarItem {
  label: string;
  value: number;
  color?: string;
}

interface HorizontalBarChartProps {
  data: HBarItem[];
  width: number;
  barHeight?: number;
  gap?: number;
  color?: string;
  textColor?: string;
  valueColor?: string;
  unit?: string;
}

export function HorizontalBarChart({
  data,
  width,
  barHeight = 20,
  gap = 10,
  color = '#6366F1',
  textColor = '#6B7280',
  valueColor = '#111827',
  unit = '€',
}: HorizontalBarChartProps) {
  const labelWidth = 90;
  const valueWidth = 52;
  const barAreaWidth = width - labelWidth - valueWidth - 16;
  const maxVal = useMemo(() => Math.max(...data.map(d => Math.abs(d.value)), 1), [data]);

  const totalHeight = data.length * (barHeight + gap);

  return (
    <View style={{ width, height: totalHeight }}>
      {data.map((item, i) => {
        const ratio = Math.abs(item.value) / maxVal;
        const barW = Math.max(ratio * barAreaWidth, item.value !== 0 ? 4 : 0);
        const isNeg = item.value < 0;
        const barColor = item.color || (isNeg ? '#EF4444' : color);

        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: barHeight, marginBottom: gap }}>
            {/* Label categorie */}
            <Text style={{ width: labelWidth, fontSize: 11, color: textColor }} numberOfLines={1}>{item.label}</Text>

            {/* Barre */}
            <View style={{ flex: 1, height: barHeight, justifyContent: 'center' }}>
              <View style={{
                height: barHeight - 4,
                width: barW,
                backgroundColor: barColor,
                borderRadius: 4,
                opacity: 0.85,
              }} />
            </View>

            {/* Valeur */}
            <Text style={{ width: valueWidth + 16, fontSize: 11, fontWeight: '600', color: isNeg ? '#EF4444' : valueColor, textAlign: 'right' }}>
              {compact(item.value, unit)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEK HEATMAP — Activite par jour de semaine (simplifie)
// ─────────────────────────────────────────────────────────────────────────────

interface WeekHeatmapProps {
  data: number[][];
  days?: string[];
  slots?: string[];
  primaryColor?: string;
  textColor?: string;
  bgColor?: string;
}

export function WeekHeatmap({
  data,
  days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  slots = ['Matin', 'Midi', 'A-midi', 'Soir'],
  primaryColor = '#6366F1',
  textColor = '#6B7280',
  bgColor = '#F9FAFB',
}: WeekHeatmapProps) {
  const maxVal = useMemo(() => Math.max(...data.flat(), 1), [data]);
  const cellW = 36;
  const cellH = 28;
  const labelW = 48;

  return (
    <View style={{ flexDirection: 'column', gap: 2 }}>
      <View style={{ flexDirection: 'row', marginLeft: labelW }}>
        {days.map((d, i) => (
          <View key={i} style={{ width: cellW, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: textColor, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>
      {slots.map((slot, si) => (
        <View key={si} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: labelW }}>
            <Text style={{ fontSize: 9, color: textColor }}>{slot}</Text>
          </View>
          {days.map((_, di) => {
            const val = data[di]?.[si] ?? 0;
            const ratio = val / maxVal;
            const opacity = val === 0 ? 0.06 : 0.15 + ratio * 0.8;
            return (
              <View key={di} style={{ width: cellW, height: cellH, padding: 2 }}>
                <View style={{
                  flex: 1,
                  borderRadius: 4,
                  backgroundColor: val === 0 ? bgColor : primaryColor,
                  opacity: val === 0 ? 1 : opacity,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {val > 0 && (
                    <Text style={{ fontSize: 8, fontWeight: '700', color: ratio > 0.5 ? '#fff' : primaryColor }}>{val}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOURLY BAR CHART — Activite par heure avec filtre jour de la semaine
// ─────────────────────────────────────────────────────────────────────────────

export interface HourlyBarChartProps {
  data: number[];
  startHour?: number;
  endHour?: number;
  primaryColor?: string;
  textColor?: string;
  bgColor?: string;
  barMaxHeight?: number;
}

export function HourlyBarChart({
  data,
  startHour = 6,
  endHour = 22,
  primaryColor = '#6366F1',
  textColor = '#6B7280',
  bgColor = '#F3F4F6',
  barMaxHeight = 120,
}: HourlyBarChartProps) {
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  const slicedData = useMemo(() => hours.map(h => data[h] ?? 0), [hours, data]);
  const maxVal = useMemo(() => Math.max(...slicedData, 1), [slicedData]);
  const totalSales = useMemo(() => slicedData.reduce((s, v) => s + v, 0), [slicedData]);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: barMaxHeight + 20 }}>
        {hours.map((h, idx) => {
          const val = slicedData[idx];
          const barH = maxVal > 0 ? Math.max((val / maxVal) * barMaxHeight, val > 0 ? 6 : 2) : 2;
          const intensity = maxVal > 0 ? val / maxVal : 0;
          const barColor = val > 0 ? primaryColor : bgColor;
          const barOpacity = val > 0 ? 0.4 + intensity * 0.6 : 0.3;

          return (
            <View key={h} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {val > 0 && (
                <Text style={{ fontSize: 8, fontWeight: '700' as const, color: primaryColor, marginBottom: 2 }}>
                  {val}
                </Text>
              )}
              <View
                style={{
                  width: '70%',
                  height: barH,
                  backgroundColor: barColor,
                  borderRadius: 3,
                  opacity: barOpacity,
                }}
              />
              <Text style={{
                fontSize: 8,
                color: textColor,
                marginTop: 3,
                fontWeight: '500' as const,
              }}>
                {h}h
              </Text>
            </View>
          );
        })}
      </View>
      {totalSales > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
          <Text style={{ fontSize: 10, color: textColor, fontWeight: '600' as const }}>
            Total : {totalSales} vente{totalSales > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREASURY LINE CHART — Evolution du solde sur 6 mois avec points
// ─────────────────────────────────────────────────────────────────────────────

interface TreasuryLineChartProps {
  data: number[];
  labels: string[];
  width: number;
  height?: number;
  color?: string;
  textColor?: string;
  _isPositive?: boolean;
}

export function TreasuryLineChart({
  data,
  labels,
  width,
  height = 160,
  color = '#059669',
  textColor = '#9CA3AF',
}: TreasuryLineChartProps) {
  const paddingLeft = 48;
  const paddingBottom = 26;
  const paddingTop = 16;
  const chartW = width - paddingLeft - 12;
  const chartH = height - paddingBottom - paddingTop;

  const min = useMemo(() => Math.min(...data, 0), [data]);
  const max = useMemo(() => Math.max(...data, 1), [data]);

  const { linePath, areaPath } = useMemo(
    () => buildAreaPath(data, chartW, chartH, min, max),
    [data, chartW, chartH, min, max]
  );

  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

  return (
    <Svg width={width} height={height + paddingTop}>
      <Defs>
        <LinearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.2" />
          <Stop offset="1" stopColor={color} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>

      <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
        {/* Lignes de grille */}
        {[0, 0.5, 1].map((r, i) => {
          const y = chartH - r * chartH;
          return (
            <G key={i}>
              <Line x1={0} y1={y} x2={chartW} y2={y} stroke="#E5E7EB" strokeWidth={0.7} strokeDasharray="4,3" />
              <SvgText x={-4} y={y + 4} fontSize={9} fill={textColor} textAnchor="end">
                {compact(min + r * (max - min))}
              </SvgText>
            </G>
          );
        })}

        {/* Zone remplie */}
        {areaPath ? <Path d={areaPath} fill="url(#gradLine)" /> : null}
        {/* Ligne principale */}
        {linePath ? <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {/* Points sur chaque mois */}
        {data.map((v, i) => {
          const cx = i * stepX;
          const cy = chartH - ((v - min) / (max - min || 1)) * chartH;
          return (
            <G key={i}>
              <Circle cx={cx} cy={cy} r={3.5} fill="#fff" stroke={color} strokeWidth={1.8} />
            </G>
          );
        })}

        {/* Labels des mois */}
        {labels.map((label, i) => (
          <SvgText key={i} x={i * stepX} y={chartH + 18} fontSize={9} fill={textColor} textAnchor="middle">
            {label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION BARS — Barres transparentes pour projections tresorerie
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectionBarItem {
  label: string;
  actual?: number;
  projected?: number;
}

interface ProjectionBarsProps {
  data: ProjectionBarItem[];
  width: number;
  height?: number;
  colorActual?: string;
  colorProjected?: string;
  textColor?: string;
}

export function ProjectionBars({
  data,
  width,
  height = 140,
  colorActual = '#059669',
  colorProjected = '#6366F1',
  textColor = '#9CA3AF',
}: ProjectionBarsProps) {
  const allVals = useMemo(() =>
    data.flatMap(d => [d.actual ?? 0, d.projected ?? 0]).filter(v => v > 0),
    [data]
  );
  const maxVal = useMemo(() => Math.max(...allVals, 1), [allVals]);
  const barAreaH = height - 30;

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barAreaH, gap: 4 }}>
        {data.map((item, i) => {
          const hasActual = (item.actual ?? 0) > 0;
          const hasProjected = (item.projected ?? 0) > 0;
          const actualH = hasActual ? Math.max((item.actual! / maxVal) * barAreaH, 4) : 0;
          const projH = hasProjected ? Math.max((item.projected! / maxVal) * barAreaH, 4) : 0;

          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                {hasActual && (
                  <View style={{ width: 10, height: actualH, backgroundColor: colorActual, borderRadius: 3 }} />
                )}
                {hasProjected && (
                  <View style={{ width: 10, height: projH, backgroundColor: colorProjected, borderRadius: 3, opacity: 0.45, borderWidth: 1, borderColor: colorProjected, borderStyle: 'dashed' }} />
                )}
              </View>
              <Text style={{ fontSize: 9, color: textColor, marginTop: 4 }} numberOfLines={1}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT DONUT — Nouveaux vs recurrents
// ─────────────────────────────────────────────────────────────────────────────

interface ClientDonutProps {
  newCount: number;
  recurringCount: number;
  size?: number;
  colorNew?: string;
  colorRecurring?: string;
  textColor?: string;
  labelColor?: string;
}

export function ClientDonut({
  newCount,
  recurringCount,
  size = 110,
  colorNew = '#6366F1',
  colorRecurring = '#10B981',
  textColor = '#111827',
  labelColor = '#6B7280',
}: ClientDonutProps) {
  const total = newCount + recurringCount;
  const strokeW = 18;
  const radius = (size - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const newRatio = total > 0 ? newCount / total : 0.5;
  const recRatio = total > 0 ? recurringCount / total : 0.5;

  // Arcs SVG calcules manuellement
  const newDash = newRatio * circumference;
  const recDash = recRatio * circumference;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={size} height={size}>
        {/* Fond gris */}
        <Circle cx={cx} cy={cy} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeW} />
        {/* Arc recurrents */}
        <Circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={colorRecurring} strokeWidth={strokeW}
          strokeDasharray={`${recDash} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          rotation={-90} origin={`${cx}, ${cy}`}
        />
        {/* Arc nouveaux */}
        <Circle
          cx={cx} cy={cy} r={radius} fill="none"
          stroke={colorNew} strokeWidth={strokeW}
          strokeDasharray={`${newDash} ${circumference}`}
          strokeDashoffset={circumference * (0.25 + recRatio)}
          strokeLinecap="round"
          rotation={-90} origin={`${cx}, ${cy}`}
        />
        {/* Texte central */}
        <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={16} fontWeight="700" fill={textColor}>{total}</SvgText>
        <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={labelColor}>clients</SvgText>
      </Svg>

      {/* Legende */}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorNew }} />
          <View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textColor }}>{newCount}</Text>
            <Text style={{ fontSize: 10, color: labelColor }}>Nouveaux ({total > 0 ? Math.round(newRatio * 100) : 0}%)</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorRecurring }} />
          <View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textColor }}>{recurringCount}</Text>
            <Text style={{ fontSize: 10, color: labelColor }}>Recurrents ({total > 0 ? Math.round(recRatio * 100) : 0}%)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS GAUGE — Barre de progression objectif CA mensuel (legacy)
// ─────────────────────────────────────────────────────────────────────────────

interface ProgressGaugeProps {
  current: number;
  target: number;
  color?: string;
  bgColor?: string;
  label?: string;
  formatValue: (v: number) => string;
  textColor?: string;
  subtextColor?: string;
}

export function ProgressGauge({
  current,
  target,
  color = '#6366F1',
  bgColor = '#E5E7EB',
  label = 'Objectif mensuel',
  formatValue,
  textColor = '#111827',
  subtextColor = '#6B7280',
}: ProgressGaugeProps) {
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;
  const pct = Math.round(ratio * 100);
  const isAchieved = ratio >= 1;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ fontSize: 11, color: subtextColor, fontWeight: '500' }}>{label}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: isAchieved ? color : textColor, marginTop: 2 }}>
            {formatValue(current)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: subtextColor }}>Objectif</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: subtextColor }}>{formatValue(target)}</Text>
        </View>
      </View>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: bgColor, overflow: 'hidden' }}>
        <View style={{
          width: `${pct}%` as `${number}%`,
          height: '100%',
          borderRadius: 5,
          backgroundColor: color,
          opacity: isAchieved ? 1 : 0.85,
        }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: isAchieved ? color : subtextColor }}>
          {pct}% atteint
        </Text>
        {isAchieved && (
          <Text style={{ fontSize: 11, color: color, fontWeight: '600' }}>Objectif depasse !</Text>
        )}
        {!isAchieved && target - current > 0 && (
          <Text style={{ fontSize: 11, color: subtextColor }}>
            Il reste {formatValue(target - current)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMI-CIRCULAR GAUGE — Jauge semi-circulaire pour objectif CA
// ─────────────────────────────────────────────────────────────────────────────

interface SemiCircularGaugeProps {
  current: number;
  target: number;
  size?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  formatValue: (v: number) => string;
  textColor?: string;
  subtextColor?: string;
}

export function SemiCircularGauge({
  current,
  target,
  size = 100,
  color = '#6366F1',
  bgColor = '#E5E7EB',
  label = 'Objectif CA mensuel',
  formatValue,
  textColor = '#111827',
  subtextColor = '#6B7280',
}: SemiCircularGaugeProps) {
  const ratio = target > 0 ? Math.min(current / target, 1.15) : 0;
  const pct = Math.round(Math.min(ratio, 1) * 100);
  const isAchieved = ratio >= 1;

  const strokeW = 16;
  const radius = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const sweepAngle = (endAngle - startAngle) * Math.min(ratio, 1);

  const bgStartX = cx + radius * Math.cos(startAngle);
  const bgStartY = cy + radius * Math.sin(startAngle);
  const bgEndX = cx + radius * Math.cos(endAngle);
  const bgEndY = cy + radius * Math.sin(endAngle);
  const bgPath = `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 1 1 ${bgEndX} ${bgEndY}`;

  const fillEndAngle = startAngle + sweepAngle;
  const fillEndX = cx + radius * Math.cos(fillEndAngle);
  const fillEndY = cy + radius * Math.sin(fillEndAngle);
  const largeArc = sweepAngle > Math.PI ? 1 : 0;
  const fillPath = ratio > 0
    ? `M ${bgStartX} ${bgStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEndX} ${fillEndY}`
    : '';

  const svgH = size / 2 + strokeW + 10;

  const isCompact = size <= 140;

  return (
    <View style={{ alignItems: 'center', gap: isCompact ? 2 : 4 }}>
      <Text style={{ fontSize: isCompact ? 10 : 12, color: subtextColor, fontWeight: '600' as const, marginBottom: isCompact ? 0 : 4 }}>
        {label}
      </Text>
      <View style={{ width: size, height: svgH, position: 'relative' }}>
        <Svg width={size} height={svgH}>
          <Defs>
            <LinearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={color} stopOpacity="0.6" />
              <Stop offset="1" stopColor={color} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path
            d={bgPath}
            stroke={bgColor}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
          />
          {fillPath ? (
            <Path
              d={fillPath}
              stroke="url(#gaugeGrad)"
              strokeWidth={strokeW}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
          {ratio > 0 && (
            <Circle
              cx={fillEndX}
              cy={fillEndY}
              r={strokeW / 2 + 2}
              fill="#fff"
              stroke={color}
              strokeWidth={2.5}
            />
          )}
        </Svg>
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: isCompact ? 18 : 28,
            fontWeight: '800' as const,
            color: isAchieved ? color : textColor,
            letterSpacing: -1,
          }}>
            {pct}%
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', gap: 1, marginTop: isCompact ? 0 : 2 }}>
        <Text style={{ fontSize: isCompact ? 11 : 13, fontWeight: '700' as const, color: textColor }}>
          {formatValue(current)}
        </Text>
        <Text style={{ fontSize: isCompact ? 9 : 11, color: subtextColor }}>
          sur {formatValue(target)}
        </Text>
      </View>

      {!isAchieved && target - current > 0 && !isCompact && (
        <View style={{
          marginTop: 4,
          backgroundColor: color + '10',
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 10,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600' as const, color: color }}>
            Encore {formatValue(target - current)}
          </Text>
        </View>
      )}
      {isAchieved && (
        <View style={{
          marginTop: 4,
          backgroundColor: '#059669' + '15',
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 10,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '600' as const, color: '#059669' }}>
            Objectif atteint !
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE LINE CHART — Courbe avec zone coloree, reference line, variation badge
// ─────────────────────────────────────────────────────────────────────────────

export interface SimpleLineChartProps {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
  textColor?: string;
  showArea?: boolean;
  referenceLine?: number;
  referenceLabel?: string;
  referenceColor?: string;
  positiveColor?: string;
  negativeColor?: string;
}

export function SimpleLineChart({
  data,
  width,
  height = 180,
  color = '#6366F1',
  textColor = '#9CA3AF',
  showArea = true,
  referenceLine,
  referenceLabel,
  referenceColor = '#EF4444',
  positiveColor = '#059669',
  negativeColor = '#EF4444',
}: SimpleLineChartProps) {
  const paddingLeft = 48;
  const paddingBottom = 28;
  const paddingTop = 12;
  const chartW = width - paddingLeft - 12;
  const chartH = height - paddingBottom - paddingTop;

  const values = useMemo(() => data.map(d => d.value), [data]);
  const min = useMemo(() => {
    const m = Math.min(...values, referenceLine ?? Infinity);
    return m < 0 ? m * 1.1 : 0;
  }, [values, referenceLine]);
  const max = useMemo(() => Math.max(...values, referenceLine ?? -Infinity, 1), [values, referenceLine]);

  const { linePath, areaPath } = useMemo(
    () => buildAreaPath(values, chartW, chartH, min, max),
    [values, chartW, chartH, min, max]
  );

  const stepX = values.length > 1 ? chartW / (values.length - 1) : 0;
  const range = max - min || 1;

  const refY = referenceLine !== undefined
    ? chartH - ((referenceLine - min) / range) * chartH
    : null;

  const hasPositiveNegative = referenceLine !== undefined && positiveColor && negativeColor;

  return (
    <Svg width={width} height={height + paddingTop}>
      <Defs>
        <LinearGradient id="gradSimpleLine" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.2" />
          <Stop offset="1" stopColor={color} stopOpacity="0.01" />
        </LinearGradient>
        {hasPositiveNegative && (
          <>
            <LinearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={positiveColor} stopOpacity="0.15" />
              <Stop offset="1" stopColor={positiveColor} stopOpacity="0.02" />
            </LinearGradient>
            <LinearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={negativeColor} stopOpacity="0.02" />
              <Stop offset="1" stopColor={negativeColor} stopOpacity="0.15" />
            </LinearGradient>
          </>
        )}
      </Defs>

      <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = chartH - r * chartH;
          return (
            <G key={i}>
              <Line x1={0} y1={y} x2={chartW} y2={y} stroke="#E5E7EB" strokeWidth={0.7} strokeDasharray="3,3" />
              <SvgText x={-4} y={y + 4} fontSize={9} fill={textColor} textAnchor="end">
                {compact(min + r * range)}
              </SvgText>
            </G>
          );
        })}

        {showArea && areaPath ? <Path d={areaPath} fill="url(#gradSimpleLine)" /> : null}
        {linePath ? (
          <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}

        {refY !== null && (
          <>
            <Line x1={0} y1={refY} x2={chartW} y2={refY} stroke={referenceColor} strokeWidth={1.2} strokeDasharray="6,4" />
            {referenceLabel && (
              <SvgText x={chartW} y={refY - 6} fontSize={8} fill={referenceColor} textAnchor="end" fontWeight="600">
                {referenceLabel}
              </SvgText>
            )}
          </>
        )}

        {values.map((v, i) => {
          const cx = i * stepX;
          const cy = chartH - ((v - min) / range) * chartH;
          const dotColor = referenceLine !== undefined
            ? (v >= referenceLine ? positiveColor : negativeColor)
            : color;
          return (
            <Circle key={i} cx={cx} cy={cy} r={3} fill="#fff" stroke={dotColor} strokeWidth={1.8} />
          );
        })}

        {data.map((d, i) => (
          <SvgText key={i} x={i * stepX} y={chartH + 18} fontSize={9} fill={textColor} textAnchor="middle">
            {d.label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STACKED BAR CHART — Barres empilees pour fidelite clients
// ─────────────────────────────────────────────────────────────────────────────

export interface StackedBarItem {
  label: string;
  segments: { value: number; color: string; label: string }[];
}

export interface StackedBarChartProps {
  data: StackedBarItem[];
  width: number;
  height?: number;
  textColor?: string;
}

export function StackedBarChart({
  data,
  width,
  height = 160,
  textColor = '#9CA3AF',
}: StackedBarChartProps) {
  const barAreaH = height - 30;
  const maxVal = useMemo(() => {
    return Math.max(...data.map(d => d.segments.reduce((s, seg) => s + seg.value, 0)), 1);
  }, [data]);

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barAreaH, gap: 6 }}>
        {data.map((item, i) => {
          const total = item.segments.reduce((s, seg) => s + seg.value, 0);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {total > 0 && (
                <Text style={{ fontSize: 8, fontWeight: '700' as const, color: textColor, marginBottom: 2 }}>
                  {total}
                </Text>
              )}
              <View style={{ width: '70%', borderRadius: 4, overflow: 'hidden' }}>
                {item.segments.filter(s => s.value > 0).reverse().map((seg, si) => {
                  const segH = maxVal > 0 ? Math.max((seg.value / maxVal) * barAreaH, seg.value > 0 ? 4 : 0) : 0;
                  return (
                    <View
                      key={si}
                      style={{ width: '100%', height: segH, backgroundColor: seg.color }}
                    />
                  );
                })}
              </View>
              <Text style={{ fontSize: 8, color: textColor, marginTop: 3, fontWeight: '500' as const }}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WATERFALL CHART — Graphe en cascade pour resultat net
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterfallItem {
  label: string;
  value: number;
  type: 'positive' | 'negative' | 'total';
}

export interface WaterfallChartProps {
  data: WaterfallItem[];
  width: number;
  height?: number;
  textColor?: string;
  positiveColor?: string;
  negativeColor?: string;
  totalColor?: string;
}

export function WaterfallChart({
  data,
  width,
  height = 200,
  textColor = '#9CA3AF',
  positiveColor = '#059669',
  negativeColor = '#EF4444',
  totalColor = '#6366F1',
}: WaterfallChartProps) {
  const paddingTop = 20;
  const paddingBottom = 40;
  const barAreaH = height - paddingTop - paddingBottom;

  const computed = useMemo(() => {
    let runningTotal = 0;
    const items: { label: string; start: number; end: number; value: number; type: string }[] = [];
    for (const d of data) {
      if (d.type === 'total') {
        items.push({ label: d.label, start: 0, end: d.value, value: d.value, type: d.type });
      } else {
        const start = runningTotal;
        runningTotal += d.type === 'positive' ? d.value : -d.value;
        items.push({ label: d.label, start, end: runningTotal, value: d.value, type: d.type });
      }
    }
    return items;
  }, [data]);

  const allValues = useMemo(() => computed.flatMap(c => [c.start, c.end]), [computed]);
  const maxVal = useMemo(() => Math.max(...allValues.map(Math.abs), 1), [allValues]);
  const minVal = useMemo(() => Math.min(...allValues, 0), [allValues]);
  const range = maxVal - minVal || 1;

  const getY = (val: number) => paddingTop + barAreaH - ((val - minVal) / range) * barAreaH;
  const _zeroY = getY(0);

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
        {computed.map((item, i) => {
          const topY = getY(Math.max(item.start, item.end));
          const bottomY = getY(Math.min(item.start, item.end));
          const barH = Math.max(bottomY - topY, 4);
          const barColor = item.type === 'total' ? totalColor : item.type === 'positive' ? positiveColor : negativeColor;

          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', height }}>
              <View style={{ position: 'absolute', top: Math.max(topY - 16, 2), width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 8, fontWeight: '700' as const, color: barColor }}>
                  {compact(item.value)}
                </Text>
              </View>
              <View style={{
                position: 'absolute',
                top: topY,
                width: '65%',
                height: barH,
                backgroundColor: barColor,
                borderRadius: 3,
                opacity: item.type === 'total' ? 1 : 0.85,
              }} />
              <View style={{ position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 4 }}>
                <Text style={{ fontSize: 8, color: textColor, textAlign: 'center', fontWeight: '500' as const }} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUPED BAR CHART — Barres groupees pour comparaison N vs N-1
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupedBarItem {
  label: string;
  valueA: number;
  valueB: number;
  change?: number;
}

export interface GroupedBarChartProps {
  data: GroupedBarItem[];
  width: number;
  height?: number;
  colorA?: string;
  colorB?: string;
  textColor?: string;
  labelA?: string;
  labelB?: string;
}

export function GroupedBarChart({
  data,
  width,
  height = 180,
  colorA = '#6366F1',
  colorB = '#D1D5DB',
  textColor = '#9CA3AF',
}: GroupedBarChartProps) {
  const barAreaH = height - 44;
  const maxVal = useMemo(() => Math.max(...data.flatMap(d => [d.valueA, d.valueB]), 1), [data]);

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: barAreaH, gap: 2 }}>
        {data.map((item, i) => {
          const hA = maxVal > 0 ? Math.max((item.valueA / maxVal) * barAreaH, item.valueA > 0 ? 4 : 0) : 0;
          const hB = maxVal > 0 ? Math.max((item.valueB / maxVal) * barAreaH, item.valueB > 0 ? 4 : 0) : 0;
          const change = item.change;

          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {change !== undefined && change !== 0 && (item.valueA > 0 || item.valueB > 0) && (
                <Text style={{
                  fontSize: 7,
                  fontWeight: '700' as const,
                  color: change >= 0 ? '#059669' : '#EF4444',
                  marginBottom: 2,
                }}>
                  {change >= 0 ? '+' : ''}{Math.round(change)}%
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, width: '80%' }}>
                <View style={{ flex: 1, height: hB, backgroundColor: colorB, borderRadius: 2 }} />
                <View style={{ flex: 1, height: hA, backgroundColor: colorA, borderRadius: 2 }} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((item, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: textColor, fontWeight: '500' as const }}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART WITH REFERENCE — Pour delai moyen de paiement
// ─────────────────────────────────────────────────────────────────────────────

export interface HRefBarItem {
  label: string;
  value: number;
}

export interface HorizontalRefBarChartProps {
  data: HRefBarItem[];
  width: number;
  referenceLine?: number;
  referenceLabel?: string;
  barHeight?: number;
  gap?: number;
  goodColor?: string;
  badColor?: string;
  textColor?: string;
}

export function HorizontalRefBarChart({
  data,
  width,
  referenceLine = 30,
  referenceLabel = '30j',
  barHeight = 22,
  gap = 8,
  goodColor = '#059669',
  badColor = '#EF4444',
  textColor = '#6B7280',
}: HorizontalRefBarChartProps) {
  const labelWidth = 50;
  const valueWidth = 45;
  const barAreaWidth = width - labelWidth - valueWidth - 16;
  const maxVal = useMemo(() => Math.max(...data.map(d => d.value), referenceLine * 1.5, 1), [data, referenceLine]);
  const totalHeight = data.length * (barHeight + gap);
  const refX = (referenceLine / maxVal) * barAreaWidth;

  return (
    <View style={{ width, height: totalHeight + 20 }}>
      {data.map((item, i) => {
        const barW = Math.max((item.value / maxVal) * barAreaWidth, item.value > 0 ? 4 : 0);
        const isGood = item.value <= referenceLine;
        const barColor = isGood ? goodColor : badColor;

        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: barHeight, marginBottom: gap }}>
            <Text style={{ width: labelWidth, fontSize: 10, color: textColor, fontWeight: '500' as const }} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={{ flex: 1, height: barHeight, justifyContent: 'center', position: 'relative' }}>
              <View style={{
                position: 'absolute',
                left: refX,
                top: 0,
                bottom: 0,
                width: 1.5,
                backgroundColor: '#F59E0B',
                opacity: 0.6,
              }} />
              <View style={{
                height: barHeight - 6,
                width: barW,
                backgroundColor: barColor,
                borderRadius: 4,
                opacity: 0.8,
              }} />
            </View>
            <Text style={{ width: valueWidth, fontSize: 10, fontWeight: '600' as const, color: barColor, textAlign: 'right' }}>
              {Math.round(item.value)}j
            </Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: labelWidth }}>
        <View style={{ position: 'relative', flex: 1 }}>
          <View style={{ position: 'absolute', left: refX - 1, top: 0 }}>
            <Text style={{ fontSize: 8, color: '#F59E0B', fontWeight: '600' as const }}>{referenceLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND ROW — Legende horizontale reutilisable pour les graphes
// ─────────────────────────────────────────────────────────────────────────────

interface LegendItem {
  color: string;
  label: string;
}

interface LegendRowProps {
  items: LegendItem[];
  textColor?: string;
}

export function LegendRow({ items, textColor = '#6B7280' }: LegendRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
          <Text style={{ fontSize: 11, color: textColor }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
