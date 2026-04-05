/**
 * components/dashboard/DashboardCards.tsx
 *
 * Composants réutilisables du tableau de bord.
 * Regroupés dans un seul fichier car tous sont petits et couplés au même domaine.
 *
 * EXPORTS :
 *   ClientAvatar        — avatar initiales sur fond coloré
 *   TodayBanner         — bandeau CA du jour + nombre de ventes
 *   GoalCard            — objectif CA mensuel avec barre de progression
 *   PriorityClientsCard — clients prioritaires à relancer
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import {
  Target, TrendingUp, Send, Mail, CheckCircle, AlertTriangle, ChevronRight, ShoppingCart,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, formatCurrencyInteger, formatDate } from '@/utils/format';
import { SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';

// ─── ClientAvatar ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

/**
 * Avatar circulaire affichant les initiales d'un client.
 * La couleur est déterministe basée sur le premier caractère du nom.
 */
export function ClientAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

  const colorIndex = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  const bg = AVATAR_COLORS[colorIndex];

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + '20',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: bg + '40',
    }}>
      <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: bg }}>{initials}</Text>
    </View>
  );
}

// ─── TodayBanner ──────────────────────────────────────────────────────────────

interface TodayBannerProps {
  todayRevenue: number;
  todaySalesCount: number;
  currency: string;
  salesLabel: string;
  revenueLabel: string;
}

/**
 * Bannière CA du jour avec badge nombre de ventes.
 * Bande d'accentuation gauche colorée avec la couleur primaire.
 */
export function TodayBanner({ todayRevenue, todaySalesCount, currency, salesLabel, revenueLabel }: TodayBannerProps) {
  const { colors } = useTheme();
  return (
    <View style={[cardStyles.todayBanner, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
      <View style={[cardStyles.todayAccent, { backgroundColor: colors.primary }]} />
      <View style={cardStyles.todayBannerContent}>
        <View>
          <Text style={[cardStyles.todayLabel, { color: colors.textTertiary }]}>{revenueLabel}</Text>
          <Text style={[cardStyles.todayAmount, { color: colors.text }]}>
            {formatCurrencyInteger(todayRevenue, currency)}
          </Text>
        </View>
        <View style={[cardStyles.todaySalesBadge, { backgroundColor: colors.primary + '12' }]}>
          <ShoppingCart size={14} color={colors.primary} />
          <Text style={[cardStyles.todaySalesText, { color: colors.primary }]}>
            {salesLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  monthlyRevenue: number;
  goalTarget: number | null;
  currency: string;
  now: Date;
}

/**
 * Carte objectif CA mensuel.
 * Affiche la progression, les jours restants et une projection dynamique.
 * Si aucun objectif n'est défini, affiche un bouton pour en créer un.
 */
export function GoalCard({ monthlyRevenue, goalTarget, currency, now }: GoalCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  if (!goalTarget) {
    return (
      <TouchableOpacity
        style={[cardStyles.goalEmptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderStyle: 'dashed' }]}
        onPress={() => router.push('/settings?tab=objectives' as never)}
        activeOpacity={0.7}
        testID="goal-define-btn"
      >
        <View style={[cardStyles.goalIconCircle, { backgroundColor: colors.primary + '12' }]}>
          <Target size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.goalEmptyTitle, { color: colors.text }]}>Objectif CA mensuel</Text>
          <Text style={[cardStyles.goalEmptySubtitle, { color: colors.textTertiary }]}>
            Définissez un objectif pour suivre votre progression
          </Text>
        </View>
        <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, color: colors.primary, fontWeight: TYPOGRAPHY.WEIGHT.BOLD }}>
          Définir →
        </Text>
      </TouchableOpacity>
    );
  }

  const goalProgress = Math.min(monthlyRevenue / goalTarget, 1.5);
  const goalProgressPct = Math.round(Math.min(goalProgress, 1) * 100);
  const goalDaysElapsed = now.getDate();
  const goalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const goalDaysRemaining = Math.max(0, goalDaysInMonth - goalDaysElapsed);
  const goalProjectedRevenue = goalDaysElapsed > 0 ? (monthlyRevenue / goalDaysElapsed) * goalDaysInMonth : 0;
  const goalIsAchieved = monthlyRevenue >= goalTarget;
  const goalDailyNeeded = goalTarget && goalDaysRemaining > 0 && !goalIsAchieved
    ? (goalTarget - monthlyRevenue) / goalDaysRemaining : 0;

  const goalStatusColor =
    goalIsAchieved ? '#059669'
    : goalProgress >= 0.7 ? colors.primary
    : goalProgress >= 0.4 ? '#F59E0B'
    : '#DC2626';

  const goalProjectionMessage = (() => {
    if (goalIsAchieved) return { text: 'Objectif atteint ! Continuez sur cette lancée.', positive: true };
    if (goalDaysElapsed === 0) return { text: 'Début du mois, revenez demain pour voir votre projection.', positive: false };
    if (goalDaysRemaining === 0) return { text: `Objectif non atteint — ${formatCurrencyInteger(goalTarget - monthlyRevenue, currency)} manquants.`, positive: false };
    if (goalProjectedRevenue >= goalTarget) {
      return { text: `À ce rythme, vous atteindrez ${formatCurrencyInteger(Math.round(goalProjectedRevenue), currency)} sur ${formatCurrencyInteger(goalTarget, currency)} visés.`, positive: true };
    }
    if (goalProjectedRevenue < goalTarget * 0.7) {
      return { text: `Attention : projection à ${formatCurrencyInteger(Math.round(goalProjectedRevenue), currency)} — il faut ${formatCurrencyInteger(Math.round(goalDailyNeeded), currency)}/jour pour atteindre l'objectif.`, positive: false };
    }
    return { text: `À ce rythme, vous atteindrez ${formatCurrencyInteger(Math.round(goalProjectedRevenue), currency)} sur ${formatCurrencyInteger(goalTarget, currency)} visés.`, positive: true };
  })();

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={cardStyles.cardHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.MD, flex: 1 }}>
          <View style={[cardStyles.goalIconCircle, { backgroundColor: goalStatusColor + '15' }]}>
            <Target size={15} color={goalStatusColor} strokeWidth={2.5} />
          </View>
          <Text style={[cardStyles.cardTitle, { color: colors.text }]}>Objectif CA mensuel</Text>
        </View>
        {goalIsAchieved && (
          <View style={[cardStyles.goalAchievedBadge, { backgroundColor: '#059669' + '15' }]}>
            <Text style={{ fontSize: TYPOGRAPHY.SIZE.TINY, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, color: '#059669' }}>Atteint !</Text>
          </View>
        )}
      </View>

      <View style={cardStyles.goalAmountRow}>
        <Text style={[cardStyles.goalCurrentAmount, { color: colors.text }]}>
          {formatCurrencyInteger(monthlyRevenue, currency)}
        </Text>
        <Text style={[cardStyles.goalSeparator, { color: colors.textTertiary }]}> / </Text>
        <Text style={[cardStyles.goalTargetAmount, { color: colors.textSecondary }]}>
          {formatCurrencyInteger(goalTarget, currency)}
        </Text>
      </View>

      <View style={cardStyles.goalProgressSection}>
        <View style={[cardStyles.goalProgressTrack, { backgroundColor: colors.borderLight }]}>
          <View style={[cardStyles.goalProgressFill, { width: `${goalProgressPct}%` as `${number}%`, backgroundColor: goalStatusColor }]} />
        </View>
        <View style={cardStyles.goalProgressLabels}>
          <Text style={[cardStyles.goalProgressPct, { color: goalStatusColor }]}>{goalProgressPct}%</Text>
          <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary }}>
            {goalDaysRemaining} jour{goalDaysRemaining > 1 ? 's' : ''} restant{goalDaysRemaining > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {goalProjectionMessage && (
        <View style={[cardStyles.goalProjectionBox, {
          backgroundColor: goalProjectionMessage.positive ? '#05966908' : '#F59E0B08',
          borderColor: goalProjectionMessage.positive ? '#05966920' : '#F59E0B20',
        }]}>
          <TrendingUp size={13} color={goalProjectionMessage.positive ? '#059669' : '#F59E0B'} />
          <Text style={[cardStyles.goalProjectionText, { color: goalProjectionMessage.positive ? '#059669' : '#D97706' }]}>
            {goalProjectionMessage.text}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={cardStyles.goalEditRow}
        onPress={() => router.push('/settings?tab=objectives' as never)}
        activeOpacity={0.7}
        testID="goal-edit-btn"
      >
        <Text style={{ fontSize: TYPOGRAPHY.SIZE.SMALL, color: colors.primary, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD }}>
          Modifier l'objectif
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── PriorityClientsCard ──────────────────────────────────────────────────────

interface PriorityClient {
  clientId: string;
  name: string;
  totalUnpaid: number;
  lastPurchaseDate: string;
  score: number;
}

interface PriorityClientsCardProps {
  alertClientsCount: number;
  priorityClientsToRemind: PriorityClient[];
  now: Date;
  currency: string;
  hasAlerts: boolean;
}

/**
 * Carte "Clients à relancer".
 * Affiche le top 3 clients prioritaires avec score de relance.
 * Masquée si aucun client impayé.
 */
export function PriorityClientsCard({
  alertClientsCount,
  priorityClientsToRemind,
  now,
  currency,
  hasAlerts,
}: PriorityClientsCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  if (alertClientsCount === 0 && !hasAlerts) return null;

  if (alertClientsCount === 0) {
    return (
      <View style={[cardStyles.card, { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.MD }}>
          <CheckCircle size={18} color="#38A169" />
          <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: '#38A169' }}>
            Tous vos clients sont à jour 🎉
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={cardStyles.cardHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.MD }}>
          <Mail size={16} color="#2563EB" />
          <Text style={[cardStyles.cardTitle, { color: colors.text }]}>Clients à relancer</Text>
        </View>
        <View style={[cardStyles.alertBadge, { backgroundColor: '#2563EB' }]}>
          <Text style={cardStyles.alertBadgeText}>{alertClientsCount}</Text>
        </View>
      </View>

      {priorityClientsToRemind.length === 0 ? (
        <Text style={{ fontSize: TYPOGRAPHY.SIZE.SMALL, color: colors.textTertiary, textAlign: 'center', paddingVertical: SPACING.XL }}>
          Aucun client prioritaire identifié
        </Text>
      ) : (
        <View style={{ gap: SPACING.SM }}>
          {priorityClientsToRemind.map((client, idx) => {
            const daysSinceLastPurchase = client.lastPurchaseDate
              ? Math.floor((now.getTime() - new Date(client.lastPurchaseDate).getTime()) / 86400000)
              : null;
            return (
              <View
                key={client.clientId + idx}
                style={[
                  cardStyles.priorityClientRow,
                  { borderColor: colors.borderLight },
                  idx < priorityClientsToRemind.length - 1 && { borderBottomWidth: 1 },
                ]}
              >
                <ClientAvatar name={client.name} size={36} />
                <View style={{ flex: 1, marginLeft: SPACING.LG }}>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: colors.text }} numberOfLines={1}>
                    {client.name}
                  </Text>
                  <Text style={{ fontSize: TYPOGRAPHY.SIZE.CAPTION, color: colors.textTertiary, marginTop: 1 }}>
                    {formatCurrencyInteger(client.totalUnpaid, currency)} impayés
                    {daysSinceLastPurchase !== null ? ` · Dernière commande il y a ${daysSinceLastPurchase}j` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[cardStyles.remindBtn, { backgroundColor: '#2563EB' }]}
                  onPress={() => router.push('/clients' as never)}
                  activeOpacity={0.7}
                >
                  <Send size={12} color="#fff" />
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>Relancer</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.push('/ventes?tab=factures' as never)}
        activeOpacity={0.7}
        style={{ marginTop: SPACING.LG }}
      >
        <Text style={{ fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, color: '#2563EB' }}>
          Voir tous les {alertClientsCount} →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles partagés ──────────────────────────────────────────────────────────

export const cardStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.XXXL },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.XL },
  cardTitle: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  todayBanner: { borderWidth: 1, borderRadius: RADIUS.XL, padding: SPACING.LG, position: 'relative', overflow: 'hidden' },
  todayAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: RADIUS.XL, borderBottomLeftRadius: RADIUS.XL },
  todayBannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayLabel: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.MEDIUM, marginBottom: SPACING.XXS },
  todayAmount: { fontSize: TYPOGRAPHY.SIZE.BODY_LARGE, fontWeight: TYPOGRAPHY.WEIGHT.BOLD, letterSpacing: -0.5 },
  todaySalesBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.MD, borderRadius: RADIUS.ROUND },
  todaySalesText: { fontSize: TYPOGRAPHY.SIZE.BODY_SMALL, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },

  goalIconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  goalAchievedBadge: { paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM, borderRadius: RADIUS.ROUND },
  goalAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.XS, marginBottom: SPACING.XL },
  goalCurrentAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  goalSeparator: { fontSize: 18, fontWeight: '400' },
  goalTargetAmount: { fontSize: 18, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  goalProgressSection: { gap: SPACING.SM, marginBottom: SPACING.XL },
  goalProgressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  goalProgressFill: { height: 8, borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  goalProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.XS },
  goalProgressPct: { fontSize: TYPOGRAPHY.SIZE.SMALL, fontWeight: TYPOGRAPHY.WEIGHT.BOLD },
  goalProjectionBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM, paddingHorizontal: SPACING.XL, paddingVertical: SPACING.LG, borderRadius: RADIUS.MD, borderWidth: 1 },
  goalProjectionText: { fontSize: TYPOGRAPHY.SIZE.CAPTION, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD, flex: 1 },
  goalEditRow: { alignSelf: 'flex-end', marginTop: SPACING.LG },
  goalEmptyCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.XL, borderWidth: 1.5, borderRadius: RADIUS.XL, padding: SPACING.XXXL },
  goalEmptyTitle: { fontSize: TYPOGRAPHY.SIZE.BODY, fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD },
  goalEmptySubtitle: { fontSize: TYPOGRAPHY.SIZE.SMALL, marginTop: 2 },

  alertBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  alertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  priorityClientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.LG },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.XS, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.MD, borderRadius: RADIUS.MD },
});