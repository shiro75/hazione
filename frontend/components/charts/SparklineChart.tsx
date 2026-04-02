/**
 * SparklineChart.tsx
 * Mini sparkline SVG chart for embedding in KPI cards and comparison sections.
 * Renders a smooth polyline with optional area fill gradient effect.
 *
 * Usage:
 *   <SparklineChart data={[10, 25, 18, 30, 22, 35, 40]} color="#059669" width={80} height={28} />
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';

interface SparklineChartProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
}

function SparklineChart({
  data,
  color,
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  showArea = true,
}: SparklineChartProps) {
  const points = useMemo(() => {
    if (data.length < 2) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const step = usableW / (data.length - 1);

    return data
      .map((val, i) => {
        const x = padding + i * step;
        const y = padding + usableH - ((val - min) / range) * usableH;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, width, height]);

  const areaPoints = useMemo(() => {
    if (data.length < 2 || !showArea) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const step = usableW / (data.length - 1);

    const linePoints = data.map((val, i) => {
      const x = padding + i * step;
      const y = padding + usableH - ((val - min) / range) * usableH;
      return `${x},${y}`;
    });

    const lastX = padding + (data.length - 1) * step;
    const firstX = padding;
    const bottomY = height;

    return `${linePoints.join(' ')} ${lastX},${bottomY} ${firstX},${bottomY}`;
  }, [data, width, height, showArea]);

  if (data.length < 2) return null;

  const gradientId = `spark-${color.replace('#', '')}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {showArea && areaPoints && (
          <Polygon
            points={areaPoints}
            fill={`url(#${gradientId})`}
          />
        )}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export default React.memo(SparklineChart);
