/**
 * @fileoverview Empty state component displayed when a list has no items.
 * Shows an icon, message, and optional CTA button to encourage first action.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import {
  Plus,
  Package,
  ShoppingCart,
  Users,
  FileText,
  BarChart3,
  Inbox,
  Search,
  Calendar,
  CreditCard,
  Truck,
  ClipboardList,
  Star,
  Bell,
  Folder,
  Settings,
  Heart,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const ILLUSTRATIONS: Record<string, LucideIcon> = {
  package: Package,
  cart: ShoppingCart,
  users: Users,
  file: FileText,
  chart: BarChart3,
  inbox: Inbox,
  search: Search,
  calendar: Calendar,
  payment: CreditCard,
  delivery: Truck,
  clipboard: ClipboardList,
  star: Star,
  bell: Bell,
  folder: Folder,
  settings: Settings,
  heart: Heart,
};

export type IllustrationKey = keyof typeof ILLUSTRATIONS;

interface EmptyStateProps {
  title: string;
  description?: string;
  subtitle?: string;
  illustration?: IllustrationKey;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default React.memo(function EmptyState({
  title,
  description,
  subtitle,
  illustration,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const iconBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconBounce, {
            toValue: -6,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(iconBounce, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [fadeAnim, scaleAnim, iconBounce]);

  const resolvedDescription = description ?? subtitle;

  const renderIllustration = () => {
    if (icon) {
      return icon;
    }

    const key = illustration ?? 'inbox';
    const IconComponent = ILLUSTRATIONS[key] ?? Inbox;
    return <IconComponent size={32} color={colors.primary} strokeWidth={1.5} />;
  };

  const iconContainerSize = SCREEN_WIDTH < 380 ? 64 : 80;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.iconOuter,
          {
            width: iconContainerSize + 24,
            height: iconContainerSize + 24,
            borderRadius: (iconContainerSize + 24) / 2,
            backgroundColor: colors.primaryLight,
            transform: [{ translateY: iconBounce }],
          },
        ]}
      >
        <View
          style={[
            styles.iconInner,
            {
              width: iconContainerSize,
              height: iconContainerSize,
              borderRadius: iconContainerSize / 2,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {renderIllustration()}
        </View>
      </Animated.View>

      <View style={styles.textBlock}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
            SCREEN_WIDTH < 380 && styles.titleSmall,
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {resolvedDescription ? (
          <Text
            style={[
              styles.description,
              { color: colors.textTertiary },
              SCREEN_WIDTH < 380 && styles.descriptionSmall,
            ]}
            numberOfLines={3}
          >
            {resolvedDescription}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.75}
          testID="empty-state-action"
        >
          <Plus size={15} color="#FFF" strokeWidth={2.5} />
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.dotsRow}>
        {[0.3, 0.6, 1, 0.6, 0.3].map((opacity, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: colors.primary,
                opacity,
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    paddingHorizontal: 40,
    alignItems: 'center' as const,
    gap: 16,
  },
  iconOuter: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  iconInner: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  textBlock: {
    alignItems: 'center' as const,
    gap: 6,
    maxWidth: 280,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  titleSmall: {
    fontSize: 15,
  },
  description: {
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  descriptionSmall: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 7,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
