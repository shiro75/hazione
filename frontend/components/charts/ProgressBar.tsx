/**
 * ProgressBar.tsx
 * Horizontal progress bar with optional label. Used in sales table rows
 * to show relative amounts visually.
 *
 * Usage:
 *   <ProgressBar progress={0.75} color="#6366F1" height={3} />
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';


interface ProgressBarProps {
  progress: number;
  color: string;
  backgroundColor?: string;
  height?: number;
}

function ProgressBar({
  progress,
  color,
  backgroundColor = 'transparent',
  height = 3,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <View style={[styles.track, { backgroundColor, height, borderRadius: height / 2 }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clampedProgress * 100}%` as const,
            height,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}

export default React.memo(ProgressBar);

const styles = StyleSheet.create({
  track: {
    width: '100%' as const,
    overflow: 'hidden' as const,
  },
  fill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
  },
});
