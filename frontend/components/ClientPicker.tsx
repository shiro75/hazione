/**
 * @fileoverview Client picker dropdown with search and inline quick-add.
 * Used in POS, invoice, and quote forms to select or create a client.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { UserPlus, ChevronDown, X, Check, Plus } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';

interface ClientPickerProps {
  selectedClientId: string;
  onSelect: (clientId: string) => void;
  required?: boolean;
  label?: string;
  showQuickAdd?: boolean;
}

export default React.memo(function ClientPicker({ selectedClientId, onSelect, required = false, label = 'Client', showQuickAdd = true }: ClientPickerProps) {
  const { colors } = useTheme();
  const { activeClients, createClient } = useData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [qaFirstName, setQaFirstName] = useState('');
  const [qaLastName, setQaLastName] = useState('');
  const [qaCompany, setQaCompany] = useState('');
  const [qaEmail, setQaEmail] = useState('');
  const [qaPhone, setQaPhone] = useState('');
  const [qaError, setQaError] = useState('');

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

  const resetQuickAdd = useCallback(() => {
    setQaFirstName('');
    setQaLastName('');
    setQaCompany('');
    setQaEmail('');
    setQaPhone('');
    setQaError('');
    setQuickAddMode(false);
  }, []);

  const handleQuickAdd = useCallback(() => {
    if (!qaFirstName.trim() && !qaCompany.trim()) {
      setQaError('Le nom ou la raison sociale est requis');
      return;
    }
    const displayName = qaCompany.trim() || `${qaFirstName.trim()} ${qaLastName.trim()}`.trim();
    const result = createClient({
      type: qaCompany ? 'company' : 'individual',
      companyName: qaCompany.trim(),
      firstName: qaFirstName.trim(),
      lastName: qaLastName.trim(),
      email: qaEmail.trim(),
      phone: qaPhone.trim(),
      address: '',
      city: '',
      postalCode: '',
      country: 'France',
      notes: '',
    });
    if (result.success) {
      setTimeout(() => {
        const found = activeClients.find(c => {
          const name = c.companyName || `${c.firstName} ${c.lastName}`;
          return name === displayName;
        });
        if (found) {
          handleSelect(found.id);
        }
        resetQuickAdd();
      }, 50);
    } else {
      setQaError(result.error || 'Erreur lors de la création');
    }
  }, [qaFirstName, qaLastName, qaCompany, qaEmail, qaPhone, createClient, handleSelect, resetQuickAdd, activeClients]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {required && <Text style={[styles.required, { color: colors.danger }]}>*</Text>}
      </View>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        onPress={() => { setOpen(!open); setQuickAddMode(false); }}
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

      {open && !quickAddMode && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {showQuickAdd ? (
            <TouchableOpacity
              style={[styles.quickAddBtn, { backgroundColor: colors.primaryLight, borderBottomColor: colors.borderLight }]}
              onPress={() => setQuickAddMode(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={[styles.quickAddBtnText, { color: colors.primary }]}>Ajouter un client</Text>
            </TouchableOpacity>
          ) : null}
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

      {open && quickAddMode && (
        <View style={[styles.dropdown, styles.quickAddForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.quickAddHeader}>
            <Text style={[styles.quickAddTitle, { color: colors.text }]}>Ajout rapide client</Text>
            <TouchableOpacity onPress={resetQuickAdd} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          {qaError ? (
            <View style={[styles.qaErrorBanner, { backgroundColor: '#FEF2F2' }]}>
              <Text style={{ fontSize: 12, color: '#DC2626' }}>{qaError}</Text>
            </View>
          ) : null}
          <TextInput
            style={[styles.qaInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Raison sociale"
            placeholderTextColor={colors.textTertiary}
            value={qaCompany}
            onChangeText={setQaCompany}
          />
          <View style={styles.qaRow}>
            <TextInput
              style={[styles.qaInput, styles.qaHalf, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              placeholder="Prénom"
              placeholderTextColor={colors.textTertiary}
              value={qaFirstName}
              onChangeText={setQaFirstName}
            />
            <TextInput
              style={[styles.qaInput, styles.qaHalf, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              placeholder="Nom"
              placeholderTextColor={colors.textTertiary}
              value={qaLastName}
              onChangeText={setQaLastName}
            />
          </View>
          <TextInput
            style={[styles.qaInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={qaEmail}
            onChangeText={setQaEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.qaInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Téléphone"
            placeholderTextColor={colors.textTertiary}
            value={qaPhone}
            onChangeText={setQaPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.qaSubmitBtn, { backgroundColor: colors.primary }]}
            onPress={handleQuickAdd}
            activeOpacity={0.7}
          >
            <Check size={14} color="#FFF" />
            <Text style={styles.qaSubmitBtnText}>Créer et sélectionner</Text>
          </TouchableOpacity>
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
  quickAddBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  quickAddBtnText: { fontSize: 13, fontWeight: '600' as const },
  quickAddForm: { padding: 12, gap: 8 },
  quickAddHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 4,
  },
  quickAddTitle: { fontSize: 14, fontWeight: '600' as const },
  qaErrorBanner: { padding: 8, borderRadius: 6 },
  qaInput: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
  },
  qaRow: { flexDirection: 'row' as const, gap: 8 },
  qaHalf: { flex: 1 },
  qaSubmitBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 10, borderRadius: 8, marginTop: 4,
  },
  qaSubmitBtnText: { fontSize: 13, fontWeight: '600' as const, color: '#FFF' },
});
