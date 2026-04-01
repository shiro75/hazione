/**
 * @fileoverview Client picker dropdown with search and inline quick-add.
 * Used in POS, invoice, and quote forms to select or create a client.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { UserPlus, ChevronDown, X, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';

interface ClientPickerProps {
  selectedClientId: string;
  onSelect: (clientId: string) => void;
  required?: boolean;
  label?: string;
}

export default React.memo(function ClientPicker({ selectedClientId, onSelect, required = false, label = 'Client' }: ClientPickerProps) {
  const { colors } = useTheme();
  const { activeClients } = useData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return activeClients.slice(0, 15);
    const q = search.toLowerCase();
    return activeClients.filter(
      (c) =>
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [search, activeClients]);

  const selectedName = useMemo(() => {
    if (!selectedClientId) return '';
    const c = activeClients.find((cl) => cl.id === selectedClientId);
    if (!c) return '';
    return c.companyName || `${c.firstName} ${c.lastName}`;
  }, [selectedClientId, activeClients]);

  const handleSelect = useCallback((clientId: string) => {
    onSelect(clientId);
    setOpen(false);
    setSearch('');
  }, [onSelect]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
      </View>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        onPress={() => setOpen(!open)}
      >
        <UserPlus size={15} color={colors.textSecondary} />
        <Text style={[styles.selectorText, { color: selectedClientId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {selectedName || (required ? 'Sélectionner un client' : 'Client (optionnel)')}
        </Text>
        {selectedClientId ? (
          <TouchableOpacity onPress={() => { onSelect(''); setOpen(false); }} hitSlop={8}>
            <X size={14} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <ChevronDown size={14} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {open && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          <ScrollView style={styles.list} nestedScrollEnabled>
            {filtered.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  styles.item,
                  { borderBottomColor: colors.borderLight },
                  client.id === selectedClientId && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => handleSelect(client.id)}
              >
                <Text style={[styles.itemText, { color: colors.text }]}>
                  {client.companyName || `${client.firstName} ${client.lastName}`}
                </Text>
                {client.id === selectedClientId && <Check size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 6 },
  labelRow: { flexDirection: 'row' as const, gap: 4, alignItems: 'center' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  required: { fontSize: 13, fontWeight: '600' as const },
  selector: { flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  selectorText: { flex: 1, fontSize: 14 },
  dropdown: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' as const },
  searchInput: { borderWidth: 1, borderRadius: 6, margin: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  list: { maxHeight: 180 },
  item: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  itemText: { fontSize: 13, fontWeight: '500' as const },
});
