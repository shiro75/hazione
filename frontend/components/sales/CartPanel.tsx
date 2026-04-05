/**
 * components/sales/CartPanel.tsx
 *
 * Panneau panier du POS (desktop uniquement — mobile utilise une bottom sheet).
 * Contient :
 *   - Sélecteur client avec dropdown de recherche
 *   - Sélecteur de remise avec création inline
 *   - Liste des articles du panier
 *   - Totaux HT/TVA/TTC
 *   - Bouton PAYER
 *   - Bouton impression ticket
 */

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Animated,
} from 'react-native';
import {
  ShoppingCart, UserPlus, ChevronDown, X, Tag, Plus,
  Receipt, Trash2, Minus, CreditCard, Printer,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/utils/format';
import s from '@/components/sales/salesStyles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartPanelProps {
  // Panier
  cart: any[];
  cartTotals: { totalHT: number; totalTVA: number; totalTTC: number };
  cartItemCount: number;
  currency: string;
  updateCartQuantity: (productId: string, delta: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  checkoutAnim: Animated.Value;
  onPay: () => void;
  receiptSaleId: string | null;
  onPrintReceipt: (id: string) => void;
  setReceiptSaleId: (id: string | null) => void;
  // Client
  selectedClientId: string;
  effectiveClients: any[];
  showClientPicker: boolean;
  setShowClientPicker: (v: boolean) => void;
  clientSearch: string;
  setClientSearch: (v: string) => void;
  filteredClientsForPicker: any[];
  handleSelectClient: (id: string) => void;
  handleRemoveClient: () => void;
  discountCategoryRates: Record<string, number>;
  // Remise
  selectedDiscount: string;
  setSelectedDiscount: (v: string) => void;
  discountRate: number;
  isClientDiscount: boolean;
  showDiscountPicker: boolean;
  setShowDiscountPicker: (v: boolean) => void;
  discountCategories: string[];
  newDiscountName: string;
  setNewDiscountName: (v: string) => void;
  newDiscountRate: string;
  setNewDiscountRate: (v: string) => void;
  handleAddNewDiscount: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function CartPanel({
  cart, cartTotals, cartItemCount, currency,
  updateCartQuantity, removeFromCart, checkoutAnim, onPay,
  receiptSaleId, onPrintReceipt, setReceiptSaleId,
  selectedClientId, effectiveClients, showClientPicker, setShowClientPicker,
  clientSearch, setClientSearch, filteredClientsForPicker,
  handleSelectClient, handleRemoveClient, discountCategoryRates,
  selectedDiscount, setSelectedDiscount, discountRate, isClientDiscount,
  showDiscountPicker, setShowDiscountPicker, discountCategories,
  newDiscountName, setNewDiscountName, newDiscountRate, setNewDiscountRate,
  handleAddNewDiscount,
}: CartPanelProps) {
  const { colors } = useTheme();

  const selectedClient = effectiveClients.find((c: any) => c.id === selectedClientId);
  const clientLabel = selectedClient
    ? selectedClient.companyName || `${selectedClient.firstName} ${selectedClient.lastName}`
    : 'Client (optionnel)';

  return (
    <View style={[s.cartPanel, { backgroundColor: colors.surface, borderLeftColor: colors.border }]}>
      {/* En-tête panier */}
      <View style={s.cartHeader}>
        <View style={s.cartHeaderLeft}>
          <ShoppingCart size={18} color={colors.primary} />
          <Text style={[s.cartTitle, { color: colors.text }]}>Panier</Text>
        </View>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
          {cartItemCount} article{cartItemCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Sélecteur client */}
      <TouchableOpacity
        style={[s.clientSelector, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        onPress={() => setShowClientPicker(!showClientPicker)}
      >
        <UserPlus size={14} color={colors.textSecondary} />
        <Text style={[s.clientSelectorText, { color: selectedClientId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {clientLabel}
        </Text>
        <ChevronDown size={14} color={colors.textTertiary} />
      </TouchableOpacity>

      {showClientPicker && (
        <View style={[s.clientDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[s.clientDropdownSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            placeholder="Rechercher un client..."
            placeholderTextColor={colors.textTertiary}
            value={clientSearch}
            onChangeText={setClientSearch}
          />
          {selectedClientId ? (
            <TouchableOpacity
              style={[s.clientDropdownItem, { borderBottomColor: colors.borderLight }]}
              onPress={handleRemoveClient}
            >
              <X size={14} color={colors.danger} />
              <Text style={{ fontSize: 13, color: colors.danger }}>Retirer le client</Text>
            </TouchableOpacity>
          ) : null}
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
            {filteredClientsForPicker.map((client: any) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  s.clientDropdownItem,
                  { borderBottomColor: colors.borderLight },
                  client.id === selectedClientId && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => handleSelectClient(client.id)}
              >
                <Text style={{ fontSize: 13, color: colors.text }}>
                  {client.companyName || `${client.firstName} ${client.lastName}`}
                </Text>
                {client.discountCategory ? (
                  <Text style={{ fontSize: 10, color: colors.primary }}>
                    -{discountCategoryRates[client.discountCategory] || 0}%
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sélecteur remise */}
      <TouchableOpacity
        style={[s.clientSelector, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        onPress={() => !isClientDiscount && setShowDiscountPicker(!showDiscountPicker)}
        disabled={isClientDiscount}
      >
        <Tag size={14} color={colors.textSecondary} />
        <Text style={[s.clientSelectorText, { color: selectedDiscount ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {selectedDiscount
            ? `${selectedDiscount} (-${discountCategoryRates[selectedDiscount] || 0}%)`
            : 'Remise (optionnel)'}
        </Text>
        {isClientDiscount ? (
          <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '600' }}>CLIENT</Text>
        ) : selectedDiscount ? (
          <TouchableOpacity onPress={() => { setSelectedDiscount(''); setShowDiscountPicker(false); }} hitSlop={8}>
            <X size={14} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <ChevronDown size={14} color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      {showDiscountPicker && !isClientDiscount && (
        <View style={[s.clientDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {selectedDiscount ? (
            <TouchableOpacity
              style={[s.clientDropdownItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => { setSelectedDiscount(''); setShowDiscountPicker(false); }}
            >
              <X size={14} color={colors.danger} />
              <Text style={{ fontSize: 13, color: colors.danger }}>Retirer la remise</Text>
            </TouchableOpacity>
          ) : null}
          <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
            {discountCategories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  s.clientDropdownItem,
                  { borderBottomColor: colors.borderLight },
                  cat === selectedDiscount && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => { setSelectedDiscount(cat); setShowDiscountPicker(false); }}
              >
                <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>{cat}</Text>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  -{discountCategoryRates[cat] || 0}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Ajout rapide d'une remise */}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 8, gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Ajouter une remise</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput
                style={[s.clientDropdownSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, flex: 1 }]}
                placeholder="Nom..."
                placeholderTextColor={colors.textTertiary}
                value={newDiscountName}
                onChangeText={setNewDiscountName}
              />
              <TextInput
                style={[s.clientDropdownSearch, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, width: 60 }]}
                placeholder="%"
                placeholderTextColor={colors.textTertiary}
                value={newDiscountRate}
                onChangeText={setNewDiscountRate}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 10, justifyContent: 'center' }}
                onPress={handleAddNewDiscount}
              >
                <Plus size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Articles du panier */}
      <ScrollView style={s.cartList} showsVerticalScrollIndicator={false}>
        {cart.length === 0 ? (
          <View style={s.cartEmpty}>
            <Receipt size={32} color={colors.textTertiary} />
            <Text style={[s.cartEmptyText, { color: colors.textTertiary }]}>Panier vide</Text>
            <Text style={[s.cartEmptyHint, { color: colors.textTertiary }]}>
              Sélectionnez un produit pour l'ajouter
            </Text>
          </View>
        ) : (
          cart.map((item: any, cartIdx: number) => {
            const lineHT = item.unitPrice * item.quantity;
            const lineTVA = lineHT * (item.vatRate / 100);
            const lineTTC = lineHT + lineTVA;
            return (
              <TouchableOpacity
                key={`cart_${cartIdx}_${item.productId}_${item.variantId || 'base'}`}
                style={[s.cartItem, { borderBottomColor: colors.borderLight }]}
                activeOpacity={0.8}
              >
                <View style={s.cartItemTop}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[s.cartItemName, { color: colors.text }]} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    {item.variantLabel ? (
                      <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>
                        {item.variantLabel}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeFromCart(item.productId, item.variantId)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                <View style={s.cartItemBottom}>
                  <View style={s.qtyControl}>
                    <TouchableOpacity
                      style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                      onPress={() => updateCartQuantity(item.productId, -1, item.variantId)}
                    >
                      <Minus size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[s.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[s.qtyBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                      onPress={() => updateCartQuantity(item.productId, 1, item.variantId)}
                    >
                      <Plus size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {formatCurrency(item.unitPrice, currency)} × {item.quantity}
                    </Text>
                    <Text style={[s.cartItemTotal, { color: colors.text }]}>
                      {formatCurrency(lineTTC, currency)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Footer : totaux + bouton PAYER */}
      <View style={[s.cartFooter, { borderTopColor: colors.border }]}>
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total HT</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalHT, currency)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>TVA</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{formatCurrency(cartTotals.totalTVA, currency)}</Text>
          </View>
          {discountRate > 0 ? (
            <View style={s.totalRow}>
              <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>
                Remise ({selectedDiscount} -{discountRate}%)
              </Text>
              <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>appliquée</Text>
            </View>
          ) : null}
          <View style={[s.totalRow, { marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>
              {formatCurrency(cartTotals.totalTTC, currency)}
            </Text>
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: checkoutAnim }] }}>
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: cart.length > 0 ? '#10B981' : colors.textTertiary }]}
            onPress={onPay}
            disabled={cart.length === 0}
            activeOpacity={0.8}
          >
            <CreditCard size={20} color="#FFF" />
            <Text style={s.payBtnText}>PAYER</Text>
          </TouchableOpacity>
        </Animated.View>

        {receiptSaleId ? (
          <TouchableOpacity
            style={[s.receiptBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => { void onPrintReceipt(receiptSaleId); setReceiptSaleId(null); }}
            activeOpacity={0.7}
          >
            <Printer size={16} color={colors.primary} />
            <Text style={[s.receiptBtnText, { color: colors.primary }]}>Imprimer le ticket</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}