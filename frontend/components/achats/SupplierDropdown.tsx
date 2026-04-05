/**
 * components/achats/SupplierDropdown.tsx
 * Dropdown fournisseur avec recherche inline et bouton de création rapide.
 * Utilisé dans CommandesSection et FacturesRecuesSection.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Truck, ChevronDown, Search, X, Plus, Check } from 'lucide-react-native';
import type { Supplier } from '@/types';
import { styles } from './achatsStyles';

interface SupplierDropdownProps {
  suppliers: Supplier[];
  selectedId: string;
  onSelect: (id: string) => void;
  colors: any;
  onCreateSupplier?: () => void;
}

export default function SupplierDropdown({
  suppliers, selectedId, onSelect, colors, onCreateSupplier,
}: SupplierDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedName = suppliers.find((s) => s.id === selectedId)?.companyName || '';
  const filtered = search
    ? suppliers.filter((s) => s.companyName.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : suppliers.slice(0, 20);

  return (
    <View style={{ gap: 4 }}>
      <TouchableOpacity
        style={[styles.productSelectBtn, { backgroundColor: colors.inputBg, borderColor: selectedId ? colors.primary : colors.inputBorder }]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Truck size={15} color={colors.textSecondary} />
        <Text style={[styles.productSelectText, { color: selectedId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {selectedName || 'Sélectionner un fournisseur...'}
        </Text>
        {selectedId ? (
          <TouchableOpacity onPress={() => { onSelect(''); setOpen(false); }} hitSlop={8}>
            <X size={14} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <ChevronDown size={14} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {open ? (
        <View style={[styles.productDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.productDropdownSearch, { borderBottomColor: colors.borderLight }]}>
            <Search size={14} color={colors.textTertiary} />
            <TextInput
              style={[styles.productDropdownSearchInput, { color: colors.text }]}
              placeholder="Rechercher..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <X size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {onCreateSupplier ? (
            <TouchableOpacity
              style={[styles.productDropdownItem, { borderBottomColor: colors.borderLight, backgroundColor: colors.primaryLight }]}
              onPress={() => { setOpen(false); onCreateSupplier(); }}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.primary} />
              <Text style={[styles.productDropdownName, { color: colors.primary, fontWeight: '600' }]}>
                Ajouter un fournisseur
              </Text>
            </TouchableOpacity>
          ) : null}
          <ScrollView style={styles.productDropdownList} nestedScrollEnabled>
            {filtered.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.productDropdownItem,
                  { borderBottomColor: colors.borderLight },
                  selectedId === s.id && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => { onSelect(s.id); setOpen(false); setSearch(''); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.productDropdownName, { color: colors.text }]}>{s.companyName}</Text>
                  <Text style={[styles.productDropdownSku, { color: colors.textTertiary }]}>
                    {s.email || s.phone || 'Pas de contact'}
                  </Text>
                </View>
                {selectedId === s.id ? <Check size={14} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 ? (
              <Text style={[styles.productDropdownEmpty, { color: colors.textTertiary }]}>
                Aucun fournisseur trouvé
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}