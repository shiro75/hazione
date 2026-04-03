/**
 * @fileoverview Settings screen with tabs: Company, Invoicing, Reminders, E-invoicing, Modules, API.
 * Manages company profile, billing config, VAT, payment terms, currency selection,
 * module toggles, API keys, legal links, and account deletion with password confirmation.
 * Scrolls to top on tab change.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, Switch } from 'react-native';
import { Building2, FileText, Save, Bell, Zap, Shield, LayoutGrid, Lock, Check, LogOut, Trash2, AlertTriangle, ChevronDown, Key, Scale, ChevronRight, CreditCard, Target, Plus, X, ChevronUp } from 'lucide-react-native';
import { Modal } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import { MODULE_CONFIGS, PLAN_LABELS, PLAN_COLORS } from '@/constants/modules';
import PageHeader from '@/components/PageHeader';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import { useI18n } from '@/contexts/I18nContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useBanking, type PaymentProviderType } from '@/contexts/BankingContext';
import { ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatCurrencyInteger } from '@/utils/format';


const CURRENCY_OPTIONS = [
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'CHF (CHF)', value: 'CHF' },
  { label: 'USD ($)', value: 'USD' },
  { label: 'GBP (£)', value: 'GBP' },
  { label: 'CAD (CA$)', value: 'CAD' },
  { label: 'XOF (CFA)', value: 'XOF' },
];

function CurrencyPicker({ value, onSelect }: { value: string; onSelect: (val: string) => void }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = CURRENCY_OPTIONS.find((o) => o.value === value);

  return (
    <View style={currencyStyles.container}>
      <Text style={[currencyStyles.label, { color: colors.textSecondary }]}>Devise</Text>
      <TouchableOpacity
        style={[
          currencyStyles.selector,
          {
            backgroundColor: colors.inputBg,
            borderColor: visible ? colors.primary : colors.inputBorder,
          },
        ]}
        onPress={() => setVisible((p) => !p)}
        activeOpacity={0.7}
      >
        <Text style={[currencyStyles.selectorText, { color: colors.text }]}>
          {selected ? selected.label : value}
        </Text>
        <ChevronDown size={16} color={visible ? colors.primary : colors.textTertiary} />
      </TouchableOpacity>

      {visible && (
        <View style={[currencyStyles.dropdown, { backgroundColor: colors.card, borderColor: colors.inputBorder }]}>
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = opt.value === value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  currencyStyles.option,
                  { borderBottomColor: colors.borderLight },
                  isActive && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => { onSelect(opt.value); setVisible(false); }}
                activeOpacity={0.7}
              >
                <Text style={[currencyStyles.optionText, { color: isActive ? colors.primary : colors.text }]}>
                  {opt.label}
                </Text>
                {isActive && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const currencyStyles = StyleSheet.create({
  container: { gap: 6, marginBottom: 16, zIndex: 10 },
  label: { fontSize: 13, fontWeight: '500' as const },
  selector: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
  },
  selectorText: { fontSize: 14, fontWeight: '500' as const },
  dropdown: {
    borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' as const,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  option: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1,
  },
  optionText: { fontSize: 14, fontWeight: '500' as const },
});

import ApiKeysManager from '@/components/ApiKeysManager';
import type { ApiKey } from '@/types';

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

function ObjectivesSection() {
  const { colors } = useTheme();
  const { activeProducts, company } = useData();
  const { successAlert, errorAlert } = useConfirm();
  const { user } = useAuth();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const cur = company.currency || 'EUR';
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [objectives, setObjectives] = useState<SalesObjectives>({
    mode: 'yearly',
    yearlyTarget: 0,
    monthlyTargets: {},
    productTargets: {},
    productObjectives: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState(false);
  const [expandedProductMonths, setExpandedProductMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem(`sales-objectives-${COMPANY_ID}`).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as SalesObjectives;
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

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const toSave = { ...objectives };
      const flatTargets: Record<string, number> = {};
      if (toSave.productObjectives) {
        Object.entries(toSave.productObjectives).forEach(([pid, obj]) => {
          if (obj.mode === 'yearly') {
            flatTargets[pid] = obj.yearlyTarget;
          } else {
            flatTargets[pid] = MONTH_KEYS.reduce((s, k) => s + (obj.monthlyTargets[k] || 0), 0);
          }
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

  const updateYearlyTarget = useCallback((val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives(prev => ({ ...prev, yearlyTarget: num }));
  }, []);

  const updateMonthlyTarget = useCallback((month: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives(prev => ({
      ...prev,
      monthlyTargets: { ...prev.monthlyTargets, [month]: num },
    }));
  }, []);

  const updateProductObjectiveMode = useCallback((productId: string, mode: 'yearly' | 'monthly') => {
    setObjectives(prev => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} };
      return {
        ...prev,
        productObjectives: { ...po, [productId]: { ...existing, mode } },
      };
    });
  }, []);

  const updateProductYearlyTarget = useCallback((productId: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives(prev => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} };
      return {
        ...prev,
        productObjectives: { ...po, [productId]: { ...existing, yearlyTarget: num } },
        productTargets: { ...prev.productTargets, [productId]: num },
      };
    });
  }, []);

  const updateProductMonthlyTarget = useCallback((productId: string, month: string, val: string) => {
    const num = parseFloat(val.replace(/,/g, '.')) || 0;
    setObjectives(prev => {
      const po = prev.productObjectives ?? {};
      const existing = po[productId] ?? { mode: 'monthly', yearlyTarget: 0, monthlyTargets: {} };
      const updatedMonthly = { ...existing.monthlyTargets, [month]: num };
      const total = MONTH_KEYS.reduce((s, k) => s + (updatedMonthly[k] || 0), 0);
      return {
        ...prev,
        productObjectives: { ...po, [productId]: { ...existing, monthlyTargets: updatedMonthly } },
        productTargets: { ...prev.productTargets, [productId]: total },
      };
    });
  }, []);

  const removeProductTarget = useCallback((productId: string) => {
    setObjectives(prev => {
      const updatedTargets = { ...prev.productTargets };
      delete updatedTargets[productId];
      const updatedObjectives = { ...(prev.productObjectives ?? {}) };
      delete updatedObjectives[productId];
      return { ...prev, productTargets: updatedTargets, productObjectives: updatedObjectives };
    });
  }, []);

  const addProductTarget = useCallback((productId: string) => {
    setObjectives(prev => ({
      ...prev,
      productTargets: { ...prev.productTargets, [productId]: 0 },
      productObjectives: {
        ...(prev.productObjectives ?? {}),
        [productId]: { mode: 'yearly', yearlyTarget: 0, monthlyTargets: {} },
      },
    }));
    setShowProductPicker(false);
  }, []);

  const toggleProductMonthExpand = useCallback((productId: string) => {
    setExpandedProductMonths(prev => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  const monthlySum = MONTH_KEYS.reduce((s, k) => s + (objectives.monthlyTargets[k] || 0), 0);

  const productObjEntries = Object.keys(objectives.productObjectives ?? objectives.productTargets ?? {});
  const availableProducts = activeProducts.filter(p => !productObjEntries.includes(p.id));

  if (!isLoaded) {
    return (
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder, alignItems: 'center', paddingVertical: 40 }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Objectif de chiffre d'affaires</Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Définissez un objectif de CA global (annuel ou par mois). Ces objectifs seront utilisés dans les graphiques du tableau de bord.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <TouchableOpacity
            style={[objStyles.modeBtn, { backgroundColor: objectives.mode === 'yearly' ? colors.primary : colors.background, borderColor: objectives.mode === 'yearly' ? colors.primary : colors.border }]}
            onPress={() => setObjectives(prev => ({ ...prev, mode: 'yearly' }))}
            activeOpacity={0.7}
          >
            <Text style={[objStyles.modeBtnText, { color: objectives.mode === 'yearly' ? '#FFF' : colors.textSecondary }]}>Objectif annuel global</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[objStyles.modeBtn, { backgroundColor: objectives.mode === 'monthly' ? colors.primary : colors.background, borderColor: objectives.mode === 'monthly' ? colors.primary : colors.border }]}
            onPress={() => setObjectives(prev => ({ ...prev, mode: 'monthly' }))}
            activeOpacity={0.7}
          >
            <Text style={[objStyles.modeBtnText, { color: objectives.mode === 'monthly' ? '#FFF' : colors.textSecondary }]}>Détail par mois</Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
              onPress={() => setExpandedMonths(prev => !prev)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Objectifs mensuels ({cur})</Text>
                {monthlySum > 0 && (
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' as const, marginTop: 2 }}>
                    Total : {formatCurrencyInteger(monthlySum, cur)}
                  </Text>
                )}
              </View>
              {expandedMonths ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
            </TouchableOpacity>
            {expandedMonths && (
              <View style={[isMobile ? { gap: 10 } : { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}>
                {MONTH_KEYS.map((mk, idx) => (
                  <View key={mk} style={[isMobile ? {} : { width: '30%' as never }, { marginBottom: 4 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '500' as const, color: colors.textSecondary, marginBottom: 4 }}>{MONTH_LABELS_FR[idx]}</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 13 }]}
                      value={objectives.monthlyTargets[mk] ? String(objectives.monthlyTargets[mk]) : ''}
                      onChangeText={(v) => updateMonthlyTarget(mk, v)}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
              const product = activeProducts.find(p => p.id === productId);
              if (!product) return null;
              const po = objectives.productObjectives?.[productId] ?? { mode: 'yearly' as const, yearlyTarget: objectives.productTargets[productId] || 0, monthlyTargets: {} };
              const productMonthlySum = MONTH_KEYS.reduce((s, k) => s + (po.monthlyTargets[k] || 0), 0);
              const isMonthExpanded = expandedProductMonths[productId] ?? false;
              return (
                <View key={productId} style={[objStyles.productCard, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }} numberOfLines={1}>{product.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{product.categoryName || 'Sans catégorie'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeProductTarget(productId)} style={{ padding: 6 }}>
                      <X size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row' as const, gap: 6, marginTop: 10, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[objStyles.productModeBtn, { backgroundColor: po.mode === 'yearly' ? colors.primary : colors.card, borderColor: po.mode === 'yearly' ? colors.primary : colors.border }]}
                      onPress={() => updateProductObjectiveMode(productId, 'yearly')}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: po.mode === 'yearly' ? '#FFF' : colors.textSecondary }}>Annuel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[objStyles.productModeBtn, { backgroundColor: po.mode === 'monthly' ? colors.primary : colors.card, borderColor: po.mode === 'monthly' ? colors.primary : colors.border }]}
                      onPress={() => updateProductObjectiveMode(productId, 'monthly')}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600' as const, color: po.mode === 'monthly' ? '#FFF' : colors.textSecondary }}>Par mois</Text>
                    </TouchableOpacity>
                  </View>

                  {po.mode === 'yearly' ? (
                    <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1 }}>Objectif annuel ({cur})</Text>
                      <TextInput
                        style={[objStyles.productInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                        value={po.yearlyTarget > 0 ? String(po.yearlyTarget) : ''}
                        onChangeText={(v) => updateProductYearlyTarget(productId, v)}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : (
                    <View>
                      <TouchableOpacity
                        style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 8 }}
                        onPress={() => toggleProductMonthExpand(productId)}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Objectifs mensuels ({cur})</Text>
                          {productMonthlySum > 0 && (
                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' as const, marginTop: 1 }}>
                              Total : {formatCurrencyInteger(productMonthlySum, cur)}
                            </Text>
                          )}
                        </View>
                        {isMonthExpanded ? <ChevronUp size={14} color={colors.textTertiary} /> : <ChevronDown size={14} color={colors.textTertiary} />}
                      </TouchableOpacity>
                      {isMonthExpanded && (
                        <View style={[isMobile ? { gap: 8 } : { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 }]}>
                          {MONTH_KEYS.map((mk, idx) => (
                            <View key={mk} style={[isMobile ? {} : { width: '30%' as never }, { marginBottom: 2 }]}>
                              <Text style={{ fontSize: 11, fontWeight: '500' as const, color: colors.textSecondary, marginBottom: 3 }}>{MONTH_LABELS_FR[idx]}</Text>
                              <TextInput
                                style={[styles.fieldInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, fontSize: 12, paddingVertical: 7 }]}
                                value={po.monthlyTargets[mk] ? String(po.monthlyTargets[mk]) : ''}
                                onChangeText={(v) => updateProductMonthlyTarget(productId, mk, v)}
                                placeholder="0"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="decimal-pad"
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
          <TouchableOpacity
            style={[objStyles.addProductBtn, { borderColor: colors.primary }]}
            onPress={() => setShowProductPicker(true)}
            activeOpacity={0.7}
          >
            <Plus size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.primary }}>Ajouter un produit</Text>
          </TouchableOpacity>
        ) : (
          <View style={[objStyles.pickerContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600' as const, color: colors.text }}>Sélectionner un produit</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <X size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {availableProducts.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textTertiary, paddingVertical: 12, textAlign: 'center' }}>Tous les produits ont déjà un objectif</Text>
              ) : (
                availableProducts.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[objStyles.pickerItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => addProductTarget(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{p.categoryName || ''}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.sectionSaveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.7}
      >
        <Save size={16} color="#FFF" />
        <Text style={styles.sectionSaveBtnText}>{isSaving ? 'Enregistrement...' : 'Enregistrer les objectifs'}</Text>
      </TouchableOpacity>

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
  modeBtn: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  modeBtnText: { fontSize: 13, fontWeight: '600' as const },
  productCard: {
    borderWidth: 1, borderRadius: 10, padding: 14,
  },
  productModeBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1,
  },
  productInput: {
    width: 100, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, textAlign: 'right' as const,
  },
  addProductBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed' as const,
  },
  pickerContainer: {
    borderWidth: 1, borderRadius: 8, padding: 12,
  },
  pickerItem: {
    paddingVertical: 10, borderBottomWidth: 1,
  },
});

function ApiKeysSection() {
  const [apiKeys, setApiKeys] = React.useState<ApiKey[]>([]);

  const handleGenerate = React.useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'hzi_';
    for (let i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    const newKey: ApiKey = {
      id: `ak_${Date.now()}`,
      companyId: '',
      key,
      name: 'API Key',
      isActive: true,
      callsThisMonth: 0,
      createdAt: new Date().toISOString(),
    };
    setApiKeys(prev => [...prev, newKey]);
  }, []);

  const handleRevoke = React.useCallback((id: string) => {
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: false, revokedAt: new Date().toISOString() } : k));
  }, []);

  return <ApiKeysManager apiKeys={apiKeys} onGenerate={handleGenerate} onRevoke={handleRevoke} />;
}

function BankingConfigSection() {
  const { colors } = useTheme();
  const { config, connectAccount, disconnectAccount } = useBanking();
  const { successAlert, errorAlert, confirm } = useConfirm();
  const [connectingProvider, setConnectingProvider] = useState<PaymentProviderType>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>(null);

  const handleConnect = React.useCallback(async () => {
    if (!selectedProvider || !accountIdInput.trim()) return;
    setConnectingProvider(selectedProvider);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await connectAccount(selectedProvider, accountIdInput.trim());
      setShowConnectForm(false);
      setAccountIdInput('');
      setSelectedProvider(null);
      successAlert('Connexion réussie', `Votre compte ${selectedProvider === 'stripe' ? 'Stripe' : 'CinetPay'} a été connecté avec succès.`);
    } catch {
      errorAlert('Erreur', 'Impossible de connecter le compte. Veuillez réessayer.');
    } finally {
      setConnectingProvider(null);
    }
  }, [selectedProvider, accountIdInput, connectAccount, successAlert, errorAlert]);

  const handleDisconnect = React.useCallback(() => {
    confirm(
      'Déconnecter',
      'Voulez-vous vraiment déconnecter votre compte de paiement ? Les paiements CB et Mobile Money seront désactivés.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: async () => { await disconnectAccount(); } },
      ]
    );
  }, [disconnectAccount, confirm]);

  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations bancaires</Text>
      <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
        Configurez votre compte de paiement pour accepter les paiements CB et Mobile Money.
      </Text>

      <View style={[bankingStyles.statusCard, { borderColor: config.isConnected ? '#05966940' : colors.danger + '40' }]}>
        <View style={[bankingStyles.statusDotLg, { backgroundColor: config.isConnected ? '#059669' : colors.danger }]} />
        <View style={{ flex: 1 }}>
          <Text style={[bankingStyles.statusTitle, { color: colors.text }]}>
            {config.isConnected ? 'Connecté' : 'Non configuré'}
          </Text>
          {config.isConnected && config.provider ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              {config.provider === 'stripe' ? 'Stripe (CB)' : 'CinetPay (Mobile Money)'} · ID: {config.connectedAccountId.substring(0, 12)}...
            </Text>
          ) : null}
          {config.isConnected && config.connectedAt ? (
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Connecté le {new Date(config.connectedAt).toLocaleDateString('fr-FR')}
            </Text>
          ) : null}
        </View>
      </View>

      {config.isConnected ? (
        <TouchableOpacity
          style={[bankingStyles.disconnectBtn, { borderColor: colors.danger }]}
          onPress={handleDisconnect}
          activeOpacity={0.7}
        >
          <Text style={[bankingStyles.disconnectBtnText, { color: colors.danger }]}>Déconnecter le compte</Text>
        </TouchableOpacity>
      ) : !showConnectForm ? (
        <TouchableOpacity
          style={[bankingStyles.connectBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowConnectForm(true)}
          activeOpacity={0.8}
        >
          <Text style={bankingStyles.connectBtnText}>Connecter mon compte de paiement</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }}>Choisir un fournisseur</Text>
          <View style={bankingStyles.providerGrid}>
            <TouchableOpacity
              style={[
                bankingStyles.providerCard,
                {
                  backgroundColor: selectedProvider === 'stripe' ? '#635BFF18' : colors.background,
                  borderColor: selectedProvider === 'stripe' ? '#635BFF' : colors.border,
                  borderWidth: selectedProvider === 'stripe' ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedProvider('stripe')}
              activeOpacity={0.7}
            >
              <CreditCard size={24} color={selectedProvider === 'stripe' ? '#635BFF' : colors.textSecondary} />
              <Text style={[bankingStyles.providerName, { color: selectedProvider === 'stripe' ? '#635BFF' : colors.text }]}>Stripe</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Carte Bancaire</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                bankingStyles.providerCard,
                {
                  backgroundColor: selectedProvider === 'cinetpay' ? '#00D4AA18' : colors.background,
                  borderColor: selectedProvider === 'cinetpay' ? '#00D4AA' : colors.border,
                  borderWidth: selectedProvider === 'cinetpay' ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedProvider('cinetpay')}
              activeOpacity={0.7}
            >
              <CreditCard size={24} color={selectedProvider === 'cinetpay' ? '#00D4AA' : colors.textSecondary} />
              <Text style={[bankingStyles.providerName, { color: selectedProvider === 'cinetpay' ? '#00D4AA' : colors.text }]}>CinetPay</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Mobile Money</Text>
            </TouchableOpacity>
          </View>
          {selectedProvider ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '500' as const, color: colors.textSecondary }}>
                {selectedProvider === 'stripe' ? 'Stripe Connected Account ID' : 'CinetPay Site ID / API Key'}
              </Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                ]}
                value={accountIdInput}
                onChangeText={setAccountIdInput}
                placeholder={selectedProvider === 'stripe' ? 'acct_XXXXXXXXXXXX' : 'XXXXXXXX'}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row' as const, gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[bankingStyles.formCancelBtn, { borderColor: colors.border }]}
              onPress={() => { setShowConnectForm(false); setSelectedProvider(null); setAccountIdInput(''); }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.textSecondary }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                bankingStyles.formSubmitBtn,
                { backgroundColor: (selectedProvider && accountIdInput.trim()) ? colors.primary : colors.textTertiary },
              ]}
              onPress={handleConnect}
              disabled={!selectedProvider || !accountIdInput.trim() || connectingProvider !== null}
              activeOpacity={0.8}
            >
              {connectingProvider ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' as const }}>Connecter</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Shield size={16} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Fonctionnement</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Chaque commerçant HaziOne dispose de son propre compte connecté.{"\n"}
            Les paiements CB transitent via Stripe Connect et les paiements Mobile Money via CinetPay, directement vers votre compte.{"\n"}
            Les clés sont stockées de manière sécurisée par utilisateur.
          </Text>
        </View>
      </View>

      <View style={[styles.infoBox, { backgroundColor: colors.warningLight, borderColor: colors.warning, marginTop: 12 }]}>
        <CreditCard size={16} color={colors.warning} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.warning }]}>Restrictions</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Sans configuration bancaire :{"\n"}
            {"•"} Paiement en espèces : toujours disponible{"\n"}
            {"•"} CB / Mobile Money : désactivés en Caisse et Factures{"\n"}
            Après connexion, tous les modes sont disponibles.
          </Text>
        </View>
      </View>
    </View>
  );
}

const bankingStyles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    borderWidth: 1.5, borderRadius: 12, padding: 16,
  },
  statusDotLg: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 15, fontWeight: '600' as const },
  connectBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 14, borderRadius: 10,
  },
  connectBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  disconnectBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
  },
  disconnectBtnText: { fontSize: 14, fontWeight: '600' as const },
  providerGrid: { flexDirection: 'row' as const, gap: 12 },
  providerCard: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 18, borderRadius: 12, gap: 6,
  },
  providerName: { fontSize: 15, fontWeight: '700' as const },
  formCancelBtn: {
    flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  formSubmitBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
});

type SettingsTab = 'company' | 'invoicing' | 'reminders' | 'einvoicing' | 'modules' | 'api' | 'banking' | 'objectives';

const TAB_KEYS: { key: SettingsTab; labelKey: string; icon: React.ComponentType<{ size: number; color: string }>; rawLabel?: string }[] = [
  { key: 'company', labelKey: 'settings.company', icon: Building2 },
  { key: 'invoicing', labelKey: 'settings.billing', icon: FileText },
  { key: 'objectives', labelKey: '', rawLabel: 'Objectifs', icon: Target },
  { key: 'reminders', labelKey: 'settings.reminders', icon: Bell },
  { key: 'einvoicing', labelKey: 'settings.einvoicing', icon: Zap },
  { key: 'banking', labelKey: '', rawLabel: 'Paiements', icon: CreditCard },
  { key: 'modules', labelKey: 'settings.modules', icon: LayoutGrid },
  { key: 'api', labelKey: 'api.title', icon: Key },
];



export default function SettingsScreen() {
  const { colors } = useTheme();
  const {
    company: dbCompany, currentPlan, toggleModule, isModuleEnabled, isModuleAvailable, updateCompanySettings,
  } = useData();
  const { signOut, user, deleteAccount } = useAuth();
  const { canAccess } = useRole();
  const { t } = useI18n();
  const router = useRouter();
  const { errorAlert } = useConfirm();

  if (!canAccess('settings')) {
    return <AccessDenied />;
  }
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [deletePasswordError, setDeletePasswordError] = useState<string>('');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.replace('/landing');
    } catch {
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;
    if (!deletePassword.trim()) {
      setDeletePasswordError(t('settings.passwordRequired'));
      return;
    }
    setDeletePasswordError('');
    setIsDeleting(true);
    try {
      const result = await deleteAccount(deletePassword);
      if (!result.success) {
        if (result.error === 'Mot de passe incorrect.') {
          setDeletePasswordError(t('settings.passwordIncorrect'));
        } else {
          errorAlert('Erreur', result.error || 'Impossible de supprimer le compte.');
        }
        setIsDeleting(false);
        return;
      }
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setDeletePassword('');
      setDeletePasswordError('');
      setIsDeleting(false);
      router.replace('/landing');
      return;
    } catch {
      errorAlert('Erreur', 'Une erreur est survenue lors de la suppression. Veuillez réessayer.');
      setIsDeleting(false);
    }
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);

  const [company, setCompany] = useState(dbCompany);

  useEffect(() => {
    if (dbCompany) {
      const meta = user?.user_metadata;
      const isMock = dbCompany.id === 'comp_001' || dbCompany.name === 'Dupont Solutions';
      if (isMock && meta) {
        setCompany({
          ...dbCompany,
          name: meta.company_name || dbCompany.name,
          siret: meta.siret || dbCompany.siret,
          address: meta.address || dbCompany.address,
          postalCode: meta.postal_code || dbCompany.postalCode,
          city: meta.city || dbCompany.city,
          country: meta.country || dbCompany.country,
          phone: meta.phone || dbCompany.phone,
          email: user?.email || dbCompany.email,
        });
      } else {
        const needsUserFill = !dbCompany.name || !dbCompany.email;
        if (needsUserFill && meta) {
          setCompany({
            ...dbCompany,
            name: dbCompany.name || meta.company_name || '',
            siret: dbCompany.siret || meta.siret || '',
            address: dbCompany.address || meta.address || '',
            postalCode: dbCompany.postalCode || meta.postal_code || '',
            city: dbCompany.city || meta.city || '',
            country: dbCompany.country || meta.country || 'France',
            phone: dbCompany.phone || meta.phone || '',
            email: dbCompany.email || user?.email || '',
          });
        } else {
          setCompany(dbCompany);
        }
      }
    }
  }, [dbCompany, user]);

  const updateField = (field: string, value: string) => {
    setCompany((prev) => ({ ...prev, [field]: value }));
  };

  const renderField = (label: string, field: string, value: string, options?: { editable?: boolean }) => (
    <View style={styles.fieldGroup} key={field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            color: colors.text,
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
          },
          options?.editable === false && { opacity: 0.6 },
        ]}
        value={value}
        onChangeText={(v) => updateField(field, v)}
        editable={options?.editable !== false}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader
        title={t('settings.title')}
        action={
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }}
            onPress={async () => {
              setIsSaving(true);
              try {
                await updateCompanySettings(company);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Save size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.dangerLight }}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
            testID="settings-logout-btn"
          >
            <LogOut size={16} color={colors.danger} />
          </TouchableOpacity>
          </View>
        }
      />

      <View style={[styles.tabBarWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {TAB_KEYS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItemUnified, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => { setActiveTab(tab.key); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabLabelUnified, { color: active ? colors.primary : colors.textSecondary }]}>
                  {tab.rawLabel || t(tab.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {activeTab === 'company' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.companyInfo')}</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                {t('settings.companyInfoDesc')}
              </Text>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Raison sociale', 'name', company.name)}
                {renderField('Forme juridique', 'legalStructure', company.legalStructure)}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('SIRET', 'siret', company.siret)}
                {renderField('Numéro de TVA', 'vatNumber', company.vatNumber)}
              </View>
              <AddressFields
                address={company.address}
                postalCode={company.postalCode}
                city={company.city}
                country={company.country || 'France'}
                onAddressChange={(v) => updateField('address', v)}
                onPostalCodeChange={(v) => updateField('postalCode', v)}
                onCityChange={(v) => updateField('city', v)}
                onCountryChange={(v) => updateField('country', v)}
              />
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                <View style={styles.fieldGroup}>
                  <PhoneField value={company.phone} onChangeText={(v) => updateField('phone', v)} />
                </View>
                {renderField('Email', 'email', company.email)}
              </View>
              {renderField('Site web', 'website', company.website)}

              <View style={[styles.bankingSubSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 8 }]}>{t('settings.bankingInfo')}</Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                  {t('settings.bankingInfoDesc')}
                </Text>
                {renderField('IBAN', 'iban', company.iban)}
                {renderField('BIC', 'bic', company.bic)}
              </View>
            </View>
          )}

          {activeTab === 'invoicing' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.billingSettings')}</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                {t('settings.billingSettingsDesc')}
              </Text>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe facture', 'invoicePrefix', company.invoicePrefix)}
                {renderField('Prochain numéro', 'invoiceNextNumber', company.invoiceNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe devis', 'quotePrefix', company.quotePrefix)}
                {renderField('Prochain numéro devis', 'quoteNextNumber', company.quoteNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Préfixe avoir', 'creditNotePrefix', company.creditNotePrefix)}
                {renderField('Prochain numéro avoir', 'creditNoteNextNumber', company.creditNoteNextNumber.toString(), { editable: false })}
              </View>
              <View style={[styles.fieldsGrid, isMobile && { flexDirection: 'column' }]}>
                {renderField('Taux TVA par défaut (%)', 'defaultVatRate', company.defaultVatRate.toString())}
                {renderField('Délai de paiement (jours)', 'paymentTermsDays', company.paymentTermsDays.toString())}
              </View>
              <CurrencyPicker
                value={company.currency || 'EUR'}
                onSelect={(v) => updateField('currency', v)}
              />

              <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Exonération de TVA</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                    Article 293B du CGI - Auto-entrepreneurs
                  </Text>
                </View>
                <Switch
                  value={company.vatExempt}
                  onValueChange={(v) => setCompany((prev) => ({ ...prev, vatExempt: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Shield size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>Conformité anti-fraude</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Les factures validées ne peuvent plus être modifiées conformément à la réglementation française. La numérotation est séquentielle et chronologique. Annulation uniquement par avoir.
                  </Text>
                </View>
              </View>

              <View style={styles.vatRatesSection}>
                <Text style={[styles.vatRatesTitle, { color: colors.text }]}>Taux de TVA disponibles</Text>
                <View style={styles.vatRatesList}>
                  {[
                    { rate: 20, label: '20%', desc: 'Taux normal' },
                    { rate: 10, label: '10%', desc: 'Taux intermédiaire' },
                    { rate: 5.5, label: '5,5%', desc: 'Taux réduit' },
                    { rate: 2.1, label: '2,1%', desc: 'Taux super-réduit' },
                    { rate: 0, label: 'Exonéré', desc: 'Art. 293B' },
                  ].map((item) => (
                    <View key={item.rate} style={[styles.vatRateChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.vatRateText, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.vatRateDesc, { color: colors.textTertiary }]}>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sectionSaveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }]}
                onPress={async () => {
                  setIsSaving(true);
                  try {
                    await updateCompanySettings(company);
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <Save size={16} color="#FFF" />
                <Text style={styles.sectionSaveBtnText}>{isSaving ? t('settings.saving') : t('settings.saveChanges')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'reminders' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Relances automatiques</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                Configurez les relances automatiques pour les factures impayées.
              </Text>

              <View style={[styles.switchRow, { borderTopWidth: 0 }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Activer les relances automatiques</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                    Les emails de relance seront envoyés automatiquement
                  </Text>
                </View>
                <Switch
                  value={company.reminderEnabled}
                  onValueChange={(v) => setCompany((prev) => ({ ...prev, reminderEnabled: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {company.reminderEnabled && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                    Délais de relance configurés
                  </Text>
                  <View style={styles.reminderDays}>
                    {[7, 14, 30, 60].map((day) => {
                      const isActive = company.reminderDays.includes(day);
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.reminderDayChip,
                            {
                              backgroundColor: isActive ? colors.primary : colors.background,
                              borderColor: isActive ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => {
                            setCompany((prev) => ({
                              ...prev,
                              reminderDays: isActive
                                ? prev.reminderDays.filter((d) => d !== day)
                                : [...prev.reminderDays, day].sort((a, b) => a - b),
                            }));
                          }}
                        >
                          <Text style={[styles.reminderDayText, { color: isActive ? '#FFF' : colors.text }]}>
                            J+{day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {renderField('Taux de pénalité de retard (%)', 'lateFeeRate', company.lateFeeRate.toString())}

                  <View style={[styles.infoBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                    <Bell size={16} color={colors.warning} />
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoTitle, { color: colors.warning }]}>Pénalités de retard</Text>
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Le taux légal minimum est de 3× le taux d'intérêt légal. Les pénalités sont calculées automatiquement sur les factures en retard.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {activeTab === 'modules' && (
            <View>
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Modules disponibles</Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                  Activez ou désactivez les modules affichés dans la barre de navigation.
                </Text>
                <View style={styles.modulesList}>
                  {MODULE_CONFIGS.map((mod) => {
                    const enabled = isModuleEnabled(mod.key);
                    const available = isModuleAvailable(mod.key);
                    const locked = !available && !mod.alwaysEnabled;
                    return (
                      <View
                        key={mod.key}
                        style={[
                          styles.moduleRow,
                          { borderBottomColor: colors.borderLight },
                          locked && { opacity: 0.5 },
                        ]}
                      >
                        <View style={styles.moduleInfo}>
                          <View style={styles.moduleNameRow}>
                            <Text style={[styles.moduleName, { color: colors.text }]}>
                              {mod.label}
                            </Text>
                            {mod.alwaysEnabled && (
                              <View style={[styles.moduleTag, { backgroundColor: colors.primaryLight }]}>
                                <Text style={[styles.moduleTagText, { color: colors.primary }]}>Toujours actif</Text>
                              </View>
                            )}
                            {locked && (
                              <View style={[styles.moduleTag, { backgroundColor: colors.dangerLight }]}>
                                <Lock size={10} color={colors.danger} />
                                <Text style={[styles.moduleTagText, { color: colors.danger }]}>
                                  {mod.plans[0] === 'pro' ? 'Pro+' : 'Business'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.moduleDesc, { color: colors.textSecondary }]}>
                            {mod.description}
                          </Text>
                          <View style={styles.modulePlanBadges}>
                            {mod.plans.map((p) => (
                              <View
                                key={p}
                                style={[
                                  styles.modulePlanBadge,
                                  {
                                    backgroundColor: currentPlan === p ? `${PLAN_COLORS[p]}18` : colors.background,
                                    borderColor: currentPlan === p ? PLAN_COLORS[p] : colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.modulePlanBadgeText,
                                    { color: currentPlan === p ? PLAN_COLORS[p] : colors.textTertiary },
                                  ]}
                                >
                                  {PLAN_LABELS[p]}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        <Switch
                          value={enabled}
                          onValueChange={(v) => toggleModule(mod.key, v)}
                          disabled={mod.alwaysEnabled || locked}
                          trackColor={{ false: colors.border, true: colors.primary }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {activeTab === 'api' && (
            <ApiKeysSection />
          )}

          {activeTab === 'banking' && (
            <BankingConfigSection />
          )}

          {activeTab === 'objectives' && (
            <ObjectivesSection />
          )}

          {activeTab === 'einvoicing' && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Facturation électronique</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                Préparez votre entreprise à la réforme de la facturation électronique obligatoire (2026-2027).
              </Text>

              <View style={[styles.switchRow, { borderTopWidth: 0 }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Facturation électronique activée</Text>
                  <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                    Prépare les factures au format compatible PDP/PPF
                  </Text>
                </View>
                <Switch
                  value={company.electronicInvoicingReady}
                  onValueChange={(v) => setCompany((prev) => ({ ...prev, electronicInvoicingReady: v }))}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={[styles.readinessCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.readinessTitle, { color: colors.text }]}>État de préparation</Text>
                <View style={styles.readinessList}>
                  {[
                    { label: 'Structure XML Factur-X', ready: true },
                    { label: 'Champ electronic_ready sur factures', ready: true },
                    { label: 'Numérotation séquentielle conforme', ready: true },
                    { label: 'Mentions légales obligatoires', ready: true },
                    { label: 'Verrouillage des factures validées', ready: true },
                    { label: 'Connexion PDP / Chorus Pro', ready: false },
                    { label: 'Émission e-facture automatique', ready: false },
                    { label: 'Réception e-facture fournisseur', ready: false },
                  ].map((item) => (
                    <View key={item.label} style={styles.readinessRow}>
                      <View style={[styles.readinessDot, { backgroundColor: item.ready ? '#059669' : colors.border }]} />
                      <Text style={[styles.readinessLabel, { color: item.ready ? colors.text : colors.textTertiary }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.readinessStatus, { color: item.ready ? '#059669' : colors.textTertiary }]}>
                        {item.ready ? 'Prêt' : 'À venir'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.infoBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Zap size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.primary }]}>Réforme 2026-2027</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    La facturation électronique devient obligatoire pour toutes les entreprises françaises. GestionPro prépare déjà vos factures au format Factur-X compatible avec les plateformes de dématérialisation partenaires (PDP).
                  </Text>
                </View>
              </View>

              <View style={[styles.infoBox, { backgroundColor: colors.successLight, borderColor: colors.success, marginTop: 12 }]}>
                <Shield size={16} color={colors.success} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoTitle, { color: colors.success }]}>Conformité garantie</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Votre base de données est structurée pour supporter l'intégration future avec les API PDP/PPF. Les champs nécessaires (electronic_ready, XML structure) sont déjà en place.
                  </Text>
                </View>
              </View>
            </View>
          )}


          <View style={[styles.legalSection, { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 32 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Scale size={16} color={colors.primary} />
              <Text style={[styles.legalSectionTitle, { color: colors.text }]}>{t('legal.title')}</Text>
            </View>
            {[
              { key: 'mentions' as const, label: t('legal.mentions') },
              { key: 'cgu' as const, label: t('legal.cgu') },
              { key: 'privacy' as const, label: t('legal.privacy') },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.legalLink, { borderTopColor: colors.borderLight }]}
                onPress={() => router.push({ pathname: '/(app)/legal', params: { tab: item.key } })}
                activeOpacity={0.7}
                testID={`settings-legal-${item.key}`}
              >
                <Text style={[styles.legalLinkText, { color: colors.text }]}>{item.label}</Text>
                <ChevronRight size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.dangerSection, { borderColor: colors.danger + '30', backgroundColor: colors.danger + '08', marginTop: 32 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertTriangle size={16} color={colors.danger} />
              <Text style={[styles.dangerSectionTitle, { color: colors.danger }]}>{t('settings.dangerZone')}</Text>
            </View>
            <Text style={[styles.dangerSectionDesc, { color: colors.textSecondary }]}>
              {t('settings.dangerZoneDesc')}
            </Text>
            <TouchableOpacity
              style={[styles.deleteAccountBtn, { borderColor: colors.danger, backgroundColor: 'transparent' }]}
              onPress={() => setShowDeleteModal(true)}
              activeOpacity={0.7}
              testID="settings-delete-account-btn"
            >
              <Trash2 size={15} color={colors.danger} />
              <Text style={[styles.deleteAccountText, { color: colors.danger }]}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={deleteStyles.overlay}>
          <View style={[deleteStyles.modal, { backgroundColor: colors.card }]}> 
            <View style={deleteStyles.iconContainer}>
              <View style={[deleteStyles.iconCircle, { backgroundColor: colors.dangerLight }]}> 
                <AlertTriangle size={28} color={colors.danger} />
              </View>
            </View>
            <Text style={[deleteStyles.title, { color: colors.danger }]}>{t('settings.deleteAccountTitle')}</Text>
            <Text style={[deleteStyles.desc, { color: colors.textSecondary }]}>
              Cette action est irréversible. Toutes vos données seront définitivement supprimées :{"\n\n"}
              • Entreprise et paramètres{"\n"}
              • Clients et fournisseurs{"\n"}
              • Factures, devis et ventes{"\n"}
              • Produits et stock{"\n"}
              • Mouvements de trésorerie{"\n"}
              • Historique et logs
            </Text>
            <Text style={[deleteStyles.confirmLabel, { color: colors.text }]}>
              Tapez <Text style={{ fontWeight: '800' as const }}>SUPPRIMER</Text> pour confirmer :
            </Text>
            <TextInput
              style={[
                deleteStyles.confirmInput,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: deleteConfirmText === 'SUPPRIMER' ? colors.danger : colors.inputBorder },
              ]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="SUPPRIMER"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              testID="delete-account-confirm-input"
            />
            <Text style={[deleteStyles.confirmLabel, { color: colors.text, marginTop: 12 }]}>
              {t('settings.enterPassword')}
            </Text>
            <TextInput
              style={[
                deleteStyles.confirmInput,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: deletePasswordError ? colors.danger : colors.inputBorder },
              ]}
              value={deletePassword}
              onChangeText={(v) => { setDeletePassword(v); setDeletePasswordError(''); }}
              placeholder={t('settings.passwordPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              testID="delete-account-password-input"
            />
            {deletePasswordError ? (
              <Text style={[deleteStyles.passwordError, { color: colors.danger }]}>{deletePasswordError}</Text>
            ) : null}
            <View style={deleteStyles.actions}>
              <TouchableOpacity
                style={[deleteStyles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeletePassword(''); setDeletePasswordError(''); }}
                disabled={isDeleting}
                activeOpacity={0.7}
              >
                <Text style={[deleteStyles.cancelText, { color: colors.textSecondary }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  deleteStyles.deleteBtn,
                  { backgroundColor: (deleteConfirmText === 'SUPPRIMER' && deletePassword.trim()) ? colors.danger : colors.border },
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'SUPPRIMER' || !deletePassword.trim()}
                activeOpacity={0.7}
                testID="delete-account-confirm-btn"
              >
                <Trash2 size={16} color="#FFF" />
                <Text style={deleteStyles.deleteText}>
                  {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const deleteStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' as const, alignItems: 'center' as const, padding: 24 },
  modal: { width: '100%' as never, maxWidth: 440, borderRadius: 16, padding: 28 },
  iconContainer: { alignItems: 'center' as const, marginBottom: 16 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center' as const, justifyContent: 'center' as const },
  title: { fontSize: 20, fontWeight: '700' as const, textAlign: 'center' as const, marginBottom: 12 },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  confirmLabel: { fontSize: 14, fontWeight: '500' as const, marginBottom: 8 },
  confirmInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '600' as const, letterSpacing: 2, marginBottom: 20 },
  actions: { flexDirection: 'row' as const, gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  cancelText: { fontSize: 14, fontWeight: '600' as const },
  deleteBtn: { flex: 1, flexDirection: 'row' as const, borderRadius: 8, paddingVertical: 12, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 },
  deleteText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  passwordError: { fontSize: 12, marginTop: 4, marginBottom: 8 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1 },
  tabBarWrapper: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarInner: { flexDirection: 'row' as const, gap: 0 },
  tabItemUnified: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 6, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabelUnified: { fontSize: 14, fontWeight: '600' as const },
  tabList: { width: 220, borderWidth: 1, borderRadius: 12, margin: 24, marginRight: 0, padding: 8, alignSelf: 'flex-start' as const },
  tabListMobile: { width: 'auto' as never, flexDirection: 'row' as const, margin: 24, marginBottom: 0, marginRight: 24, flexWrap: 'wrap' as const, gap: 4 },
  tabItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8 },
  tabItemMobile: { flex: undefined, justifyContent: 'center' as const },
  tabLabel: { fontSize: 14, fontWeight: '500' as const },
  content: { flex: 1 },
  contentInner: { padding: 24 },
  section: { borderWidth: 1, borderRadius: 12, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  fieldsGrid: { flexDirection: 'row' as const, gap: 16 },
  fieldGroup: { flex: 1, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '500' as const, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  switchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 16, borderTopWidth: 1, marginBottom: 8 },
  switchInfo: { flex: 1, marginRight: 16 },
  switchLabel: { fontSize: 14, fontWeight: '600' as const },
  switchDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  infoBox: { borderWidth: 1, borderRadius: 10, padding: 16, marginTop: 8, marginBottom: 16, borderLeftWidth: 3, flexDirection: 'row' as const, gap: 12 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '600' as const, marginBottom: 4 },
  infoText: { fontSize: 12, lineHeight: 18 },
  vatRatesSection: { marginTop: 8 },
  vatRatesTitle: { fontSize: 14, fontWeight: '600' as const, marginBottom: 10 },
  vatRatesList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  vatRateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  vatRateText: { fontSize: 13, fontWeight: '500' as const },
  vatRateDesc: { fontSize: 10, marginTop: 2 },
  reminderDays: { flexDirection: 'row' as const, gap: 8, marginBottom: 16 },
  reminderDayChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  reminderDayText: { fontSize: 14, fontWeight: '600' as const },
  readinessCard: { borderWidth: 1, borderRadius: 10, padding: 20, marginBottom: 16 },
  readinessTitle: { fontSize: 14, fontWeight: '600' as const, marginBottom: 12 },
  readinessList: { gap: 10 },
  readinessRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessLabel: { flex: 1, fontSize: 13 },
  readinessStatus: { fontSize: 12, fontWeight: '600' as const },
  saveBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  plansRow: { flexDirection: 'row' as const, gap: 12, marginBottom: 8 },
  planCard: { flex: 1, borderRadius: 12, padding: 20, alignItems: 'center' as const, position: 'relative' as const },
  planActiveBadge: { position: 'absolute' as const, top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  planName: { fontSize: 16, fontWeight: '700' as const, marginBottom: 4 },
  planModulesCount: { fontSize: 12 },
  modulesList: { gap: 0 },
  moduleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 16, borderBottomWidth: 1 },
  moduleInfo: { flex: 1, marginRight: 16 },
  moduleNameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 4 },
  moduleName: { fontSize: 14, fontWeight: '600' as const },
  moduleTag: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  moduleTagText: { fontSize: 10, fontWeight: '600' as const },
  moduleDesc: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  modulePlanBadges: { flexDirection: 'row' as const, gap: 4 },
  modulePlanBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  modulePlanBadgeText: { fontSize: 10, fontWeight: '500' as const },
  userBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginHorizontal: 24, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  userInfo: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flex: 1 },
  userAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center' as const, justifyContent: 'center' as const },
  userAvatarText: { fontSize: 18, fontWeight: '700' as const },
  userDetails: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600' as const },
  userEmail: { fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  logoutText: { fontSize: 13, fontWeight: '600' as const },
  dangerSection: { borderWidth: 1, borderRadius: 12, padding: 20, marginTop: 8 },
  dangerSectionTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 4 },
  dangerSectionDesc: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  deleteAccountBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1.5 },
  deleteAccountText: { fontSize: 14, fontWeight: '600' as const },
  deleteAccountSection: { alignItems: 'center' as const, paddingTop: 40, paddingBottom: 32, marginTop: 24 },
  deleteAccountDivider: { width: 40, height: 1, marginBottom: 20 },
  deleteAccountLink: { paddingVertical: 6, paddingHorizontal: 12 },
  deleteAccountLinkText: { fontSize: 12, letterSpacing: 0.2 },
  sectionSaveBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, gap: 8, marginTop: 20 },
  sectionSaveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' as const },
  userBannerCompact: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, gap: 10 },
  userAvatarSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const },
  userAvatarSmallText: { fontSize: 12, fontWeight: '700' as const },
  userNameCompact: { fontSize: 13, fontWeight: '600' as const },
  userEmailCompact: { fontSize: 12 },
  logoutBtnCompact: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  bankingSubSection: { borderTopWidth: 1, paddingTop: 20, marginTop: 20 },
  legalSection: { borderWidth: 1, borderRadius: 12, padding: 20 },
  legalSectionTitle: { fontSize: 15, fontWeight: '700' as const },
  legalLink: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 14, borderTopWidth: 1 },
  legalLinkText: { fontSize: 14, fontWeight: '500' as const },
});


