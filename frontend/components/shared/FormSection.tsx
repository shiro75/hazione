/**
 * @fileoverview FormSection groups related form fields under a titled section
 * with an optional icon. Used across all form-heavy screens (settings, shop, products).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Props for the FormSection component.
 * @property title - Section heading text
 * @property icon - Optional icon rendered left of the title
 * @property description - Optional description below the title
 * @property children - Form fields to render inside the section
 */
interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}

/**
 * Groups form fields under a titled card section.
 *
 * @example
 * <FormSection title="Informations" icon={<Building size={18} color={colors.primary} />}>
 *   <FormField label="Nom" value={name} onChangeText={setName} />
 * </FormSection>
 */
export default React.memo(function FormSection({
  title,
  icon,
  description,
  children,
  noPadding = false,
}: FormSectionProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
        noPadding && styles.noPadding,
      ]}
    >
      <View style={styles.header}>
        {icon != null && <>{icon}</>}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  noPadding: {
    padding: 0,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  content: {
    gap: 12,
  },
});
