/**
 * @fileoverview Cross-platform date picker field with calendar dropdown.
 * On native, renders a custom calendar modal. On web, falls back to native input.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  required?: boolean;
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate;
  }
}

function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_NAMES = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default React.memo(function DatePickerField({ label, value, onChange, placeholder, required }: DatePickerFieldProps) {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const currentDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  const selectedDay = value ? new Date(value).getDate() : -1;
  const selectedMonth = value ? new Date(value).getMonth() : -1;
  const selectedYear = value ? new Date(value).getFullYear() : -1;

  const openPicker = useCallback(() => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setModalVisible(true);
  }, [value]);

  const handleSelectDay = useCallback((day: number) => {
    const iso = toISODateString(new Date(viewYear, viewMonth, day));
    onChange(iso);
    setModalVisible(false);
  }, [viewYear, viewMonth, onChange]);

  const handleToday = useCallback(() => {
    const now = new Date();
    onChange(toISODateString(now));
    setModalVisible(false);
  }, [onChange]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  if (Platform.OS === 'web') {
    return (
      <View style={dpStyles.fieldWrapper}>
        <Text style={[dpStyles.label, { color: colors.textSecondary }]}>
          {label}{required ? ' *' : ''}
        </Text>
        <View style={[dpStyles.fieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Calendar size={16} color={colors.textTertiary} />
          <input
            type="date"
            value={value || ''}
            onChange={(e: any) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: 14,
              fontFamily: 'inherit',
              padding: 0,
            }}
          />
          <TouchableOpacity
            style={[dpStyles.todayBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => onChange(toISODateString(new Date()))}
          >
            <Text style={[dpStyles.todayBtnText, { color: colors.primary }]}>Aujourd'hui</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dpStyles.fieldWrapper}>
      <Text style={[dpStyles.label, { color: colors.textSecondary }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <TouchableOpacity
        style={[dpStyles.fieldRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Calendar size={16} color={colors.textTertiary} />
        <Text style={[dpStyles.dateText, { color: value ? colors.text : colors.textTertiary }]}>
          {value ? formatDisplayDate(value) : (placeholder || 'Sélectionner une date')}
        </Text>
        <TouchableOpacity
          style={[dpStyles.todayBtn, { backgroundColor: colors.primaryLight }]}
          onPress={(e) => {
            e.stopPropagation?.();
            onChange(toISODateString(new Date()));
          }}
        >
          <Text style={[dpStyles.todayBtnText, { color: colors.primary }]}>Aujourd'hui</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={dpStyles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[dpStyles.calendarCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={dpStyles.calendarHeader}>
                <TouchableOpacity onPress={prevMonth} style={[dpStyles.navBtn, { backgroundColor: colors.inputBg }]}>
                  <ChevronLeft size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[dpStyles.monthTitle, { color: colors.text }]}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={[dpStyles.navBtn, { backgroundColor: colors.inputBg }]}>
                  <ChevronRight size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={dpStyles.dayNamesRow}>
                {DAY_NAMES.map((dn) => (
                  <Text key={dn} style={[dpStyles.dayName, { color: colors.textTertiary }]}>{dn}</Text>
                ))}
              </View>

              <View style={dpStyles.daysGrid}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <View key={`empty-${i}`} style={dpStyles.dayCell} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear;
                  const isToday = day === new Date().getDate() && viewMonth === new Date().getMonth() && viewYear === new Date().getFullYear();
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        dpStyles.dayCell,
                        isSelected && { backgroundColor: colors.primary, borderRadius: 8 },
                        isToday && !isSelected && { borderWidth: 1, borderColor: colors.primary, borderRadius: 8 },
                      ]}
                      onPress={() => handleSelectDay(day)}
                    >
                      <Text style={[
                        dpStyles.dayText,
                        { color: isSelected ? '#FFF' : colors.text },
                        isToday && !isSelected && { color: colors.primary, fontWeight: '700' as const },
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={dpStyles.calendarFooter}>
                <TouchableOpacity
                  style={[dpStyles.footerBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={handleToday}
                >
                  <Text style={[dpStyles.footerBtnText, { color: colors.primary }]}>Aujourd'hui</Text>
                </TouchableOpacity>
                {value ? (
                  <TouchableOpacity
                    style={[dpStyles.footerBtn, { backgroundColor: colors.dangerLight }]}
                    onPress={() => { onChange(''); setModalVisible(false); }}
                  >
                    <Text style={[dpStyles.footerBtnText, { color: colors.danger }]}>Effacer</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[dpStyles.footerBtn, { backgroundColor: colors.inputBg }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[dpStyles.footerBtnText, { color: colors.textSecondary }]}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const dpStyles = StyleSheet.create({
  fieldWrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' as const },
  fieldRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  dateText: { flex: 1, fontSize: 14 },
  todayBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  todayBtnText: { fontSize: 11, fontWeight: '600' as const },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  calendarCard: {
    width: 320,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  monthTitle: { fontSize: 16, fontWeight: '600' as const },
  dayNamesRow: {
    flexDirection: 'row' as const,
    marginBottom: 8,
  },
  dayName: {
    width: 40,
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  daysGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  dayCell: {
    width: 40,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dayText: { fontSize: 14, fontWeight: '500' as const },
  calendarFooter: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 16,
    justifyContent: 'flex-end' as const,
  },
  footerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  footerBtnText: { fontSize: 13, fontWeight: '600' as const },
});
