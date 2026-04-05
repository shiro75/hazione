import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

interface MiniAreaChartProps {
  data: { label: string; value: number }[];
  total: string;
  totalLabel?: string;
  width: number;
  height?: number;
  color?: string;
  unit?: string;
  subtitle?: string;
}

function buildSmoothPath(
  values: number[],
  w: number,
  h: number,
  padTop: number,
  padBot: number,
): { line: string; area: string; points: { x: number; y: number }[]; min: number; max: number } {
  if (values.length < 2) return { line: '', area: '', points: [], min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartH = h - padTop - padBot;
  const stepX = w / (values.length - 1);

  const points = values.map((v, i) => ({
    x: i * stepX,
    y: padTop + chartH - ((v - min) / range) * chartH,
  }));

  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cpX = (points[i - 1].x + points[i].x) / 2;
    line += ` C ${cpX} ${points[i - 1].y} ${cpX} ${points[i].y} ${points[i].x} ${points[i].y}`;
  }

  const area = `${line} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  return { line, area, points, min, max };
}

export default React.memo(function MiniAreaChart({
  data,
  total,
  totalLabel,
  width,
  height = 80,
  color,
  subtitle,
}: MiniAreaChartProps) {
  const { colors } = useTheme();
  const lineColor = color || colors.primary;

  const values = useMemo(() => data.map(d => d.value), [data]);
  const paths = useMemo(() => buildSmoothPath(values, width, height, 8, 22), [values, width, height]);

  const lastPoint = paths.points.length > 0 ? paths.points[paths.points.length - 1] : null;
  const labelStep = data.length <= 8 ? 1 : Math.ceil(data.length / 6);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          {totalLabel ? (
            <Text style={[styles.totalLabel, { color: colors.textTertiary }]}>{totalLabel}</Text>
          ) : null}
          <Text style={[styles.totalValue, { color: colors.text }]}>{total}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ width, height, marginTop: 4 }}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="miniAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.22" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>
          {paths.area ? <Path d={paths.area} fill="url(#miniAreaGrad)" /> : null}
          {paths.line ? (
            <Path
              d={paths.line}
              stroke={lineColor}
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {lastPoint ? (
            <>
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill="#fff" stroke={lineColor} strokeWidth={2} />
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={7} fill={lineColor} fillOpacity={0.12} />
            </>
          ) : null}
        </Svg>
      </View>

      <View style={styles.labelsRow}>
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          const left = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
          return (
            <Text
              key={i}
              style={[
                styles.xLabel,
                {
                  color: colors.textTertiary,
                  left: `${left}%` as unknown as number,
                },
              ]}
            >
              {d.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  labelsRow: {
    flexDirection: 'row' as const,
    position: 'relative' as const,
    height: 16,
    marginTop: 2,
  },
  xLabel: {
    fontSize: 9,
    fontWeight: '500' as const,
    position: 'absolute' as const,
    transform: [{ translateX: -12 }],
  },
});
