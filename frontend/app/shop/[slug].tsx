/**
 * @fileoverview Page vitrine publique pour une boutique identifiée par son slug.
 * Accessible à /shop/{slug} SANS authentification.
 * Fonctionnalités : grille produits avec filtre catégorie & recherche, détail produit avec variantes,
 * panier (persisté via AsyncStorage), checkout avec barre de progression, et confirmation de commande.
 * Utilise ShopCartProvider pour la gestion du state du panier.
 *
 * Design inspiré de Shopify Mobile Storefront / Etsy — cartes épurées, espacement aéré,
 * typographie moderne, boutons arrondis, ombres légères.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, useWindowDimensions, Image, Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  ShoppingCart, Search, Minus, Plus, Trash2, ChevronLeft,
  MapPin, Mail, Phone, Package, Store, CheckCircle,
  Banknote, Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shopDb } from '@/services/shopService';
import { ShopCartProvider, useShopCart } from '@/contexts/ShopCartContext';
import type { Shop, CartItem, Product, ProductVariant } from '@/types';

/** Vue active de la boutique publique */
type ShopView = 'storefront' | 'product' | 'cart' | 'checkout' | 'confirmation';

/* ───────────────────────────────────────── Helpers ───────────────────────────────────────── */

/** Extrait les initiales d'un nom de produit (max 2 lettres) */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Vérifie si un produit possède des variantes actives */
function hasVariants(product: Product, variants: ProductVariant[]): boolean {
  return variants.filter(v => v.productId === product.id && v.isActive).length > 0;
}

/* ───────────────────────────────────── Composant racine ───────────────────────────────────── */

function ShopContent() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width: _screenWidth } = useWindowDimensions();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ShopView>('storefront');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [confirmationOrder, setConfirmationOrder] = useState<any>(null);

  const { loadCart, totalItems } = useShopCart();

  useEffect(() => {
    if (!slug) return;
    void loadCart(slug);
    const load = async () => {
      setLoading(true);
      try {
        const shopData = await shopDb.fetchShopBySlug(slug);
        if (shopData) {
          setShop(shopData);
          const [prods, vars] = await Promise.all([
            shopDb.fetchPublishedProducts(shopData.companyId),
            shopDb.fetchProductVariants(shopData.companyId),
          ]);
          setProducts(prods);
          setVariants(vars);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug, loadCart]);

  const handleSelectProduct = useCallback((productId: string) => {
    setSelectedProductId(productId);
    setView('product');
  }, []);

  const handleBack = useCallback(() => {
    if (view === 'product') setView('storefront');
    else if (view === 'cart') setView('storefront');
    else if (view === 'checkout') setView('cart');
  }, [view]);

  const handleOrderConfirmed = useCallback((orderNumber: string, orderData: any) => {
    setConfirmationNumber(orderNumber);
    setConfirmationOrder(orderData);
    setView('confirmation');
  }, []);

  if (loading) {
    return (
      <View style={[s.loadingContainer, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Chargement de la boutique...</Text>
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={[s.loadingContainer, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Store size={48} color="#94A3B8" />
        <Text style={s.notFoundTitle}>Boutique introuvable</Text>
        <Text style={s.notFoundText}>Cette boutique n'existe pas ou est désactivée.</Text>
      </View>
    );
  }

  const primaryColor = shop.primaryColor || '#2563EB';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header de la boutique — logo / nom / panier */}
      <ShopHeader
        shop={shop}
        primaryColor={primaryColor}
        cartCount={totalItems}
        onCartPress={() => setView('cart')}
        onBack={view !== 'storefront' ? handleBack : undefined}
        showBack={view !== 'storefront' && view !== 'confirmation'}
      />

      {view === 'storefront' && (
        <StorefrontView
          shop={shop}
          products={products}
          variants={variants}
          primaryColor={primaryColor}
          onSelectProduct={handleSelectProduct}
        />
      )}
      {view === 'product' && selectedProductId && (
        <ProductDetailView
          product={products.find(p => p.id === selectedProductId)!}
          variants={variants.filter(v => v.productId === selectedProductId)}
          primaryColor={primaryColor}
        />
      )}
      {view === 'cart' && (
        <CartView
          primaryColor={primaryColor}
          onCheckout={() => setView('checkout')}
        />
      )}
      {view === 'checkout' && (
        <CheckoutView
          shop={shop}
          primaryColor={primaryColor}
          onConfirmed={handleOrderConfirmed}
        />
      )}
      {view === 'confirmation' && (
        <ConfirmationView
          orderNumber={confirmationNumber}
          shop={shop}
          primaryColor={primaryColor}
          orderData={confirmationOrder}
        />
      )}
    </View>
  );
}

export default function PublicShopPage() {
  return (
    <ShopCartProvider>
      <ShopContent />
    </ShopCartProvider>
  );
}

/* ──────────────────────────────────── Header boutique ──────────────────────────────────── */

function ShopHeader({ shop, primaryColor, cartCount, onCartPress, onBack, showBack }: {
  shop: Shop; primaryColor: string; cartCount: number; onCartPress: () => void;
  onBack?: () => void; showBack: boolean;
}) {
  const firstLetter = shop.name?.charAt(0)?.toUpperCase() || 'B';

  return (
    <View style={[s.header, { backgroundColor: primaryColor }]}>
      <View style={s.headerLeft}>
        {showBack && onBack && (
          <TouchableOpacity onPress={onBack} style={s.headerBackBtn} hitSlop={8}>
            <ChevronLeft size={22} color="#FFF" />
          </TouchableOpacity>
        )}
        {/* Logo ou initiale de l'entreprise */}
        {shop.logoUrl ? (
          <Image source={{ uri: shop.logoUrl }} style={s.headerLogo} resizeMode="cover" />
        ) : (
          <View style={s.headerLogoFallback}>
            <Text style={s.headerLogoLetter}>{firstLetter}</Text>
          </View>
        )}
        <Text style={s.headerTitle} numberOfLines={1}>{shop.name}</Text>
      </View>
      <TouchableOpacity style={s.cartBtn} onPress={onCartPress}>
        <ShoppingCart size={20} color="#FFF" />
        {cartCount > 0 && (
          <View style={s.cartBadge}>
            <Text style={s.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

/* ──────────────────────────────────── Placeholder image ──────────────────────────────────── */

/** Placeholder avec initiales et dégradé léger quand un produit n'a pas d'image */
function ProductImagePlaceholder({ name, size = 'card' }: { name: string; size?: 'card' | 'detail' | 'cart' | 'recap' }) {
  const initials = getInitials(name);
  const dimensions = size === 'detail' ? s.detailPlaceholder
    : size === 'cart' ? s.cartThumb
    : size === 'recap' ? s.recapThumb
    : s.cardPlaceholder;
  const fontSize = size === 'detail' ? 24 : size === 'cart' ? 14 : size === 'recap' ? 11 : 20;

  return (
    <View style={[dimensions, s.placeholderBase]}>
      <Text style={[s.placeholderInitials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

/* ──────────────────────────────────── Storefront (catalogue) ──────────────────────────────── */

function StorefrontView({ shop, products, variants, primaryColor, onSelectProduct }: {
  shop: Shop; products: Product[]; variants: ProductVariant[];
  primaryColor: string; onSelectProduct: (id: string) => void;
}) {
  const { addItem } = useShopCart();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.categoryName) cats.add(p.categoryName); });
    return Array.from(cats);
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      result = result.filter(p => p.categoryName === selectedCategory);
    }
    return result;
  }, [products, search, selectedCategory]);

  const getMinPrice = useCallback((product: Product) => {
    const productVariants = variants.filter(v => v.productId === product.id && v.isActive);
    if (productVariants.length === 0) return product.salePrice ?? 0;
    return Math.min(...productVariants.map(v => v.salePrice ?? 0));
  }, [variants]);

  const hasMultiplePrices = useCallback((product: Product) => {
    const productVariants = variants.filter(v => v.productId === product.id && v.isActive);
    if (productVariants.length === 0) return false;
    const prices = new Set(productVariants.map(v => v.salePrice));
    return prices.size > 1;
  }, [variants]);

  /** Calcule la largeur d'une carte produit — 2 colonnes avec gap */
  const cardWidth = useMemo(() => {
    const containerPadding = 16 * 2;
    const gap = 12;
    return (width - containerPadding - gap) / 2;
  }, [width]);

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
      {/* Bannière d'accueil */}
      {shop.welcomeMessage ? (
        <View style={[s.welcomeBanner, { backgroundColor: primaryColor + '10' }]}>
          <Text style={[s.welcomeText, { color: primaryColor }]}>{shop.welcomeMessage}</Text>
        </View>
      ) : null}

      {shop.description ? (
        <Text style={s.shopDescription}>{shop.description}</Text>
      ) : null}

      {/* Barre de recherche */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un produit..."
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* Filtres catégorie */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryBar} contentContainerStyle={s.categoryBarInner}>
          <TouchableOpacity
            style={[s.categoryChip, !selectedCategory && { backgroundColor: primaryColor, borderColor: primaryColor }]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[s.categoryChipText, !selectedCategory && { color: '#FFF' }]}>Tous</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.categoryChip, selectedCategory === cat && { backgroundColor: primaryColor, borderColor: primaryColor }]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[s.categoryChipText, selectedCategory === cat && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Grille produits ou état vide */}
      {filtered.length === 0 ? (
        <View style={s.emptyProducts}>
          <Package size={40} color="#CBD5E1" />
          <Text style={s.emptyProductsText}>Aucun produit trouvé</Text>
        </View>
      ) : (
        <View style={s.productGrid}>
          {filtered.map(product => {
            const minPrice = getMinPrice(product);
            const multiPrice = hasMultiplePrices(product);
            const totalStock = product.stockQuantity;
            const productHasVariants = hasVariants(product, variants);

            return (
              <TouchableOpacity
                key={product.id}
                style={[s.productCard, { width: cardWidth }]}
                onPress={() => onSelectProduct(product.id)}
                activeOpacity={0.7}
              >
                {/* Image ou placeholder avec initiales */}
                <View style={s.productImageWrap}>
                  {product.photoUrl ? (
                    <Image source={{ uri: product.photoUrl }} style={s.productImage} resizeMode="cover" />
                  ) : (
                    <ProductImagePlaceholder name={product.name} size="card" />
                  )}

                  {/* Badge rupture de stock — style doux */}
                  {totalStock === 0 && (
                    <View style={s.outOfStockBadge}>
                      <Text style={s.outOfStockText}>Rupture de stock</Text>
                    </View>
                  )}
                  {totalStock > 0 && totalStock < 5 && (
                    <View style={s.lowStockBadge}>
                      <Text style={s.lowStockText}>Stock limité</Text>
                    </View>
                  )}
                </View>

                {/* Infos produit */}
                <View style={s.productCardInfo}>
                  <Text style={s.productCardName} numberOfLines={2}>{product.name}</Text>
                  <Text style={[s.productCardPrice, { color: primaryColor }]}>
                    {multiPrice ? `À partir de ${(minPrice ?? 0).toFixed(2)}` : `${(minPrice ?? 0).toFixed(2)}`} CHF
                  </Text>

                  {/* Bouton contextuel — Voir les options / Ajouter / Indisponible */}
                  {totalStock === 0 ? (
                    <View style={s.btnDisabled}>
                      <Text style={s.btnDisabledText}>Indisponible</Text>
                    </View>
                  ) : productHasVariants ? (
                    <View style={[s.btnOutline, { borderColor: primaryColor }]}>
                      <Text style={[s.btnOutlineText, { color: primaryColor }]}>Voir les options</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.btnFilled, { backgroundColor: primaryColor }]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        addItem({
                          productId: product.id,
                          productName: product.name,
                          variantInfo: {},
                          unitPrice: minPrice,
                          quantity: 1,
                          photoUrl: product.photoUrl,
                          maxStock: totalStock,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <ShoppingCart size={13} color="#FFF" />
                      <Text style={s.btnFilledText}>Ajouter</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Contact */}
      {(shop.contactPhone || shop.contactEmail || shop.contactAddress) && (
        <View style={s.contactSection}>
          <Text style={s.contactTitle}>Contact</Text>
          {shop.contactPhone ? (
            <View style={s.contactRow}>
              <Phone size={14} color="#64748B" />
              <Text style={s.contactText}>{shop.contactPhone}</Text>
            </View>
          ) : null}
          {shop.contactEmail ? (
            <View style={s.contactRow}>
              <Mail size={14} color="#64748B" />
              <Text style={s.contactText}>{shop.contactEmail}</Text>
            </View>
          ) : null}
          {shop.contactAddress ? (
            <View style={s.contactRow}>
              <MapPin size={14} color="#64748B" />
              <Text style={s.contactText}>{shop.contactAddress}</Text>
            </View>
          ) : null}
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ──────────────────────────────────── Détail produit ──────────────────────────────────── */

function ProductDetailView({ product, variants: productVariants, primaryColor }: {
  product: Product; variants: ProductVariant[]; primaryColor: string;
}) {
  const { addItem } = useShopCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    productVariants.length > 0 ? productVariants[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const currentPrice = selectedVariant ? (selectedVariant.salePrice ?? 0) : (product.salePrice ?? 0);
  const currentStock = selectedVariant ? (selectedVariant.stockQuantity ?? 0) : (product.stockQuantity ?? 0);
  const isOutOfStock = currentStock <= 0;

  const attributeNames = useMemo(() => {
    if (productVariants.length === 0) return [];
    const names = new Set<string>();
    productVariants.forEach(v => {
      Object.keys(v.attributes).forEach(k => names.add(k));
    });
    return Array.from(names);
  }, [productVariants]);

  const attributeValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    attributeNames.forEach(name => {
      const vals = new Set<string>();
      productVariants.forEach(v => {
        if (v.attributes[name]) vals.add(v.attributes[name]);
      });
      result[name] = Array.from(vals);
    });
    return result;
  }, [attributeNames, productVariants]);

  const selectedAttributes = useMemo(() => {
    return selectedVariant?.attributes ?? {};
  }, [selectedVariant]);

  const selectAttribute = useCallback((attrName: string, value: string) => {
    const newAttrs = { ...selectedAttributes, [attrName]: value };
    const match = productVariants.find(v =>
      Object.entries(newAttrs).every(([k, val]) => v.attributes[k] === val)
    );
    if (match) setSelectedVariant(match);
  }, [selectedAttributes, productVariants]);

  const handleAddToCart = useCallback(() => {
    const item: CartItem = {
      productId: product.id,
      productName: product.name,
      variantInfo: selectedVariant?.attributes ?? {},
      unitPrice: currentPrice,
      quantity,
      photoUrl: product.photoUrl,
      maxStock: currentStock,
    };
    addItem(item);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [product, selectedVariant, currentPrice, quantity, currentStock, addItem]);

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
      {/* Image principale */}
      <View style={s.productDetailImage}>
        {product.photoUrl ? (
          <Image source={{ uri: product.photoUrl }} style={s.productDetailImg} resizeMode="cover" />
        ) : (
          <ProductImagePlaceholder name={product.name} size="detail" />
        )}
      </View>

      <Text style={s.productDetailName}>{product.name}</Text>
      <Text style={[s.productDetailPrice, { color: primaryColor }]}>{(currentPrice ?? 0).toFixed(2)} CHF</Text>

      {product.description ? (
        <Text style={s.productDetailDesc}>{product.description}</Text>
      ) : null}

      {/* Indicateur de stock */}
      <View style={s.stockIndicator}>
        {isOutOfStock ? (
          <View style={s.stockBadgeRed}>
            <Text style={s.stockBadgeRedText}>Rupture de stock</Text>
          </View>
        ) : currentStock < 5 ? (
          <View style={s.stockBadgeOrange}>
            <Text style={s.stockBadgeOrangeText}>Stock limité ({currentStock})</Text>
          </View>
        ) : (
          <View style={s.stockBadgeGreen}>
            <Text style={s.stockBadgeGreenText}>En stock</Text>
          </View>
        )}
      </View>

      {/* Sélection des variantes */}
      {attributeNames.map(attrName => (
        <View key={attrName} style={s.attributeSection}>
          <Text style={s.attributeLabel}>{attrName}</Text>
          <View style={s.attributeOptions}>
            {attributeValues[attrName]?.map(val => {
              const isSelected = selectedAttributes[attrName] === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[s.attributeOption, isSelected && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                  onPress={() => selectAttribute(attrName, val)}
                >
                  <Text style={[s.attributeOptionText, isSelected && { color: '#FFF' }]}>{val}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Sélecteur de quantité */}
      <View style={s.quantityRow}>
        <Text style={s.quantityLabel}>Quantité</Text>
        <View style={s.quantityControls}>
          <TouchableOpacity
            style={[s.qtyBtn, { borderColor: primaryColor }]}
            onPress={() => setQuantity(q => Math.max(1, q - 1))}
          >
            <Minus size={16} color={primaryColor} />
          </TouchableOpacity>
          <Text style={s.qtyValue}>{quantity}</Text>
          <TouchableOpacity
            style={[s.qtyBtn, { borderColor: primaryColor }]}
            onPress={() => setQuantity(q => Math.min(currentStock, q + 1))}
          >
            <Plus size={16} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bouton ajouter au panier */}
      <TouchableOpacity
        style={[s.addToCartBtn, { backgroundColor: isOutOfStock ? '#94A3B8' : primaryColor }]}
        onPress={handleAddToCart}
        disabled={isOutOfStock}
      >
        {added ? (
          <CheckCircle size={18} color="#FFF" />
        ) : (
          <ShoppingCart size={18} color="#FFF" />
        )}
        <Text style={s.addToCartText}>
          {added ? 'Ajouté !' : isOutOfStock ? 'Indisponible' : 'Ajouter au panier'}
        </Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ──────────────────────────────────── Panier ──────────────────────────────────── */

function CartView({ primaryColor, onCheckout }: {
  primaryColor: string; onCheckout: () => void;
}) {
  const { items, subtotal, updateQuantity, removeItem } = useShopCart();

  if (items.length === 0) {
    return (
      <View style={s.emptyCart}>
        <ShoppingCart size={48} color="#CBD5E1" />
        <Text style={s.emptyCartTitle}>Votre panier est vide</Text>
        <Text style={s.emptyCartText}>Parcourez la boutique pour ajouter des articles</Text>
      </View>
    );
  }

  const tva = subtotal * 0.077;
  const total = subtotal + tva;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
      <Text style={s.cartTitle}>Votre panier</Text>

      {/* Liste des articles avec miniatures */}
      {items.map((item) => {
        const key = `${item.productId}-${JSON.stringify(item.variantInfo)}`;
        return (
          <View key={key} style={s.cartItem}>
            {/* Miniature 60×60 */}
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={s.cartThumb} resizeMode="cover" />
            ) : (
              <ProductImagePlaceholder name={item.productName} size="cart" />
            )}

            <View style={s.cartItemCenter}>
              <Text style={s.cartItemName} numberOfLines={2}>{item.productName}</Text>
              {Object.keys(item.variantInfo).length > 0 && (
                <Text style={s.cartItemVariant}>
                  {Object.entries(item.variantInfo).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </Text>
              )}
              <Text style={s.cartItemUnitPrice}>{item.unitPrice.toFixed(2)} CHF</Text>

              {/* Sélecteur quantité */}
              <View style={s.cartQtyRow}>
                <TouchableOpacity
                  style={[s.cartQtyBtn, { borderColor: primaryColor }]}
                  onPress={() => updateQuantity(item.productId, item.variantInfo, item.quantity - 1)}
                >
                  <Minus size={12} color={primaryColor} />
                </TouchableOpacity>
                <Text style={s.cartQtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={[s.cartQtyBtn, { borderColor: primaryColor }]}
                  onPress={() => updateQuantity(item.productId, item.variantInfo, Math.min(item.maxStock, item.quantity + 1))}
                >
                  <Plus size={12} color={primaryColor} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Prix ligne + suppression */}
            <View style={s.cartItemRight}>
              <Text style={[s.cartItemLinePrice, { color: primaryColor }]}>
                {(item.unitPrice * item.quantity).toFixed(2)} CHF
              </Text>
              <TouchableOpacity onPress={() => removeItem(item.productId, item.variantInfo)} style={s.cartDeleteBtn}>
                <Trash2 size={15} color="#B0B8C4" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Récapitulatif collé juste sous la liste */}
      <View style={s.cartSummary}>
        <View style={s.cartSummaryRow}>
          <Text style={s.cartSummaryLabel}>Sous-total HT</Text>
          <Text style={s.cartSummaryValue}>{subtotal.toFixed(2)} CHF</Text>
        </View>
        <View style={s.cartSummaryRow}>
          <Text style={s.cartSummaryLabel}>TVA (7.7%)</Text>
          <Text style={s.cartSummaryValue}>{tva.toFixed(2)} CHF</Text>
        </View>
        <View style={[s.cartSummaryRow, s.cartSummaryTotal]}>
          <Text style={s.cartSummaryTotalLabel}>Total TTC</Text>
          <Text style={[s.cartSummaryTotalValue, { color: primaryColor }]}>{total.toFixed(2)} CHF</Text>
        </View>
      </View>

      {/* Bouton "Passer commande" — max 400px, centré */}
      <View style={s.ctaBtnWrapper}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: primaryColor }]}
          onPress={onCheckout}
        >
          <Text style={s.ctaBtnText}>Passer commande</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ──────────────────────────────── Barre de progression checkout ──────────────────────────── */

function CheckoutProgress({ step, primaryColor }: { step: number; primaryColor: string }) {
  const steps = ['Panier', 'Coordonnées', 'Confirmation'];
  return (
    <View style={s.progressBar}>
      {steps.map((label, idx) => {
        const isPast = idx < step;
        const isActive = idx === step;
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={label}>
            <View style={s.progressStep}>
              <View style={[
                s.progressCircle,
                isPast && { backgroundColor: primaryColor, borderColor: primaryColor },
                isActive && { borderColor: primaryColor, borderWidth: 2 },
                !isPast && !isActive && { borderColor: '#D1D5DB', borderWidth: 2 },
              ]}>
                {isPast ? (
                  <Check size={12} color="#FFF" />
                ) : (
                  <Text style={[
                    s.progressCircleText,
                    isActive && { color: primaryColor, fontWeight: '700' as const },
                    !isActive && !isPast && { color: '#D1D5DB' },
                  ]}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[
                s.progressLabel,
                (isActive || isPast) && { color: primaryColor, fontWeight: '600' as const },
              ]}>{label}</Text>
            </View>
            {!isLast && (
              <View style={[s.progressLine, isPast && { backgroundColor: primaryColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/* ──────────────────────────────────── Checkout ──────────────────────────────────── */

function CheckoutView({ shop, primaryColor, onConfirmed }: {
  shop: Shop; primaryColor: string;
  onConfirmed: (orderNumber: string, orderData: any) => void;
}) {
  const { items, subtotal, clearCart } = useShopCart();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<string>(shop.deliveryPickup ? 'pickup' : 'shipping');
  const [paymentMethod, setPaymentMethod] = useState<string>(
    shop.paymentInStore ? 'in_store' : shop.paymentBankTransfer ? 'bank_transfer' : 'on_delivery'
  );
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const shippingCost = deliveryMode === 'shipping' ? (shop.shippingPrice ?? 0) : 0;
  const tva = subtotal * 0.077;
  const total = subtotal + tva + shippingCost;

  const hasAnyPaymentMethod = shop.paymentInStore || shop.paymentBankTransfer || shop.paymentOnDelivery;

  const paymentLabels: Record<string, string> = {
    in_store: 'Paiement en boutique',
    bank_transfer: 'Virement bancaire',
    on_delivery: 'Paiement à la livraison',
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError('Veuillez remplir les champs obligatoires (nom, prénom, téléphone)');
      return;
    }
    if (!acceptTerms) {
      setError('Veuillez accepter les conditions générales');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const orderItems = items.map(item => ({
        productId: item.productId,
        variantInfo: item.variantInfo,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.unitPrice * item.quantity,
      }));

      const result = await shopDb.createShopOrder(
        {
          companyId: shop.companyId,
          shopId: shop.id,
          customerFirstName: firstName,
          customerLastName: lastName,
          customerEmail: '',
          customerPhone: phone,
          customerAddress: address,
          deliveryMode,
          paymentMethod: paymentLabels[paymentMethod] || paymentMethod,
          subtotalHt: subtotal,
          tvaAmount: tva,
          shippingCost,
          totalTtc: total,
          notes,
        },
        orderItems
      );

      if (result) {
        for (const item of items) {
          await shopDb.decrementStock(item.productId, item.quantity);
        }
        clearCart();
        onConfirmed(result.orderNumber, {
          deliveryMode,
          paymentMethod,
          total,
          firstName,
          lastName,
        });
      } else {
        setError('Erreur lors de la création de la commande');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
      {/* Barre de progression 3 étapes */}
      <CheckoutProgress step={1} primaryColor={primaryColor} />

      <Text style={s.checkoutTitle}>Finaliser la commande</Text>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Coordonnées */}
      <View style={s.checkoutCard}>
        <Text style={s.checkoutSectionTitle}>Vos coordonnées</Text>
        <View style={s.formRow}>
          <View style={s.formHalf}>
            <Text style={s.formLabel}>Prénom *</Text>
            <TextInput style={s.formInput} value={firstName} onChangeText={setFirstName} placeholder="Jean" placeholderTextColor="#94A3B8" />
          </View>
          <View style={s.formHalf}>
            <Text style={s.formLabel}>Nom *</Text>
            <TextInput style={s.formInput} value={lastName} onChangeText={setLastName} placeholder="Dupont" placeholderTextColor="#94A3B8" />
          </View>
        </View>
        <Text style={s.formLabel}>Téléphone *</Text>
        <TextInput style={s.formInput} value={phone} onChangeText={setPhone} placeholder="+41 79 123 45 67" keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
        <Text style={s.formLabel}>Adresse</Text>
        <TextInput style={s.formInput} value={address} onChangeText={setAddress} placeholder="Rue, NPA, Ville" placeholderTextColor="#94A3B8" />
        <Text style={s.formLabel}>Note / commentaire</Text>
        <TextInput style={[s.formInput, { minHeight: 60, textAlignVertical: 'top' as const }]} value={notes} onChangeText={setNotes} placeholder="Instructions particulières..." placeholderTextColor="#94A3B8" multiline />
      </View>

      {/* Mode de livraison */}
      {(shop.deliveryPickup || shop.deliveryShipping) && (
        <View style={s.checkoutCard}>
          <Text style={s.checkoutSectionTitle}>Mode de livraison</Text>
          {shop.deliveryPickup && (
            <TouchableOpacity
              style={[s.optionRow, deliveryMode === 'pickup' && { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
              onPress={() => setDeliveryMode('pickup')}
            >
              <View style={[s.radioOuter, deliveryMode === 'pickup' && { borderColor: primaryColor }]}>
                {deliveryMode === 'pickup' && <View style={[s.radioInner, { backgroundColor: primaryColor }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>Retrait en boutique</Text>
                <Text style={s.optionSubtitle}>Gratuit</Text>
              </View>
            </TouchableOpacity>
          )}
          {shop.deliveryShipping && (
            <TouchableOpacity
              style={[s.optionRow, deliveryMode === 'shipping' && { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
              onPress={() => setDeliveryMode('shipping')}
            >
              <View style={[s.radioOuter, deliveryMode === 'shipping' && { borderColor: primaryColor }]}>
                {deliveryMode === 'shipping' && <View style={[s.radioInner, { backgroundColor: primaryColor }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>Livraison</Text>
                <Text style={s.optionSubtitle}>{(shop.shippingPrice ?? 0) > 0 ? `${(shop.shippingPrice ?? 0).toFixed(2)} CHF` : 'Gratuit'}</Text>
              </View>
            </TouchableOpacity>
          )}
          {deliveryMode === 'shipping' && (
            <>
              <Text style={s.formLabel}>Adresse de livraison</Text>
              <TextInput style={[s.formInput, { minHeight: 60, textAlignVertical: 'top' as const }]} value={address} onChangeText={setAddress} multiline placeholder="Rue, NPA, Ville" placeholderTextColor="#94A3B8" />
            </>
          )}
        </View>
      )}

      {/* Moyen de paiement */}
      <View style={s.checkoutCard}>
        <Text style={s.checkoutSectionTitle}>Moyen de paiement</Text>
        {hasAnyPaymentMethod ? (
          <>
            {shop.paymentInStore && (
              <TouchableOpacity
                style={[s.optionRow, paymentMethod === 'in_store' && { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
                onPress={() => setPaymentMethod('in_store')}
              >
                <View style={[s.radioOuter, paymentMethod === 'in_store' && { borderColor: primaryColor }]}>
                  {paymentMethod === 'in_store' && <View style={[s.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={s.optionTitle}>Paiement en boutique</Text>
              </TouchableOpacity>
            )}
            {shop.paymentBankTransfer && (
              <TouchableOpacity
                style={[s.optionRow, paymentMethod === 'bank_transfer' && { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
                onPress={() => setPaymentMethod('bank_transfer')}
              >
                <View style={[s.radioOuter, paymentMethod === 'bank_transfer' && { borderColor: primaryColor }]}>
                  {paymentMethod === 'bank_transfer' && <View style={[s.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={s.optionTitle}>Virement bancaire</Text>
              </TouchableOpacity>
            )}
            {shop.paymentOnDelivery && (
              <TouchableOpacity
                style={[s.optionRow, paymentMethod === 'on_delivery' && { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}
                onPress={() => setPaymentMethod('on_delivery')}
              >
                <View style={[s.radioOuter, paymentMethod === 'on_delivery' && { borderColor: primaryColor }]}>
                  {paymentMethod === 'on_delivery' && <View style={[s.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
                <Text style={s.optionTitle}>Paiement à la livraison</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          /* Aucun moyen de paiement configuré — message informatif */
          <View style={s.noPaymentBanner}>
            <Banknote size={20} color="#38A169" />
            <Text style={s.noPaymentText}>Paiement à la livraison ou au retrait</Text>
          </View>
        )}
      </View>

      {/* Récapitulatif avec miniatures */}
      <View style={s.checkoutCard}>
        <Text style={s.checkoutSectionTitle}>Récapitulatif</Text>
        {items.map(item => (
          <View key={`${item.productId}-${JSON.stringify(item.variantInfo)}`} style={s.recapRow}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={s.recapThumb} resizeMode="cover" />
            ) : (
              <ProductImagePlaceholder name={item.productName} size="recap" />
            )}
            <Text style={s.recapName} numberOfLines={1}>{item.productName} ×{item.quantity}</Text>
            <Text style={s.recapPrice}>{(item.unitPrice * item.quantity).toFixed(2)} CHF</Text>
          </View>
        ))}
        <View style={[s.cartSummaryRow, { marginTop: 8 }]}>
          <Text style={s.cartSummaryLabel}>Sous-total HT</Text>
          <Text style={s.cartSummaryValue}>{subtotal.toFixed(2)} CHF</Text>
        </View>
        <View style={s.cartSummaryRow}>
          <Text style={s.cartSummaryLabel}>TVA (7.7%)</Text>
          <Text style={s.cartSummaryValue}>{tva.toFixed(2)} CHF</Text>
        </View>
        {shippingCost > 0 && (
          <View style={s.cartSummaryRow}>
            <Text style={s.cartSummaryLabel}>Livraison</Text>
            <Text style={s.cartSummaryValue}>{shippingCost.toFixed(2)} CHF</Text>
          </View>
        )}
        <View style={[s.cartSummaryRow, s.cartSummaryTotal]}>
          <Text style={s.cartSummaryTotalLabel}>Total TTC</Text>
          <Text style={[s.cartSummaryTotalValue, { color: primaryColor }]}>{total.toFixed(2)} CHF</Text>
        </View>
      </View>

      {/* CGV */}
      <TouchableOpacity style={s.termsRow} onPress={() => setAcceptTerms(!acceptTerms)}>
        <View style={[s.checkbox, acceptTerms && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
          {acceptTerms && <Check size={14} color="#FFF" />}
        </View>
        <Text style={s.termsText}>J'accepte les conditions générales de vente</Text>
      </TouchableOpacity>

      {/* Bouton confirmer — max 400px, centré */}
      <View style={s.ctaBtnWrapper}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: submitting ? '#94A3B8' : primaryColor }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={s.ctaBtnText}>Confirmer la commande</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/* ──────────────────────────────────── Confirmation ──────────────────────────────────── */

function ConfirmationView({ orderNumber, shop, primaryColor, orderData }: {
  orderNumber: string; shop: Shop; primaryColor: string; orderData: any;
}) {
  return (
    <ScrollView style={s.content} contentContainerStyle={[s.contentInner, s.confirmationContent]}>
      {/* Barre de progression — étape 3 (terminé) */}
      <CheckoutProgress step={2} primaryColor={primaryColor} />

      <View style={s.confirmIcon}>
        <CheckCircle size={48} color="#059669" />
      </View>
      <Text style={s.confirmTitle}>Commande confirmée !</Text>
      <Text style={[s.confirmNumber, { color: primaryColor }]}>{orderNumber}</Text>

      <View style={s.confirmCard}>
        {orderData?.deliveryMode === 'pickup' && (
          <Text style={s.confirmInstruction}>
            Rendez-vous en boutique pour le retrait et le paiement.
          </Text>
        )}
        {orderData?.paymentMethod === 'bank_transfer' && shop.bankDetails && (
          <View>
            <Text style={s.confirmInstruction}>
              Effectuez le virement sur le compte suivant :
            </Text>
            <Text style={s.confirmBankDetails}>{shop.bankDetails}</Text>
          </View>
        )}
        {orderData?.deliveryMode === 'shipping' && (
          <Text style={s.confirmInstruction}>
            Votre commande sera livrée à l'adresse indiquée.
          </Text>
        )}
      </View>

      <Text style={s.confirmEmail}>
        Un email de confirmation vous sera envoyé à l'adresse renseignée.
      </Text>
    </ScrollView>
  );
}

/* ══════════════════════════════════════ STYLES ══════════════════════════════════════ */

const SHADOW_LIGHT = Platform.OS === 'web'
  ? { boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
  : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 };

const SHADOW_MEDIUM = Platform.OS === 'web'
  ? { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
  : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 };

const HEADER_SHADOW = Platform.OS === 'web'
  ? { boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }
  : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 };

const s = StyleSheet.create({
  /* ─── Layout global ─── */
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 16, backgroundColor: '#F9FAFB' },
  loadingText: { fontSize: 14, color: '#64748B' },
  notFoundTitle: { fontSize: 20, fontWeight: '700' as const, color: '#1E293B', marginTop: 16 },
  notFoundText: { fontSize: 14, color: '#64748B' },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 8 },

  /* ─── Header ─── */
  header: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
    paddingHorizontal: 16, paddingVertical: 12,
    ...HEADER_SHADOW,
  },
  headerLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1, gap: 10 },
  headerBackBtn: { padding: 4 },
  headerLogo: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF' },
  headerLogoFallback: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  headerLogoLetter: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
  headerTitle: { fontSize: 18, fontWeight: '600' as const, color: '#FFF', flex: 1 },
  cartBtn: { position: 'relative' as const, padding: 8 },
  cartBadge: {
    position: 'absolute' as const, top: 0, right: 0,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#DC2626', alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },

  /* ─── Bannière & recherche ─── */
  welcomeBanner: { padding: 16, borderRadius: 12 },
  welcomeText: { fontSize: 14, fontWeight: '500' as const, textAlign: 'center' as const },
  shopDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center' as const },
  searchRow: {},
  searchBox: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 12, paddingVertical: 10,
    ...SHADOW_LIGHT,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B' },
  categoryBar: { maxHeight: 44 },
  categoryBarInner: { gap: 8, paddingRight: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF',
  },
  categoryChipText: { fontSize: 13, fontWeight: '500' as const, color: '#6B7280' },

  /* ─── Placeholder initiales ─── */
  placeholderBase: {
    backgroundColor: '#F0F0F5',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  placeholderInitials: { fontWeight: '700' as const, color: '#9CA3AF' },
  cardPlaceholder: { width: '100%' as const, height: 120 },
  detailPlaceholder: { width: '100%' as const, height: 200, borderRadius: 14 },
  cartThumb: { width: 50, height: 50, borderRadius: 10 },
  recapThumb: { width: 36, height: 36, borderRadius: 8 },

  /* ─── Grille produits ─── */
  emptyProducts: { alignItems: 'center' as const, paddingVertical: 48, gap: 12 },
  emptyProductsText: { fontSize: 14, color: '#94A3B8' },
  productGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  productCard: {
    backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden' as const,
    borderWidth: 1, borderColor: '#E5E7EB',
    ...SHADOW_MEDIUM,
  },
  productImageWrap: { position: 'relative' as const },
  productImage: { width: '100%' as const, height: 120 },

  /* Badge rupture — style doux */
  outOfStockBadge: {
    position: 'absolute' as const, top: 8, left: 8,
    backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  outOfStockText: { color: '#DC2626', fontSize: 12, fontWeight: '700' as const },
  lowStockBadge: {
    position: 'absolute' as const, top: 8, left: 8,
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  lowStockText: { color: '#D97706', fontSize: 12, fontWeight: '600' as const },

  /* Info carte produit */
  productCardInfo: { padding: 10, gap: 3, flex: 1 },
  productCardName: { fontSize: 13, fontWeight: '600' as const, color: '#1E293B', minHeight: 32 },
  productCardPrice: { fontSize: 14, fontWeight: '700' as const },

  /* Boutons carte produit */
  btnFilled: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 5, paddingVertical: 8, borderRadius: 8, marginTop: 'auto' as const,
  },
  btnFilledText: { color: '#FFF', fontSize: 12, fontWeight: '600' as const },
  btnOutline: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, marginTop: 'auto' as const,
  },
  btnOutlineText: { fontSize: 12, fontWeight: '600' as const },
  btnDisabled: {
    alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', marginTop: 'auto' as const,
  },
  btnDisabledText: { fontSize: 12, fontWeight: '600' as const, color: '#9CA3AF' },

  /* ─── Contact ─── */
  contactSection: { padding: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 10, ...SHADOW_LIGHT },
  contactTitle: { fontSize: 14, fontWeight: '700' as const, color: '#1E293B' },
  contactRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  contactText: { fontSize: 13, color: '#6B7280' },

  /* ─── Détail produit ─── */
  productDetailImage: { borderRadius: 14, overflow: 'hidden' as const, backgroundColor: '#F0F0F5' },
  productDetailImg: { width: '100%' as const, height: 200 },
  productDetailName: { fontSize: 22, fontWeight: '800' as const, color: '#1E293B' },
  productDetailPrice: { fontSize: 20, fontWeight: '700' as const },
  productDetailDesc: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  stockIndicator: { marginTop: 4 },
  stockBadgeGreen: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' as const },
  stockBadgeGreenText: { color: '#059669', fontSize: 12, fontWeight: '600' as const },
  stockBadgeOrange: { backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' as const },
  stockBadgeOrangeText: { color: '#D97706', fontSize: 12, fontWeight: '600' as const },
  stockBadgeRed: { backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' as const },
  stockBadgeRedText: { color: '#DC2626', fontSize: 12, fontWeight: '600' as const },
  attributeSection: { gap: 8 },
  attributeLabel: { fontSize: 13, fontWeight: '600' as const, color: '#475569' },
  attributeOptions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  attributeOption: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF',
  },
  attributeOptionText: { fontSize: 13, fontWeight: '500' as const, color: '#475569' },
  quantityRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  quantityLabel: { fontSize: 14, fontWeight: '600' as const, color: '#1E293B' },
  quantityControls: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  qtyValue: { fontSize: 16, fontWeight: '700' as const, color: '#1E293B', minWidth: 30, textAlign: 'center' as const },
  addToCartBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 8, paddingVertical: 14, borderRadius: 12,
  },
  addToCartText: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },

  /* ─── Panier ─── */
  emptyCart: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 80 },
  emptyCartTitle: { fontSize: 18, fontWeight: '700' as const, color: '#1E293B' },
  emptyCartText: { fontSize: 14, color: '#94A3B8' },
  cartTitle: { fontSize: 20, fontWeight: '800' as const, color: '#1E293B' },
  cartItem: {
    flexDirection: 'row' as const, backgroundColor: '#FFF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 12, alignItems: 'flex-start' as const,
    ...SHADOW_LIGHT,
  },
  cartItemCenter: { flex: 1, gap: 2 },
  cartItemName: { fontSize: 14, fontWeight: '600' as const, color: '#1E293B' },
  cartItemVariant: { fontSize: 11, color: '#94A3B8' },
  cartItemUnitPrice: { fontSize: 13, color: '#6B7280' },
  cartQtyRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 4 },
  cartQtyBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  cartQtyText: { fontSize: 14, fontWeight: '700' as const, color: '#1E293B', minWidth: 20, textAlign: 'center' as const },
  cartItemRight: { alignItems: 'flex-end' as const, justifyContent: 'space-between' as const, height: 50 },
  cartItemLinePrice: { fontSize: 14, fontWeight: '700' as const },
  cartDeleteBtn: { padding: 4 },

  /* Récapitulatif panier */
  cartSummary: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 6,
    ...SHADOW_LIGHT,
  },
  cartSummaryRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
  cartSummaryLabel: { fontSize: 13, color: '#6B7280' },
  cartSummaryValue: { fontSize: 13, fontWeight: '500' as const, color: '#1E293B' },
  cartSummaryTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 },
  cartSummaryTotalLabel: { fontSize: 15, fontWeight: '700' as const, color: '#1E293B' },
  cartSummaryTotalValue: { fontSize: 17, fontWeight: '800' as const },

  /* Bouton CTA (passer commande / confirmer) — max 400px, centré */
  ctaBtnWrapper: { alignItems: 'center' as const },
  ctaBtn: {
    width: '100%' as const, maxWidth: 400, height: 50, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },

  /* ─── Barre de progression checkout ─── */
  progressBar: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    paddingVertical: 8, paddingHorizontal: 4, height: 56,
  },
  progressStep: { alignItems: 'center' as const, gap: 4 },
  progressCircle: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: '#FFF',
  },
  progressCircleText: { fontSize: 12, fontWeight: '600' as const, color: '#6B7280' },
  progressLabel: { fontSize: 10, color: '#9CA3AF' },
  progressLine: {
    flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4, marginBottom: 16,
  },

  /* ─── Checkout ─── */
  checkoutTitle: { fontSize: 20, fontWeight: '800' as const, color: '#1E293B' },
  errorBanner: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500' as const },
  checkoutCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 10,
    ...SHADOW_LIGHT,
  },
  checkoutSectionTitle: { fontSize: 14, fontWeight: '700' as const, color: '#1E293B', marginBottom: 4 },
  formRow: { flexDirection: 'row' as const, gap: 12 },
  formHalf: { flex: 1, gap: 4 },
  formLabel: { fontSize: 12, fontWeight: '500' as const, color: '#6B7280', marginTop: 4 },
  formInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B', backgroundColor: '#FFF',
  },
  optionRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  optionTitle: { fontSize: 14, fontWeight: '600' as const, color: '#1E293B' },
  optionSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  /* Message "aucun moyen de paiement" */
  noPaymentBanner: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: '#F0FFF4', borderRadius: 10, padding: 14,
  },
  noPaymentText: { fontSize: 14, fontWeight: '500' as const, color: '#38A169', flex: 1 },

  /* Récap checkout avec miniatures */
  recapRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 6,
  },
  recapName: { flex: 1, fontSize: 13, color: '#475569' },
  recapPrice: { fontSize: 13, fontWeight: '600' as const, color: '#1E293B' },

  /* CGV */
  termsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  termsText: { fontSize: 13, color: '#475569', flex: 1 },

  /* ─── Confirmation ─── */
  confirmationContent: { alignItems: 'center' as const, paddingVertical: 24 },
  confirmIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ECFDF5', alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 16 },
  confirmTitle: { fontSize: 24, fontWeight: '800' as const, color: '#1E293B', marginTop: 16 },
  confirmNumber: { fontSize: 18, fontWeight: '700' as const, marginTop: 4 },
  confirmCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB',
    width: '100%' as const, marginTop: 24, gap: 12, ...SHADOW_LIGHT,
  },
  confirmInstruction: { fontSize: 14, color: '#475569', lineHeight: 20 },
  confirmBankDetails: { fontSize: 13, fontWeight: '600' as const, color: '#1E293B', backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginTop: 8 },
  confirmEmail: { fontSize: 13, color: '#94A3B8', marginTop: 16, textAlign: 'center' as const },
});
