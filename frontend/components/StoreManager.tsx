import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MapPin, Phone, Warehouse, Plus, Pencil, Trash2, Store } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useData } from '@/contexts/DataContext';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import type { Store as StoreType } from '@/types';

interface StoreManagerProps {
  stores: StoreType[];
  onAdd: (store: Omit<StoreType, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, store: Partial<StoreType>) => void;
  onDelete: (id: string) => void;
}

export default React.memo(function StoreManager({ stores, onAdd, onUpdate, onDelete }: StoreManagerProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { warehouses } = useData();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', warehouseId: '', isActive: true });

  const resetForm = useCallback(() => {
    setForm({ name: '', address: '', phone: '', warehouseId: '', isActive: true });
    setEditingId(null);
  }, []);

  const handleOpenAdd = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const handleOpenEdit = useCallback((store: StoreType) => {
    setForm({
      name: store.name,
      address: store.address,
      phone: store.phone,
      warehouseId: store.warehouseId || '',
      isActive: store.isActive,
    });
    setEditingId(store.id);
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;
    const wh = warehouses.find(w => w.id === form.warehouseId);
    if (editingId) {
      onUpdate(editingId, { ...form, warehouseName: wh?.name });
    } else {
      onAdd({ ...form, warehouseName: wh?.name });
    }
    setModalVisible(false);
    resetForm();
  }, [form, editingId, warehouses, onAdd, onUpdate, resetForm]);

  const handleDelete = useCallback(() => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, onDelete]);

  return (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('stores.title')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenAdd}
          activeOpacity={0.7}
        >
          <Plus size={14} color="#FFF" />
          <Text style={styles.addBtnText}>{t('stores.new')}</Text>
        </TouchableOpacity>
      </View>

      {stores.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Store size={32} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('stores.noStores')}</Text>
          <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>{t('stores.noStoresHint')}</Text>
        </View>
      ) : (
        <View style={styles.storeList}>
          {stores.map(store => (
            <View key={store.id} style={[styles.storeCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.storeHeader}>
                <View style={[styles.storeIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Store size={18} color={colors.primary} />
                </View>
                <View style={styles.storeInfo}>
                  <Text style={[styles.storeName, { color: colors.text }]}>{store.name}</Text>
                  {store.address ? (
                    <View style={styles.storeDetail}>
                      <MapPin size={12} color={colors.textTertiary} />
                      <Text style={[styles.storeDetailText, { color: colors.textSecondary }]}>{store.address}</Text>
                    </View>
                  ) : null}
                  {store.phone ? (
                    <View style={styles.storeDetail}>
                      <Phone size={12} color={colors.textTertiary} />
                      <Text style={[styles.storeDetailText, { color: colors.textSecondary }]}>{store.phone}</Text>
                    </View>
                  ) : null}
                  {store.warehouseName ? (
                    <View style={styles.storeDetail}>
                      <Warehouse size={12} color={colors.textTertiary} />
                      <Text style={[styles.storeDetailText, { color: colors.textSecondary }]}>{store.warehouseName}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.storeActions}>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.surfaceHover }]}
                    onPress={() => handleOpenEdit(store)}
                    hitSlop={8}
                  >
                    <Pencil size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.dangerLight }]}
                    onPress={() => setDeleteId(store.id)}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <FormModal
        visible={modalVisible}
        title={editingId ? t('stores.edit') : t('stores.new')}
        onClose={() => { setModalVisible(false); resetForm(); }}
        onSubmit={handleSave}
        submitLabel={editingId ? t('common.save') : t('common.create')}
      >
        <FormField
          label={t('stores.name')}
          value={form.name}
          onChangeText={(v) => setForm(prev => ({ ...prev, name: v }))}
          placeholder="Ex: Boutique Plateau"
        />
        <FormField
          label={t('stores.address')}
          value={form.address}
          onChangeText={(v) => setForm(prev => ({ ...prev, address: v }))}
          placeholder="Adresse complète"
        />
        <FormField
          label={t('stores.phone')}
          value={form.phone}
          onChangeText={(v) => setForm(prev => ({ ...prev, phone: v }))}
          placeholder="+221 XX XXX XX XX"
        />
        {warehouses.length > 0 ? (
          <View style={styles.warehouseSelect}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('stores.warehouse')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.whScroll}>
              <TouchableOpacity
                style={[styles.whChip, !form.warehouseId && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setForm(prev => ({ ...prev, warehouseId: '' }))}
              >
                <Text style={[styles.whChipText, !form.warehouseId && { color: '#FFF' }]}>—</Text>
              </TouchableOpacity>
              {warehouses.map(wh => (
                <TouchableOpacity
                  key={wh.id}
                  style={[
                    styles.whChip,
                    { borderColor: colors.border },
                    form.warehouseId === wh.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setForm(prev => ({ ...prev, warehouseId: wh.id }))}
                >
                  <Text style={[styles.whChipText, { color: colors.text }, form.warehouseId === wh.id && { color: '#FFF' }]}>{wh.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </FormModal>

      <ConfirmModal
        visible={!!deleteId}
        title={t('stores.delete')}
        message={t('stores.deleteMsg')}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const },
  addBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  emptyCard: {
    borderRadius: 12, borderWidth: 1, padding: 32,
    alignItems: 'center' as const, gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '600' as const },
  emptyHint: { fontSize: 12, textAlign: 'center' as const },
  storeList: { gap: 10 },
  storeCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  storeHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  storeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  storeInfo: { flex: 1, gap: 3 },
  storeName: { fontSize: 14, fontWeight: '600' as const },
  storeDetail: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  storeDetailText: { fontSize: 12 },
  storeActions: { flexDirection: 'row' as const, gap: 6 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  warehouseSelect: { gap: 6, marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const },
  whScroll: { flexDirection: 'row' as const },
  whChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, marginRight: 8,
  },
  whChipText: { fontSize: 13, fontWeight: '500' as const },
});
