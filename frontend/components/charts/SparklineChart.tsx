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
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon, Circle, Path } from 'react-native-svg';

interface SparklineChartProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  showArea?: boolean;
  showEndDot?: boolean;
  smooth?: boolean;
}

function SparklineChart({
  data,
  color,
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  showArea = true,
  showEndDot = false,
  smooth = false,
}: SparklineChartProps) {
  const coords = useMemo(() => {
    if (data.length < 2) return [];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = showEndDot ? 4 : 2;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const step = usableW / (data.length - 1);
    return data.map((val, i) => ({
      x: padding + i * step,
      y: padding + usableH - ((val - min) / range) * usableH,
    }));
  }, [data, width, height, showEndDot]);

  const points = useMemo(() => {
    if (coords.length < 2) return '';
    return coords.map(c => `${c.x},${c.y}`).join(' ');
  }, [coords]);

  const smoothPath = useMemo(() => {
    if (!smooth || coords.length < 2) return '';
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const cpX = (coords[i - 1].x + coords[i].x) / 2;
      d += ` C ${cpX} ${coords[i - 1].y} ${cpX} ${coords[i].y} ${coords[i].x} ${coords[i].y}`;
    }
    return d;
  }, [smooth, coords]);

  const smoothAreaPath = useMemo(() => {
    if (!smooth || coords.length < 2 || !showArea) return '';
    const last = coords[coords.length - 1];
    const first = coords[0];
    return `${smoothPath} L ${last.x} ${height} L ${first.x} ${height} Z`;
  }, [smooth, coords, showArea, smoothPath, height]);

  const areaPoints = useMemo(() => {
    if (smooth || coords.length < 2 || !showArea) return '';
    const linePoints = coords.map(c => `${c.x},${c.y}`);
    const lastX = coords[coords.length - 1].x;
    const firstX = coords[0].x;
    return `${linePoints.join(' ')} ${lastX},${height} ${firstX},${height}`;
  }, [smooth, coords, showArea, height]);

  if (data.length < 2) return null;

  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, '')}-${width}`;
  const lastCoord = coords[coords.length - 1];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {showArea && smooth && smoothAreaPath ? (
          <Path d={smoothAreaPath} fill={`url(#${gradientId})`} />
        ) : null}
        {showArea && !smooth && areaPoints ? (
          <Polygon points={areaPoints} fill={`url(#${gradientId})`} />
        ) : null}
        {smooth && smoothPath ? (
          <Path
            d={smoothPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {showEndDot && lastCoord && (
          <>
            <Circle cx={lastCoord.x} cy={lastCoord.y} r={3.5} fill={color} opacity={0.2} />
            <Circle cx={lastCoord.x} cy={lastCoord.y} r={2} fill={color} />
          </>
        )}
      </Svg>
    </View>
  );
}

export default React.memo(SparklineChart);
