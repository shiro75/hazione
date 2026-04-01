/**
 * @fileoverview Admin page for managing the online shop (Boutique en ligne).
 * Contains 3 tabs: Settings (shop config, slug, colors, delivery, payment),
 * Published Products (toggle publish status), and Orders (view/manage online orders).
 *
 * IMPORTANT: This file is named "boutique.tsx" (route: /boutique) to avoid
 * conflicting with the public shop directory at app/shop/[slug].tsx (route: /shop/:slug).
 * Previously named shop.tsx, which caused a 404 because Expo Router prioritized
 * the top-level app/shop/ directory over app/(app)/shop.tsx.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, ActivityIndicator, useWindowDimensions, Platform, Modal, Pressable,
} from 'react-native';
import {
  Settings, Package, Store, Eye, EyeOff,
  FileText, Truck, CreditCard, Building, ExternalLink,
  Image as ImageIcon, SlidersHorizontal, X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import AccessDenied from '@/components/AccessDenied';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

import { shopDb } from '@/services/shopService';
import { supabase } from '@/services/supabase';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { Shop, Product } from '@/types';

const PRESET_COLORS = ['#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0891B2'];
const SLUG_REGEX = /^[a-z0-9-]+$/;

type ShopTab = 'settings' | 'products';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function ShopScreen() {
  const { colors } = useTheme();
  const { company, activeProducts, getCurrency } = useData();
  const { user } = useAuth();
  const { canAccess } = useRole();
  const { width } = useWindowDimensions();
  const _isMobile = width < 768;
  const _currency = getCurrency();

  if (!canAccess('shop')) {
    return <AccessDenied />;
  }

  const COMPANY_ID = user?.id ?? 'anonymous';

  const [activeTab, setActiveTab] = useState<ShopTab>('settings');


  const shopQuery = useQuery({
    queryKey: ['shop', COMPANY_ID],
    queryFn: () => shopDb.fetchShop(COMPANY_ID),
    staleTime: 10000,
  });

  const shop = shopQuery.data;

  const tabs: { key: ShopTab; label: string; icon: React.ComponentType<{ size: number; color: string }>; badge?: number }[] = [
    { key: 'settings', label: 'Paramètres', icon: Settings },
    { key: 'products', label: 'Produits publiés', icon: Package },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title="Boutique en ligne" />
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarInner}>
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <tab.icon size={16} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
                {(tab.badge ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeTab === 'settings' && (
        <ShopSettingsTab shop={shop} companyId={COMPANY_ID} companyName={company.name} />
      )}
      {activeTab === 'products' && (
        <ShopProductsTab products={activeProducts} />
      )}

    </View>
  );
}

function ShopSettingsTab({ shop, companyId, companyName }: { shop: Shop | null | undefined; companyId: string; companyName: string }) {
  const { colors } = useTheme();
  const { showToast } = useData();
  const queryClient = useQueryClient();

  const [name, setName] = useState(shop?.name ?? companyName);
  const slug = useMemo(() => shop?.slug || generateSlug(name), [shop?.slug, name]);
  const [description, setDescription] = useState(shop?.description ?? '');
  const [primaryColor, setPrimaryColor] = useState(shop?.primaryColor ?? '#2563EB');
  const [contactPhone, setContactPhone] = useState(shop?.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(shop?.contactEmail ?? '');
  const [contactAddress, setContactAddress] = useState(shop?.contactAddress ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(shop?.welcomeMessage ?? '');
  const [deliveryPickup, setDeliveryPickup] = useState(shop?.deliveryPickup ?? false);
  const [deliveryShipping, setDeliveryShipping] = useState(shop?.deliveryShipping ?? false);
  const [shippingPrice, setShippingPrice] = useState(String(shop?.shippingPrice ?? '0'));
  const [paymentInStore, setPaymentInStore] = useState(shop?.paymentInStore ?? false);
  const [paymentBankTransfer, setPaymentBankTransfer] = useState(shop?.paymentBankTransfer ?? false);
  const [bankDetails, setBankDetails] = useState(shop?.bankDetails ?? '');
  const [paymentOnDelivery, setPaymentOnDelivery] = useState(shop?.paymentOnDelivery ?? false);
  const [isActive, setIsActive] = useState(shop?.isActive ?? false);

  useEffect(() => {
    if (shop) {
      setName(shop.name);
      setDescription(shop.description);
      setPrimaryColor(shop.primaryColor);
      setContactPhone(shop.contactPhone);
      setContactEmail(shop.contactEmail);
      setContactAddress(shop.contactAddress);
      setWelcomeMessage(shop.welcomeMessage);
      setDeliveryPickup(shop.deliveryPickup);
      setDeliveryShipping(shop.deliveryShipping);
      setShippingPrice(String(shop.shippingPrice));
      setPaymentInStore(shop.paymentInStore);
      setPaymentBankTransfer(shop.paymentBankTransfer);
      setBankDetails(shop.bankDetails);
      setPaymentOnDelivery(shop.paymentOnDelivery);
      setIsActive(shop.isActive);
    }
  }, [shop]);

  const slugValidationError = useMemo(() => {
    if (slug.length < 3) return 'Le slug doit avoir au moins 3 caractères';
    if (!SLUG_REGEX.test(slug)) return 'Uniquement lettres minuscules, chiffres et tirets';
    return '';
  }, [slug]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!slug || slug.length < 3) throw new Error('Slug invalide');
      const available = await shopDb.checkSlugAvailable(slug, shop?.id);
      if (!available) throw new Error('Ce slug est déjà pris');

      const shopData: Partial<Shop> & { companyId: string } = {
        companyId,
        slug,
        name,
        description,
        primaryColor,
        contactPhone,
        contactEmail,
        contactAddress,
        welcomeMessage,
        deliveryPickup,
        deliveryShipping,
        shippingPrice: parseFloat(shippingPrice) || 0,
        paymentInStore,
        paymentBankTransfer,
        bankDetails,
        paymentOnDelivery,
        isActive,
      };

      if (shop?.id) {
        shopData.id = shop.id;
      }

      return shopDb.upsertShop(shopData);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shop', companyId] });
      showToast('Boutique enregistrée');
    },
    onError: (err: Error) => {
      showToast(err.message, 'error');
    },
  });

  const shopUrl = slug ? `${Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://rork.app/p/pf7qwnb82blbf7u579jv7'}/shop/${slug}` : '';

  const handleViewShop = useCallback(() => {
    if (!shopUrl) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(shopUrl, '_blank');
    } else {
      void Linking.openURL(shopUrl);
    }
  }, [shopUrl]);

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Store size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>État de la boutique</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Boutique activée</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.primary }} />
        </View>
        {isActive && slug && (
          <View style={[styles.urlPreview, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.urlText, { color: colors.primary }]} numberOfLines={1}>{shopUrl}</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Building size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Informations</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nom de la boutique</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Ma Boutique"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Slug (URL) — auto-généré</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceHover ?? '#F1F5F9', borderColor: colors.inputBorder, color: colors.textSecondary }]}
            value={slug}
            editable={false}
            selectTextOnFocus={false}
          />
          {slugValidationError ? <Text style={[styles.fieldError, { color: colors.danger }]}>{slugValidationError}</Text> : null}
          {shopUrl ? <Text style={[styles.urlHint, { color: colors.textTertiary }]}>{shopUrl}</Text> : null}
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description (200 car. max)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={description}
            onChangeText={t => setDescription(t.slice(0, 200))}
            placeholder="Décrivez votre boutique..."
            placeholderTextColor={colors.textTertiary}
            multiline
          />
          <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length}/200</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Couleur principale</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c, borderColor: primaryColor === c ? colors.text : 'transparent' }]}
                onPress={() => setPrimaryColor(c)}
              />
            ))}
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Message d'accueil</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={welcomeMessage}
            onChangeText={setWelcomeMessage}
            placeholder="Bienvenue dans notre boutique !"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <FileText size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Contact affiché</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Téléphone</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Adresse</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            value={contactAddress}
            onChangeText={setContactAddress}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Truck size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Livraison</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Retrait en boutique</Text>
          <Switch value={deliveryPickup} onValueChange={setDeliveryPickup} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Livraison</Text>
          <Switch value={deliveryShipping} onValueChange={setDeliveryShipping} trackColor={{ true: colors.primary }} />
        </View>
        {deliveryShipping && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prix de livraison</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={shippingPrice}
              onChangeText={setShippingPrice}
              keyboardType="numeric"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <CreditCard size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Paiement</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Paiement en boutique</Text>
          <Switch value={paymentInStore} onValueChange={setPaymentInStore} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Virement bancaire</Text>
          <Switch value={paymentBankTransfer} onValueChange={setPaymentBankTransfer} trackColor={{ true: colors.primary }} />
        </View>
        {paymentBankTransfer && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Coordonnées bancaires (RIB/IBAN)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              value={bankDetails}
              onChangeText={setBankDetails}
              multiline
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        )}
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Paiement à la livraison</Text>
          <Switch value={paymentOnDelivery} onValueChange={setPaymentOnDelivery} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saveMutation.isPending ? 0.7 : 1 }]}
        onPress={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Enregistrer les paramètres</Text>
        )}
      </TouchableOpacity>

      {isActive && shopUrl ? (
        <TouchableOpacity
          style={[styles.viewShopBtn, { borderColor: colors.primary }]}
          onPress={handleViewShop}
        >
          <ExternalLink size={16} color={colors.primary} />
          <Text style={[styles.viewShopBtnText, { color: colors.primary }]}>Voir ma boutique</Text>
        </TouchableOpacity>
      ) : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

interface ProductShopConfig {
  deliveryPickup?: boolean;
  deliveryShipping?: boolean;
  shippingPrice?: string;
  paymentInStore?: boolean;
  paymentBankTransfer?: boolean;
  paymentOnDelivery?: boolean;
  useCustomConfig?: boolean;
}

function ShopProductsTab({ products }: { products: Product[] }) {
  const { colors } = useTheme();
  const { getCurrency, showToast } = useData();
  const { user } = useAuth();
  const COMPANY_ID = user?.id ?? 'anonymous';
  const [search, setSearch] = useState('');
  const currency = getCurrency();
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [configModalProductId, setConfigModalProductId] = useState<string | null>(null);
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductShopConfig>>({});
  const [editingConfig, setEditingConfig] = useState<ProductShopConfig>({});

  useEffect(() => {
    AsyncStorage.getItem(`shop-product-configs-${COMPANY_ID}`).then(stored => {
      if (stored) setProductConfigs(JSON.parse(stored));
    }).catch(() => {});
  }, [COMPANY_ID]);

  const openProductConfig = useCallback((productId: string) => {
    const existing = productConfigs[productId] || {};
    setEditingConfig({ ...existing });
    setConfigModalProductId(productId);
  }, [productConfigs]);

  const saveProductConfig = useCallback(() => {
    if (!configModalProductId) return;
    const updated = { ...productConfigs, [configModalProductId]: editingConfig };
    setProductConfigs(updated);
    void AsyncStorage.setItem(`shop-product-configs-${COMPANY_ID}`, JSON.stringify(updated));
    setConfigModalProductId(null);
    showToast('Paramètres du produit enregistrés');
  }, [configModalProductId, editingConfig, productConfigs, COMPANY_ID, showToast]);

  const clearProductConfig = useCallback(() => {
    if (!configModalProductId) return;
    const updated = { ...productConfigs };
    delete updated[configModalProductId];
    setProductConfigs(updated);
    void AsyncStorage.setItem(`shop-product-configs-${COMPANY_ID}`, JSON.stringify(updated));
    setConfigModalProductId(null);
    showToast('Paramètres par défaut restaurés');
  }, [configModalProductId, productConfigs, COMPANY_ID, showToast]);

  const configModalProduct = useMemo(() =>
    configModalProductId ? products.find(p => p.id === configModalProductId) : null,
  [configModalProductId, products]);

  useEffect(() => {
    if (products.length === 0) return;
    const loadPublishedStatus = async () => {
      try {
        const productIds = products.map(p => p.id);
        const { data, error } = await supabase
          .from('products')
          .select('id, published_on_shop')
          .in('id', productIds);
        if (!error && data) {
          const ids = new Set<string>();
          (data as Array<{ id: string; published_on_shop: boolean }>).forEach(row => {
            if (row.published_on_shop) ids.add(row.id);
          });
          setPublishedIds(ids);
        }
      } catch {}
    };
    void loadPublishedStatus();
  }, [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, newVal }: { productId: string; newVal: boolean }) => {
      await shopDb.updateProductShopStatus(productId, newVal);
      return { productId, newVal };
    },
    onMutate: ({ productId, newVal }) => {
      setPublishedIds(prev => {
        const next = new Set(prev);
        if (newVal) next.add(productId);
        else next.delete(productId);
        return next;
      });
    },
    onError: (_err, { productId, newVal }) => {
      setPublishedIds(prev => {
        const next = new Set(prev);
        if (newVal) next.delete(productId);
        else next.add(productId);
        return next;
      });

    },
  });

  const togglePublish = useCallback((product: Product) => {
    const currentlyPublished = publishedIds.has(product.id);
    toggleMutation.mutate({ productId: product.id, newVal: !currentlyPublished });
  }, [publishedIds, toggleMutation]);

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
      <TextInput
        style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un produit..."
        placeholderTextColor={colors.textTertiary}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={32} color={colors.textTertiary} />}
          title="Aucun produit"
          subtitle="Créez des produits dans Produits & Stock pour les publier ici"
        />
      ) : (
        filtered.map(product => {
          const isPublished = publishedIds.has(product.id);
          return (
            <View
              key={product.id}
              style={[styles.productCard, { backgroundColor: colors.card, borderColor: isPublished ? colors.success + '40' : colors.cardBorder }]}
            >
              <View style={styles.productCardBody}>
                {product.photoUrl ? (
                  <View style={styles.productThumb}>
                    <View style={[styles.productThumbInner, { backgroundColor: colors.surfaceHover }]}>
                      <ImageIcon size={18} color={colors.textTertiary} />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.productThumb, { backgroundColor: colors.surfaceHover }]}>
                    <ImageIcon size={20} color={colors.textTertiary} />
                  </View>
                )}
                <View style={styles.productCardInfo}>
                  <View style={styles.productCardNameRow}>
                    <Text style={[styles.productCardName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
                    <View style={[styles.publishBadge, { backgroundColor: isPublished ? colors.success + '18' : colors.surfaceHover }]}>
                      <View style={[styles.publishDot, { backgroundColor: isPublished ? colors.success : colors.textTertiary }]} />
                      <Text style={[styles.publishBadgeText, { color: isPublished ? colors.success : colors.textTertiary }]}>
                        {isPublished ? 'Publié' : 'Non publié'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.productCardMeta}>
                    <Text style={[styles.productCardSku, { color: colors.textTertiary }]}>{product.sku}</Text>
                    <Text style={[styles.productCardPrice, { color: colors.primary }]}>{(product.salePrice ?? 0).toFixed(2)} {currency}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.productCardFooter, { borderTopColor: colors.border }]}>
                <View style={styles.productCardToggleRow}>
                  {isPublished ? (
                    <Eye size={14} color={colors.success} />
                  ) : (
                    <EyeOff size={14} color={colors.textTertiary} />
                  )}
                  <Text style={[styles.productCardToggleLabel, { color: isPublished ? colors.success : colors.textTertiary }]}>
                    {isPublished ? 'Visible sur la boutique' : 'Masqué de la boutique'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 }}>
                  {isPublished && (
                    <TouchableOpacity
                      onPress={() => openProductConfig(product.id)}
                      style={[styles.productConfigBtn, {
                        backgroundColor: productConfigs[product.id]?.useCustomConfig ? colors.primary + '15' : colors.surfaceHover,
                        borderColor: productConfigs[product.id]?.useCustomConfig ? colors.primary : colors.border,
                      }]}
                    >
                      <SlidersHorizontal size={13} color={productConfigs[product.id]?.useCustomConfig ? colors.primary : colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                  <Switch
                    value={isPublished}
                    onValueChange={() => togglePublish(product)}
                    trackColor={{ false: colors.border, true: colors.success + '60' }}
                    thumbColor={isPublished ? colors.success : '#E5E7EB'}
                  />
                </View>
              </View>
            </View>
          );
        })
      )}
      <View style={{ height: 40 }} />

      {configModalProductId && configModalProduct && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setConfigModalProductId(null)}>
          <Pressable style={configStyles.overlay} onPress={() => setConfigModalProductId(null)}>
            <Pressable style={[configStyles.modal, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
              <View style={[configStyles.header, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[configStyles.headerTitle, { color: colors.text }]}>Paramètres produit</Text>
                  <Text style={[configStyles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{configModalProduct.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setConfigModalProductId(null)} hitSlop={8}>
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={configStyles.body}>
                <View style={configStyles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[configStyles.switchLabel, { color: colors.text }]}>Paramètres personnalisés</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>Remplace les paramètres généraux de la boutique</Text>
                  </View>
                  <Switch
                    value={editingConfig.useCustomConfig ?? false}
                    onValueChange={v => setEditingConfig(prev => ({ ...prev, useCustomConfig: v }))}
                    trackColor={{ true: colors.primary }}
                  />
                </View>

                {editingConfig.useCustomConfig && (
                  <>
                    <View style={[configStyles.sectionCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                      <View style={configStyles.sectionHeader}>
                        <Truck size={15} color={colors.primary} />
                        <Text style={[configStyles.sectionTitle, { color: colors.text }]}>Livraison</Text>
                      </View>
                      <View style={configStyles.switchRow}>
                        <Text style={[configStyles.optionLabel, { color: colors.text }]}>Retrait en boutique</Text>
                        <Switch
                          value={editingConfig.deliveryPickup ?? false}
                          onValueChange={v => setEditingConfig(prev => ({ ...prev, deliveryPickup: v }))}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>
                      <View style={configStyles.switchRow}>
                        <Text style={[configStyles.optionLabel, { color: colors.text }]}>Livraison</Text>
                        <Switch
                          value={editingConfig.deliveryShipping ?? false}
                          onValueChange={v => setEditingConfig(prev => ({ ...prev, deliveryShipping: v }))}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>
                      {editingConfig.deliveryShipping && (
                        <View style={{ gap: 4 }}>
                          <Text style={[configStyles.fieldLabel, { color: colors.textSecondary }]}>Prix de livraison</Text>
                          <TextInput
                            style={[configStyles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                            value={editingConfig.shippingPrice ?? ''}
                            onChangeText={v => setEditingConfig(prev => ({ ...prev, shippingPrice: v }))}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                          />
                        </View>
                      )}
                    </View>

                    <View style={[configStyles.sectionCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                      <View style={configStyles.sectionHeader}>
                        <CreditCard size={15} color={colors.primary} />
                        <Text style={[configStyles.sectionTitle, { color: colors.text }]}>Paiement</Text>
                      </View>
                      <View style={configStyles.switchRow}>
                        <Text style={[configStyles.optionLabel, { color: colors.text }]}>Paiement en boutique</Text>
                        <Switch
                          value={editingConfig.paymentInStore ?? false}
                          onValueChange={v => setEditingConfig(prev => ({ ...prev, paymentInStore: v }))}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>
                      <View style={configStyles.switchRow}>
                        <Text style={[configStyles.optionLabel, { color: colors.text }]}>Virement bancaire</Text>
                        <Switch
                          value={editingConfig.paymentBankTransfer ?? false}
                          onValueChange={v => setEditingConfig(prev => ({ ...prev, paymentBankTransfer: v }))}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>
                      <View style={configStyles.switchRow}>
                        <Text style={[configStyles.optionLabel, { color: colors.text }]}>Paiement à la livraison</Text>
                        <Switch
                          value={editingConfig.paymentOnDelivery ?? false}
                          onValueChange={v => setEditingConfig(prev => ({ ...prev, paymentOnDelivery: v }))}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={[configStyles.footer, { borderTopColor: colors.border }]}>
                {editingConfig.useCustomConfig && (
                  <TouchableOpacity
                    onPress={clearProductConfig}
                    style={[configStyles.resetBtn, { borderColor: colors.danger }]}
                  >
                    <Text style={[configStyles.resetBtnText, { color: colors.danger }]}>Réinitialiser</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => setConfigModalProductId(null)}
                  style={[configStyles.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text style={[configStyles.cancelBtnText, { color: colors.textSecondary }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveProductConfig}
                  style={[configStyles.saveBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={configStyles.saveBtnText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ScrollView>
  );
}

const configStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  modal: {
    width: 440, maxWidth: '92%' as unknown as number, maxHeight: '85%' as unknown as number,
    borderRadius: 16, overflow: 'hidden' as const,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  header: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' as const },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  body: { padding: 20, gap: 16 },
  sectionCard: {
    borderWidth: 1, borderRadius: 12, padding: 16, gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' as const },
  switchRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  switchLabel: { fontSize: 14, fontWeight: '600' as const },
  optionLabel: { fontSize: 13, fontWeight: '500' as const },
  fieldLabel: { fontSize: 12, fontWeight: '500' as const },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 14,
  },
  footer: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, gap: 8,
  },
  resetBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1,
  },
  resetBtnText: { fontSize: 13, fontWeight: '600' as const },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600' as const },
  saveBtn: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { borderBottomWidth: 1, paddingHorizontal: 24 },
  tabBarInner: { flexDirection: 'row' as const, gap: 0 },
  tab: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: -1,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 4 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
  tabContent: { flex: 1 },
  tabContentInner: { padding: 16, gap: 16 },
  card: {
    borderWidth: 1, borderRadius: 14, padding: 18, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const },
  switchRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  switchLabel: { fontSize: 14, fontWeight: '500' as const },
  urlPreview: { padding: 10, borderRadius: 8 },
  urlText: { fontSize: 12, fontWeight: '500' as const },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '500' as const },
  fieldError: { fontSize: 11, fontWeight: '500' as const },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' as const },
  charCount: { fontSize: 10, textAlign: 'right' as const },
  colorRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' as const },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  viewShopBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, borderRadius: 10, paddingVertical: 14, borderWidth: 1.5,
  },
  viewShopBtnText: { fontSize: 15, fontWeight: '700' as const },
  urlHint: { fontSize: 11, marginTop: 2 },
  orderNumberRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  onlineBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  onlineBadgeText: { fontSize: 10, fontWeight: '600' as const, color: '#8B5CF6' },
  searchInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  productCard: {
    borderWidth: 1, borderRadius: 14, overflow: 'hidden' as const,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  productCardBody: {
    flexDirection: 'row' as const, alignItems: 'center' as const, padding: 14, gap: 12,
  },
  productThumb: {
    width: 48, height: 48, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  productThumbInner: {
    width: 48, height: 48, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  productCardInfo: { flex: 1, gap: 4 },
  productCardNameRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 8,
  },
  productCardName: { fontSize: 15, fontWeight: '600' as const, flex: 1 },
  publishBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  publishDot: { width: 6, height: 6, borderRadius: 3 },
  publishBadgeText: { fontSize: 11, fontWeight: '600' as const },
  productCardMeta: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
  },
  productCardSku: { fontSize: 12 },
  productCardPrice: { fontSize: 13, fontWeight: '700' as const },
  productCardFooter: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1,
  },
  productCardToggleRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
  },
  productCardToggleLabel: { fontSize: 12, fontWeight: '500' as const },
  productConfigBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  productRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 12,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600' as const },
  productSku: { fontSize: 12, marginTop: 2 },
  publishBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  publishBtnText: { fontSize: 12, fontWeight: '600' as const },
  filterBar: { marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginRight: 8 },
  filterChipText: { fontSize: 13, fontWeight: '500' as const },
  orderRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 12,
  },
  orderRowLeft: { flex: 1 },
  orderRowNumber: { fontSize: 14, fontWeight: '700' as const },
  orderRowClient: { fontSize: 13, marginTop: 2 },
  orderRowDate: { fontSize: 11, marginTop: 2 },
  orderRowRight: { alignItems: 'flex-end' as const, gap: 4 },
  orderRowTotal: { fontSize: 14, fontWeight: '700' as const },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '600' as const },
  statusPillTextSmall: { fontSize: 11, fontWeight: '600' as const },
  backBtn: { marginBottom: 8 },
  backBtnText: { fontSize: 14, fontWeight: '600' as const },
  orderDetailHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  orderNumber: { fontSize: 18, fontWeight: '800' as const },
  orderDate: { fontSize: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
  clientName: { fontSize: 16, fontWeight: '700' as const },
  clientDetail: { fontSize: 13, marginTop: 2 },
  deliveryPaymentRow: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
  infoPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  infoPillText: { fontSize: 12, fontWeight: '500' as const },
  orderItemRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  orderItemName: { fontSize: 14, fontWeight: '500' as const },
  orderItemVariant: { fontSize: 11, marginTop: 2 },
  orderItemQty: { fontSize: 13, fontWeight: '600' as const },
  orderItemPrice: { fontSize: 14, fontWeight: '600' as const, minWidth: 70, textAlign: 'right' as const },
  totalSection: { borderTopWidth: 1, paddingTop: 12, gap: 6 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 13, fontWeight: '500' as const },
  totalLabelBold: { fontSize: 14, fontWeight: '700' as const },
  totalValueBold: { fontSize: 16, fontWeight: '700' as const },
  actionRow: { flexDirection: 'row' as const, gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 12, borderRadius: 10,
  },
  actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
});
