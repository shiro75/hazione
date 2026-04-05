import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

interface SalesHeatmapProps {
  data: number[][];
  days?: string[];
  hours?: number[];
  primaryColor?: string;
  textColor?: string;
  bgColor?: string;
}

function SalesHeatmap({
  data,
  days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
  hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  primaryColor = '#6366F1',
  textColor = '#6B7280',
  bgColor = '#F3F4F6',
}: SalesHeatmapProps) {
  const maxVal = useMemo(() => Math.max(...data.flat(), 1), [data]);

  const peakCell = useMemo(() => {
    let peakDay = 0;
    let peakHour = 0;
    let peakVal = 0;
    for (let d = 0; d < data.length; d++) {
      for (let h = 0; h < data[d].length; h++) {
        if (data[d][h] > peakVal) {
          peakVal = data[d][h];
          peakDay = d;
          peakHour = h;
        }
      }
    }
    return { day: peakDay, hour: peakHour, value: peakVal };
  }, [data]);

  const totalSales = useMemo(() => data.flat().reduce((s, v) => s + v, 0), [data]);

  const getColor = (val: number): string => {
    if (val === 0) return bgColor;
    const ratio = val / maxVal;
    if (ratio < 0.25) return primaryColor + '25';
    if (ratio < 0.5) return primaryColor + '50';
    if (ratio < 0.75) return primaryColor + '90';
    return primaryColor;
  };

  const getTextColor = (val: number): string => {
    if (val === 0) return 'transparent';
    const ratio = val / maxVal;
    return ratio > 0.5 ? '#FFFFFF' : primaryColor;
  };

  return (
    <View style={s.container}>
      {peakCell.value > 0 && (
        <View style={[s.peakBadge, { backgroundColor: '#F59E0B18' }]}>
          <Text style={[s.peakText, { color: '#F59E0B' }]}>
            ⚡ Pic : {days[peakCell.day]} à {hours[peakCell.hour]}h — {peakCell.value} vente{peakCell.value > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <View style={s.grid}>
        <View style={s.cornerCell} />
        {hours.map((h) => (
          <View key={`h-${h}`} style={s.hourHeader}>
            <Text style={[s.hourText, { color: textColor }]}>{h}h</Text>
          </View>
        ))}

        {days.map((day, dayIdx) => (
          <React.Fragment key={day}>
            <View style={s.dayCell}>
              <Text style={[s.dayText, { color: textColor }]}>{day}</Text>
            </View>
            {hours.map((h, hIdx) => {
              const val = data[dayIdx]?.[hIdx] ?? 0;
              const isPeak = dayIdx === peakCell.day && hIdx === peakCell.hour && peakCell.value > 0;
              return (
                <View
                  key={`${dayIdx}-${hIdx}`}
                  style={[
                    s.cell,
                    { backgroundColor: getColor(val) },
                    isPeak && s.peakCell,
                  ]}
                >
                  {val > 0 && (
                    <Text style={[s.cellText, { color: getTextColor(val) }]}>
                      {val}
                    </Text>
                  )}
                </View>
              );
            })}
          </React.Fragment>
        ))}
      </View>

      <View style={s.footer}>
        <View style={s.legendRow}>
          <Text style={[s.legendLabel, { color: textColor }]}>Faible</Text>
          {[0.15, 0.35, 0.6, 0.85, 1].map((ratio, i) => (
            <View
              key={i}
              style={[
                s.legendBlock,
                {
                  backgroundColor: ratio < 0.2 ? bgColor : ratio < 0.4 ? primaryColor + '25' : ratio < 0.65 ? primaryColor + '50' : ratio < 0.9 ? primaryColor + '90' : primaryColor,
                },
              ]}
            />
          ))}
          <Text style={[s.legendLabel, { color: textColor }]}>Fort</Text>
        </View>
        <Text style={[s.totalText, { color: textColor }]}>
          {totalSales} vente{totalSales > 1 ? 's' : ''} au total
        </Text>
      </View>
    </View>
  );
}

export default React.memo(SalesHeatmap);

const s = StyleSheet.create({
  container: {
    gap: SPACING.MD,
  },
  peakBadge: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.MD,
    alignSelf: 'flex-start',
    marginBottom: SPACING.XS,
  },
  peakText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cornerCell: {
    width: 32,
    height: 20,
  },
  hourHeader: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourText: {
    fontSize: 7,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  dayCell: {
    width: 32,
    height: 20,
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
  cell: {
    width: 20,
    height: 20,
    borderRadius: 3,
    margin: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakCell: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  cellText: {
    fontSize: 7,
    fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.SM,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendBlock: {
    width: 14,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 8,
    fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM,
  },
  totalText: {
    fontSize: TYPOGRAPHY.SIZE.CAPTION,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
  },
});
