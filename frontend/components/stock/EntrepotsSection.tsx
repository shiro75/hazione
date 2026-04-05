/**
 * components/stock/EntrepotsSection.tsx
 * Section Entrepôts — CRUD + transferts inter-entrepôts.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Plus, Pencil, Trash2, ArrowRightLeft, Warehouse } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { formatDate } from '@/utils/format';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import ConfirmModal from '@/components/ConfirmModal';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import type { Warehouse as WarehouseType } from '@/types';
import { styles } from './stockStyles';

export default function EntrepotsSection({ isMobile }: { isMobile: boolean }) {
  const { colors } = useTheme();
  const {
    warehouses, warehouseTransfers, activeProducts,
    createWarehouse, updateWarehouse, deleteWarehouse, createWarehouseTransfer,
  } = useData();

  // ── Formulaire entrepôt ────────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPostalCode, setFormPostalCode] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formCountry, setFormCountry] = useState('France');
  const [formResponsable, setFormResponsable] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Formulaire transfert ───────────────────────────────────────────────────
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState('');

  const physicalProducts = useMemo(() =>
    activeProducts.filter((p) => p.type !== 'service'),
    [activeProducts]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormName(''); setFormAddress(''); setFormPostalCode(''); setFormCity('');
    setFormCountry('France'); setFormResponsable(''); setFormPhone('');
    setFormIsDefault(false); setFormError('');
    setFormVisible(true);
  }, []);

  const openEdit = useCallback((wh: WarehouseType) => {
    setEditingId(wh.id);
    setFormName(wh.name); setFormAddress(wh.address);
    setFormPostalCode(''); setFormCity(''); setFormCountry('France');
    setFormResponsable(''); setFormIsDefault(wh.isDefault); setFormError('');
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!formName.trim()) { setFormError('Le nom est requis'); return; }
    const fullAddress = [formAddress.trim(), formPostalCode.trim(), formCity.trim(), formCountry.trim()].filter(Boolean).join(', ');
    const result = editingId
      ? updateWarehouse(editingId, { name: formName.trim(), address: fullAddress, isDefault: formIsDefault })
      : createWarehouse({ name: formName.trim(), address: fullAddress, isDefault: formIsDefault });
    if (!result.success) { setFormError(result.error || 'Erreur'); return; }
    setFormVisible(false);
  }, [formName, formAddress, formPostalCode, formCity, formCountry, formIsDefault, editingId, createWarehouse, updateWarehouse]);

  const handleDelete = useCallback(() => {
    if (deleteConfirm) { deleteWarehouse(deleteConfirm); setDeleteConfirm(null); }
  }, [deleteConfirm, deleteWarehouse]);

  const openTransfer = useCallback(() => {
    setTransferFrom(warehouses.length > 0 ? warehouses[0].id : '');
    setTransferTo(warehouses.length > 1 ? warehouses[1].id : '');
    setTransferProductId(''); setTransferQty(''); setTransferNotes(''); setTransferError('');
    setTransferVisible(true);
  }, [warehouses]);

  const handleTransfer = useCallback(() => {
    if (!transferFrom || !transferTo) { setTransferError('Sélectionnez les entrepôts'); return; }
    if (!transferProductId) { setTransferError('Sélectionnez un produit'); return; }
    const qty = parseInt(transferQty, 10);
    if (isNaN(qty) || qty <= 0) { setTransferError('Quantité invalide'); return; }
    const result = createWarehouseTransfer({ fromWarehouseId: transferFrom, toWarehouseId: transferTo, productId: transferProductId, quantity: qty, notes: transferNotes });
    if (!result.success) { setTransferError(result.error || 'Erreur'); return; }
    setTransferVisible(false);
  }, [transferFrom, transferTo, transferProductId, transferQty, transferNotes, createWarehouseTransfer]);

  return (
    <>
      <View style={styles.searchRow}>
        <TouchableOpacity style={[styles.whAddBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Plus size={16} color="#FFF" />
          {!isMobile && <Text style={styles.whAddBtnText}>Nouvel entrepôt</Text>}
        </TouchableOpacity>
        {warehouses.length >= 2 && (
          <TouchableOpacity style={[styles.whTransferBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={openTransfer}>
            <ArrowRightLeft size={16} color={colors.primary} />
            {!isMobile && <Text style={[styles.whTransferBtnText, { color: colors.primary }]}>Transfert</Text>}
          </TouchableOpacity>
        )}
      </View>

      {warehouses.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceHover }]}><Warehouse size={32} color={colors.textTertiary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun entrepôt pour l'instant</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Créez des entrepôts pour gérer votre stock par lieu de stockage</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {warehouses.map((wh) => (
            <View key={wh.id} style={[styles.whCard, { backgroundColor: colors.card, borderColor: wh.isDefault ? colors.primary : colors.cardBorder }]}>
              <View style={styles.whCardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.whCardName, { color: colors.text }]}>{wh.name}</Text>
                    {wh.isDefault && (
                      <View style={[styles.whDefaultBadge, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.whDefaultBadgeText, { color: colors.primary }]}>Par défaut</Text>
                      </View>
                    )}
                  </View>
                  {wh.address ? <Text style={[styles.whCardAddress, { color: colors.textTertiary }]}>{wh.address}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => openEdit(wh)} style={[styles.whIconBtn, { backgroundColor: colors.primaryLight }]}><Pencil size={13} color={colors.primary} /></TouchableOpacity>
                  {!wh.isDefault && <TouchableOpacity onPress={() => setDeleteConfirm(wh.id)} style={[styles.whIconBtn, { backgroundColor: colors.dangerLight }]}><Trash2 size={13} color={colors.danger} /></TouchableOpacity>}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Transferts récents */}
      {warehouseTransfers.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.whSectionTitle, { color: colors.text }]}>Transferts récents</Text>
          <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {warehouseTransfers.slice(0, 20).map((t, i) => (
              <View key={t.id} style={[styles.movementRow, i < Math.min(warehouseTransfers.length, 20) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.typeBadge, { backgroundColor: colors.primaryLight }]}><ArrowRightLeft size={14} color={colors.primary} /></View>
                <View style={styles.movementInfo}>
                  <Text style={[styles.movementProduct, { color: colors.text }]}>{t.productName} ×{t.quantity}</Text>
                  <Text style={[styles.movementMeta, { color: colors.textTertiary }]}>{t.fromWarehouseName} → {t.toWarehouseName} · {formatDate(t.createdAt)}</Text>
                  {t.notes ? <Text style={[styles.movementNotes, { color: colors.textSecondary }]}>{t.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Formulaire entrepôt */}
      <FormModal visible={formVisible} onClose={() => setFormVisible(false)} title={editingId ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'} onSubmit={handleSubmit} submitLabel={editingId ? 'Mettre à jour' : 'Créer'}>
        {formError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{formError}</Text></View> : null}
        <FormField label="Nom" value={formName} onChangeText={setFormName} placeholder="Nom de l'entrepôt" required />
        <FormField label="Responsable" value={formResponsable} onChangeText={setFormResponsable} placeholder="Nom du responsable (optionnel)" />
        <AddressFields address={formAddress} postalCode={formPostalCode} city={formCity} country={formCountry} onAddressChange={setFormAddress} onPostalCodeChange={setFormPostalCode} onCityChange={setFormCity} onCountryChange={setFormCountry} />
        <PhoneField value={formPhone} onChangeText={setFormPhone} label="Téléphone (optionnel)" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Entrepôt par défaut</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Définir comme lieu de stockage principal</Text>
          </View>
          <TouchableOpacity onPress={() => setFormIsDefault(!formIsDefault)} style={[{ width: 48, height: 28, borderRadius: 14, backgroundColor: formIsDefault ? colors.primary : colors.border, justifyContent: 'center', paddingHorizontal: 2 }]}>
            <View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', alignSelf: formIsDefault ? 'flex-end' : 'flex-start' }]} />
          </TouchableOpacity>
        </View>
      </FormModal>

      {/* Formulaire transfert */}
      <FormModal visible={transferVisible} onClose={() => setTransferVisible(false)} title="Transfert inter-entrepôts" subtitle="Déplacer du stock entre entrepôts" onSubmit={handleTransfer} submitLabel="Transférer">
        {transferError ? <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight }]}><Text style={[styles.errorText, { color: colors.danger }]}>{transferError}</Text></View> : null}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>Entrepôt source</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {warehouses.map((wh) => (
              <TouchableOpacity key={wh.id} style={[styles.whSelectChip, { backgroundColor: transferFrom === wh.id ? colors.primary : colors.inputBg, borderColor: transferFrom === wh.id ? colors.primary : colors.inputBorder }]} onPress={() => setTransferFrom(wh.id)}>
                <Text style={[styles.whSelectChipText, { color: transferFrom === wh.id ? '#FFF' : colors.text }]}>{wh.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>Entrepôt destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {warehouses.filter((wh) => wh.id !== transferFrom).map((wh) => (
              <TouchableOpacity key={wh.id} style={[styles.whSelectChip, { backgroundColor: transferTo === wh.id ? colors.primary : colors.inputBg, borderColor: transferTo === wh.id ? colors.primary : colors.inputBorder }]} onPress={() => setTransferTo(wh.id)}>
                <Text style={[styles.whSelectChipText, { color: transferTo === wh.id ? '#FFF' : colors.text }]}>{wh.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>Produit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {physicalProducts.slice(0, 30).map((p) => (
              <TouchableOpacity key={p.id} style={[styles.whSelectChip, { backgroundColor: transferProductId === p.id ? colors.primary : colors.inputBg, borderColor: transferProductId === p.id ? colors.primary : colors.inputBorder }]} onPress={() => setTransferProductId(p.id)}>
                <Text style={[styles.whSelectChipText, { color: transferProductId === p.id ? '#FFF' : colors.text }]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <FormField label="Quantité" value={transferQty} onChangeText={setTransferQty} placeholder="Quantité à transférer" keyboardType="numeric" required />
        <FormField label="Notes" value={transferNotes} onChangeText={setTransferNotes} placeholder="Notes (optionnel)" />
      </FormModal>

      <ConfirmModal visible={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="Supprimer cet entrepôt ?" message="L'entrepôt sera définitivement supprimé." confirmLabel="Supprimer" destructive />
    </>
  );
}