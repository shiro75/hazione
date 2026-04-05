import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, G, Text as SvgText } from 'react-native-svg';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

interface RevenueTrendChartProps {
  data: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
  regressionColor?: string;
  textColor?: string;
  unit?: string;
}

function compact(v: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : '';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k${suffix}`;
  return `${Math.round(v)}${suffix}`;
}

function RevenueTrendChart({
  data,
  width,
  height = 200,
  color = '#6366F1',
  regressionColor = '#F59E0B',
  textColor = '#9CA3AF',
  unit = '€',
}: RevenueTrendChartProps) {
  const paddingLeft = 48;
  const paddingBottom = 28;
  const paddingTop = 16;
  const chartW = width - paddingLeft - 12;
  const chartH = height - paddingBottom - paddingTop;

  const values = useMemo(() => data.map(d => d.value), [data]);
  const min = 0;
  const max = useMemo(() => Math.max(...values, 1) * 1.15, [values]);
  const range = max - min || 1;

  const stepX = values.length > 1 ? chartW / (values.length - 1) : 0;

  const points = useMemo(() =>
    values.map((v, i) => ({
      x: i * stepX,
      y: chartH - ((v - min) / range) * chartH,
    })),
    [values, stepX, chartH, range]
  );

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i - 1].x + points[i].x) / 2;
      d += ` C ${cpX} ${points[i - 1].y} ${cpX} ${points[i].y} ${points[i].x} ${points[i].y}`;
    }
    return d;
  }, [points]);

  const areaPath = useMemo(() => {
    if (!linePath || points.length < 2) return '';
    return `${linePath} L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;
  }, [linePath, points, chartH]);

  const regression = useMemo(() => {
    const n = values.length;
    if (n < 2) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const startVal = intercept;
    const endVal = slope * (n - 1) + intercept;
    const startY = chartH - ((startVal - min) / range) * chartH;
    const endY = chartH - ((endVal - min) / range) * chartH;
    return {
      startX: 0,
      startY: Math.max(0, Math.min(chartH, startY)),
      endX: (n - 1) * stepX,
      endY: Math.max(0, Math.min(chartH, endY)),
      slope,
      isPositive: slope >= 0,
    };
  }, [values, chartH, min, range, stepX]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(r => ({
    y: chartH - r * chartH,
    label: compact(min + r * range, unit),
  }));

  const trendLabel = useMemo(() => {
    if (!regression) return '';
    const monthlyChange = regression.slope;
    if (Math.abs(monthlyChange) < 1) return 'Stable';
    return regression.isPositive
      ? `+${compact(monthlyChange, unit)}/mois`
      : `${compact(monthlyChange, unit)}/mois`;
  }, [regression, unit]);

  return (
    <View style={s.container}>
      {regression && (
        <View style={s.trendRow}>
          <View style={[s.trendBadge, { backgroundColor: regression.isPositive ? '#05966915' : '#EF444415' }]}>
            <Text style={[s.trendText, { color: regression.isPositive ? '#059669' : '#EF4444' }]}>
              {regression.isPositive ? '📈' : '📉'} Tendance : {trendLabel}
            </Text>
          </View>
        </View>
      )}
      <Svg width={width} height={height + paddingTop}>
        <Defs>
          <LinearGradient id="gradRevTrend" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.2" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        <G transform={`translate(${paddingLeft}, ${paddingTop})`}>
          {gridLines.map((gl, i) => (
            <G key={i}>
              <Line x1={0} y1={gl.y} x2={chartW} y2={gl.y} stroke="#E5E7EB" strokeWidth={0.7} strokeDasharray="3,3" />
              <SvgText x={-4} y={gl.y + 4} fontSize={9} fill={textColor} textAnchor="end">{gl.label}</SvgText>
            </G>
          ))}

          {areaPath ? <Path d={areaPath} fill="url(#gradRevTrend)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}

          {regression && (
            <Line
              x1={regression.startX}
              y1={regression.startY}
              x2={regression.endX}
              y2={regression.endY}
              stroke={regressionColor}
              strokeWidth={2}
              strokeDasharray="8,5"
              strokeLinecap="round"
              opacity={0.7}
            />
          )}

          {values.map((v, i) => {
            const cx = i * stepX;
            const cy = chartH - ((v - min) / range) * chartH;
            const isLast = i === values.length - 1;
            const isFirst = i === 0;
            return (
              <G key={i}>
                <Circle cx={cx} cy={cy} r={isLast ? 4 : 3} fill="#fff" stroke={color} strokeWidth={isLast ? 2.5 : 1.8} />
                {(isFirst || isLast) && v > 0 && (
                  <SvgText x={cx} y={cy - 10} fontSize={9} fill={color} textAnchor="middle" fontWeight="600">
                    {compact(v, unit)}
                  </SvgText>
                )}
              </G>
            );
          })}

          {data.map((d, i) => {
            const showLabel = data.length <= 12 || i % 2 === 0 || i === data.length - 1;
            if (!showLabel) return null;
            return (
              <SvgText key={i} x={i * stepX} y={chartH + 18} fontSize={9} fill={textColor} textAnchor="middle">
                {d.label}
              </SvgText>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

export default React.memo(RevenueTrendChart);

const s = StyleSheet.create({
  container: {
    gap: SPACING.SM,
  },
  trendRow: {
    flexDirection: 'row',
    marginBottom: SPACING.XS,
  },
  trendBadge: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.MD,
  },
  trendText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
});
