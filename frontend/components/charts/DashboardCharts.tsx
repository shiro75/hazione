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
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg';

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
function compact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

// ─────────────────────────────────────────────────────────────────────────────
// AREA CHART — CA vs Depenses superposees sur 6 mois
// ─────────────────────────────────────────────────────────────────────────────

interface AreaChartProps {
  /** Donnees de la serie CA : une valeur par mois */
  revenueData: number[];
  /** Donnees de la serie Depenses : une valeur par mois */
  expensesData: number[];
  /** Labels des mois (ex: ['Jan', 'Fev', ...]) */
  labels: string[];
  width: number;
  height?: number;
  colorRevenue?: string;
  colorExpenses?: string;
  textColor?: string;
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

  // Lignes horizontales de reference (grille)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: chartH - ratio * chartH,
    label: compact(min + ratio * max),
  }));

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

      {/* Lignes de grille horizontales */}
      <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
        {gridLines.map((gl, i) => (
          <G key={i}>
            <Line x1={0} y1={gl.y} x2={chartW} y2={gl.y} stroke="#E5E7EB" strokeWidth={0.8} strokeDasharray="3,3" />
            <SvgText x={-4} y={gl.y + 4} fontSize={9} fill={textColor} textAnchor="end">{gl.label}</SvgText>
          </G>
        ))}

        {/* Zone remplie depenses */}
        {expPaths.areaPath ? <Path d={expPaths.areaPath} fill="url(#gradExp)" /> : null}
        {/* Zone remplie CA */}
        {revPaths.areaPath ? <Path d={revPaths.areaPath} fill="url(#gradRev)" /> : null}
        {/* Ligne depenses */}
        {expPaths.linePath ? <Path d={expPaths.linePath} stroke={colorExpenses} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {/* Ligne CA */}
        {revPaths.linePath ? <Path d={revPaths.linePath} stroke={colorRevenue} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {/* Points sur la derniere valeur de chaque serie */}
        {revenueData.length > 0 && (
          <Circle
            cx={(revenueData.length - 1) * (chartW / (revenueData.length - 1))}
            cy={chartH - ((revenueData[revenueData.length - 1] - min) / (max - min || 1)) * chartH}
            r={3} fill={colorRevenue} />
        )}
        {expensesData.length > 0 && (
          <Circle
            cx={(expensesData.length - 1) * (chartW / (expensesData.length - 1))}
            cy={chartH - ((expensesData[expensesData.length - 1] - min) / (max - min || 1)) * chartH}
            r={3} fill={colorExpenses} />
        )}

        {/* Labels des mois en bas */}
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
}

export function HorizontalBarChart({
  data,
  width,
  barHeight = 20,
  gap = 10,
  color = '#6366F1',
  textColor = '#6B7280',
  valueColor = '#111827',
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
            <Text style={{ width: valueWidth, fontSize: 11, fontWeight: '600', color: isNeg ? '#EF4444' : valueColor, textAlign: 'right' }}>
              {compact(item.value)}
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
  /**
   * Matrice 7 jours x 4 tranches horaires (matin / midi / apres-midi / soir).
   * Chaque valeur est le nombre de ventes dans ce creneau.
   */
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
      {/* En-tete jours */}
      <View style={{ flexDirection: 'row', marginLeft: labelW }}>
        {days.map((d, i) => (
          <View key={i} style={{ width: cellW, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: textColor, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Lignes de slots horaires */}
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
// TREASURY LINE CHART — Evolution du solde sur 6 mois avec points
// ─────────────────────────────────────────────────────────────────────────────

interface TreasuryLineChartProps {
  data: number[];
  labels: string[];
  width: number;
  height?: number;
  color?: string;
  textColor?: string;
  isPositive?: boolean;
}

export function TreasuryLineChart({
  data,
  labels,
  width,
  height = 160,
  color = '#059669',
  textColor = '#9CA3AF',
  isPositive = true,
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
// PROGRESS GAUGE — Barre de progression objectif CA mensuel
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
      {/* En-tete avec valeurs */}
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

      {/* Barre de progression */}
      <View style={{ height: 10, borderRadius: 5, backgroundColor: bgColor, overflow: 'hidden' }}>
        <View style={{
          width: `${pct}%` as `${number}%`,
          height: '100%',
          borderRadius: 5,
          backgroundColor: color,
          opacity: isAchieved ? 1 : 0.85,
        }} />
      </View>

      {/* Pourcentage et message */}
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