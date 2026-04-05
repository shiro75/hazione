/**
 * components/settings/ObjectivesSection.tsx
 *
 * Section Objectifs de vente.
 * Permet de définir un objectif CA global (annuel ou mensuel)
 * et des objectifs par produit (annuel ou mensuel).
 * Persisté dans AsyncStorage par utilisateur.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Save, Plus, X, ChevronDown, ChevronUp, Target } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { formatCurrencyInteger } from '@/utils/format';
import { StyleSheet } from 'react-native';
import { styles } from './settingsStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductObjective {
  mode: 'yearly' | 'monthly';
  yearlyTarget: number;
  monthlyTargets: Record<string, number>;
}

interface SalesObjectives {
  mode: 'yearly' | 'monthly';
  yearlyTarget: number;
  monthlyTargets: Record<string, number>;
  productTargets: Record<string, number>;
  productObjectives?: Record<string, ProductObjective>;
}

const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_LABELS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ObjectivesSection() {
  const { colors } = useTheme();
  const { activeProducts, company } = useData();
  const { successAlert, errorAlert } = useConfirm();
  const { user } = useAuth();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const cur = company.currency || 'EUR';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [objectives, setObjectives] = useState<SalesObjectives>({
    mode: 'yearly', yearlyTarget: 0, monthlyTargets: {}, productTargets: {}, productObjectives: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState(false);
  const [expandedProductMonths, setExpandedProductMonths] = useState<Record<string, boolean>>({});

  // ── Chargement ─────────────────────────────────────────────────────────────

  useEffect(() => {
    AsyncStorage.getItem(`sales-objectives-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as SalesObjectives;
          // Migration : si productObjectives absent, créer depuis productTargets
          if (!parsed.productObjectives) {
            const migrated: Record<string, ProductObjective> = {};
            if (parsed.productTargets) {
              Object.entries(parsed.productTargets).forEach(([pid, val]) => {
                migrated[pid] = { mode: 'yearly', yearlyTarget: val, monthlyTargets: {} };
              });
            }
            parsed.productObjectives = migrated;
          }
          setObjectives(parsed);
        } catch {}
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [COMPANY_ID]);

  // ── Sauvegarde ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const toSave = { ...objectives };
      const flatTargets: Record<string, number> = {};
      if (toSave.productObjectives) {
        Object.entries(toSave.productObjectives).forEach(([pid, obj]) => {
          if (obj.mode === 'yearly') flatTargets[pid] = obj.yearlyTarget;
          else flatTargets[pid] = MONTH_KEYS.reduce((s, k) => s + (obj.monthlyTargets[k] || 0), 0);
        });
      }
      toSave.productTargets = flatTargets;
      await AsyncStorage.setItem(`sales-objectives-${COMPANY_ID}`, JSON.stringify(toSave));
      setObjectives(toSave);
      successAlert('Objectifs enregistrés', 'Vos objectifs de vente ont été sauvegardés.');
    } catch {
      errorAlert('Erreur', 'Impossible de sauvegarder les objectifs.');
    } finally {
      setIsSaving(false);
    }
  }, [objectives, COMPANY_ID, successAlert, errorAlert]);

  // ── Mise à jour CA global ──────────────────────────────────────────────────

  const updateYearlyTarget = useCallback((val: string) => {
    setObjectives((prev) => ({ ...prev, yearlyTarget: parseFloat(val.replace(/,/g, '.')) || 0 }));
  }, []);

  const updateMonthlyTarget = useCallback((month: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives((prev) => ({ ...prev, monthlyTargets: { ...prev.monthlyTargets, [month]: num } }));
  }, []);

  // ── Mise à jour objectifs produit ──────────────────────────────────────────

  const updateProductObjectiveMode = useCallback((productId: string, mode: 'yearly' | 'monthly') => {
    setObjectives((prev) => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} };
      return { ...prev, productObjectives: { ...po, [productId]: { ...existing, mode } } };
    });
  }, []);

  const updateProductYearlyTarget = useCallback((productId: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives((prev) => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} };
      return { ...prev, productObjectives: { ...po, [productId]: { ...existing, yearlyTarget: num } }, productTargets: { ...prev.productTargets, [productId]: num } };
    });
  }, []);

  const updateProductMonthlyTarget = useCallback((productId: string, month: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives((prev) => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'monthly', yearlyTarget: 0, monthlyTargets: {} };
      const updatedMonthly = { ...existing.monthlyTargets, [month]: num };
      const total = MONTH_KEYS.reduce((s, k) => s + (updatedMonthly[k] || 0), 0);
      return { ...prev, productObjectives: { ...po, [productId]: { ...existing, monthlyTargets: updatedMonthly } }, productTargets: { ...prev.productTargets, [productId]: total } };
    });
  }, []);

  const removeProductTarget = useCallback((productId: string) => {
    setObjectives((prev) => {
      const updatedTargets = { ...prev.productTargets };
      delete updatedTargets[productId];
      const updatedObjectives = { ...(prev.productObjectives ?? {}) };
      delete updatedObjectives[productId];
      return { ...prev, productTargets: updatedTargets, productObjectives: updatedObjectives };
    });
  }, []);

  const addProductTarget = useCallback((productId: string) => {
    setObjectives((prev) => ({
      ...prev,
      productTargets: { ...prev.productTargets, [productId]: 0 },
      productObjectives: { ...(prev.productObjectives ?? {}), [productId]: { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} } },
    }));
    setShowProductPicker(false);
  }, []);

  const toggleProductMonthExpand = useCallback((productId: string) => {
    setExpandedProductMonths((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  const monthlySum = MONTH_KEYS.reduce((s, k) => s + (objectives.monthlyTargets[k] || 0), 0);
  const productObjEntries = Object.keys(objectives.productObjectives ?? objectives.productTargets ?? {});
  const availableProducts = activeProducts.filter((p) => !productObjEntries.includes(p.id));

  if (!isLoaded) {
    return (
      <View style={[styles.section, { alignItems: 'center', paddingVertical: 40 }]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      {/* ── Objectif CA global ── */}
      <View style={[styles.section, { gap: 0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Objectif de chiffre d'affaires</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Définissez un objectif de CA global (annuel ou par mois). Ces objectifs seront utilisés dans les graphiques du tableau de bord.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {(['yearly', 'monthly'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[objStyles.modeBtn, { backgroundColor: objectives.mode === m ? colors.primary : colors.background, borderColor: objectives.mode === m ? colors.primary : colors.border }]}
              onPress={() => setObjectives((prev) => ({ ...prev, mode: m }))}
              activeOpacity={0.7}
            >
              <Text style={[objStyles.modeBtnText, { color: objectives.mode === m ? '#FFF' : colors.textSecondary }]}>
                {m === 'yearly' ? 'Objectif annuel global' : 'Détail par mois'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {objectives.mode === 'yearly' ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Objectif CA annuel ({cur})</Text>
            <TextInput
              style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              value={objectives.yearlyTarget > 0 ? String(objectives.yearlyTarget) : ''}
              onChangeText={updateYearlyTarget}
              placeholder="Ex: 500000"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        ) : (
          <View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }} onPress={() => setExpandedMonths((p) => !p)} activeOpacity={0.7}>
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Objectifs mensuels ({cur})</Text>
                {monthlySum > 0 && <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>Total : {formatCurrencyInteger(monthlySum, cur)}</Text>}
              </View>
              {expandedMonths ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
            </TouchableOpacity>
            {expandedMonths && (
              <View style={isMobile ? { gap: 10 } : { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {MONTH_KEYS.map((mk, idx) => (
                  <View key={mk} style={[isMobile ? {} : { width: '30%' as any }, { marginBottom: 4 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 }}>{MONTH_LABELS_FR[idx]}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 13 }]}
                      value={objectives.monthlyTargets[mk] ? String(objectives.monthlyTargets[mk]) : ''}
                      onChangeText={(v) => updateMonthlyTarget(mk, v)}
                      placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Objectifs par produit ── */}
      <View style={[styles.section, { gap: 0 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Objectifs par produit</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Définissez un objectif de vente (en {cur}) pour chaque produit individuellement.
        </Text>

        {productObjEntries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ fontSize: 13, color: colors.textTertiary }}>Aucun objectif produit défini</Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginBottom: 16 }}>
            {productObjEntries.map((productId) => {
              const product = activeProducts.find((p) => p.id === productId);
              if (!product) return null;
              const po = objectives.productObjectives?.[productId] ?? { mode: 'yearly' as const, yearlyTarget: objectives.productTargets[productId] || 0, monthlyTargets: {} };
              const productMonthlySum = MONTH_KEYS.reduce((s, k) => s + (po.monthlyTargets[k] || 0), 0);
              const isMonthExpanded = expandedProductMonths[productId] ?? false;
              return (
                <View key={productId} style={[objStyles.productCard, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{product.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{product.categoryName || 'Sans catégorie'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeProductTarget(productId)} style={{ padding: 6 }}><X size={16} color={colors.danger} /></TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 10 }}>
                    {(['yearly', 'monthly'] as const).map((m) => (
                      <TouchableOpacity key={m} style={[objStyles.productModeBtn, { backgroundColor: po.mode === m ? colors.primary : colors.card, borderColor: po.mode === m ? colors.primary : colors.border }]} onPress={() => updateProductObjectiveMode(productId, m)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: po.mode === m ? '#FFF' : colors.textSecondary }}>{m === 'yearly' ? 'Annuel' : 'Par mois'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {po.mode === 'yearly' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>Objectif annuel ({cur})</Text>
                      <TextInput
                        style={[objStyles.productInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                        value={po.yearlyTarget > 0 ? String(po.yearlyTarget) : ''}
                        onChangeText={(v) => updateProductYearlyTarget(productId, v)}
                        placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
                      />
                    </View>
                  ) : (
                    <View>
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }} onPress={() => toggleProductMonthExpand(productId)} activeOpacity={0.7}>
                        <View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Objectifs mensuels ({cur})</Text>
                          {productMonthlySum > 0 && <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 1 }}>Total : {formatCurrencyInteger(productMonthlySum, cur)}</Text>}
                        </View>
                        {isMonthExpanded ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
                      </TouchableOpacity>
                      {isMonthExpanded && (
                        <View style={isMobile ? { gap: 8 } : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {MONTH_KEYS.map((mk, idx) => (
                            <View key={mk} style={[isMobile ? {} : { width: '30%' as any }, { marginBottom: 2 }]}>
                              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textSecondary, marginBottom: 3 }}>{MONTH_LABELS_FR[idx]}</Text>
                              <TextInput
                                style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 12, paddingVertical: 7 }]}
                                value={po.monthlyTargets[mk] ? String(po.monthlyTargets[mk]) : ''}
                                onChangeText={(v) => updateProductMonthlyTarget(productId, mk, v)}
                                placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad"
                              />
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {!showProductPicker ? (
          <TouchableOpacity style={[objStyles.addProductBtn, { borderColor: colors.primary }]} onPress={() => setShowProductPicker(true)} activeOpacity={0.7}>
            <Plus size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Ajouter un produit</Text>
          </TouchableOpacity>
        ) : (
          <View style={[objStyles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>Sélectionner un produit</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {availableProducts.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textTertiary, paddingVertical: 12, textAlign: 'center' }}>Tous les produits ont déjà un objectif</Text>
              ) : availableProducts.map((p) => (
                <TouchableOpacity key={p.id} style={[objStyles.pickerItem, { borderBottomColor: colors.borderLight }]} onPress={() => addProductTarget(p.id)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{p.categoryName || ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Bouton sauvegarde ── */}
      <TouchableOpacity style={[styles.sectionSaveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]} onPress={handleSave} disabled={isSaving} activeOpacity={0.7}>
        <Save size={16} color="#FFF" />
        <Text style={styles.sectionSaveBtnText}>{isSaving ? 'Enregistrement...' : 'Enregistrer les objectifs'}</Text>
      </TouchableOpacity>

      {/* ── Info ── */}
      <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Target size={16} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Utilisation</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Les objectifs définis ici seront utilisés dans la jauge "Objectif CA mensuel" du tableau de bord et dans les futurs rapports de performance.
          </Text>
        </View>
      </View>
    </View>
  );
}

const objStyles = StyleSheet.create({
  modeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  productCard: { borderWidth: 1, borderRadius: 10, padding: 14 },
  productModeBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1 },
  productInput: { width: 100, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, textAlign: 'right' },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed' },
  pickerContainer: { borderWidth: 1, borderRadius: 8, padding: 12 },
  pickerItem: { paddingVertical: 10, borderBottomWidth: 1 },
});