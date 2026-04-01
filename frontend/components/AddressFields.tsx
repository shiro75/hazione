/**
 * @fileoverview Reusable address form fields group (address, city, postal code, country).
 * Auto-fills city when a known postal code is entered via lookupPostalCode.
 */
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import FormField from '@/components/FormField';
import { lookupPostalCode } from '@/constants/postalCodes';

interface AddressFieldsProps {
  address: string;
  postalCode: string;
  city: string;
  country: string;
  onAddressChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  addressLabel?: string;
}

export default React.memo(function AddressFields({
  address,
  postalCode,
  city,
  country,
  onAddressChange,
  onPostalCodeChange,
  onCityChange,
  onCountryChange,
  addressLabel = 'Numéro + Rue',
}: AddressFieldsProps) {
  const handlePostalCodeChange = useCallback((value: string) => {
    onPostalCodeChange(value);
    const clean = value.replace(/\s/g, '');
    if (clean.length >= 5) {
      const result = lookupPostalCode(clean);
      if (result) {
        if (result.city) onCityChange(result.city);
        if (result.country) onCountryChange(result.country);
      }
    }
  }, [onPostalCodeChange, onCityChange, onCountryChange]);

  return (
    <View style={styles.container}>
      <FormField
        label={addressLabel}
        value={address}
        onChangeText={onAddressChange}
        placeholder="12 Rue de la Paix"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <FormField
            label="Code postal"
            value={postalCode}
            onChangeText={handlePostalCodeChange}
            placeholder="75001"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.colLarge}>
          <FormField
            label="Ville"
            value={city}
            onChangeText={onCityChange}
            placeholder="Paris"
          />
        </View>
      </View>
      <FormField
        label="Pays"
        value={country}
        onChangeText={onCountryChange}
        placeholder="France"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { flexDirection: 'row' as const, gap: 12 },
  col: { flex: 1 },
  colLarge: { flex: 2 },
});
