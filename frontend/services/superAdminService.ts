/**
 * superAdminService.ts
 * Service layer for super admin operations: license management, user administration,
 * and platform-wide statistics. All operations require super admin privileges.
 *
 * Relies on Supabase RPC `check_is_super_admin()` for authorization.
 * Falls back to AsyncStorage when Supabase is not configured (dev mode).
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { PLANS, type PlanId } from '@/config/plans';

export interface LicenseUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  assigned_at: string;
}

export interface AdminLicense {
  id: string;
  code: string;
  plan: PlanId;
  duration: 'lifetime' | '1year' | '1month';
  status: 'active' | 'used' | 'expired' | 'revoked';
  max_users: number;
  used_by: string | null;
  used_by_email: string | null;
  used_by_company: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  attached_users: LicenseUser[];
  attached_users_count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  plan: PlanId;
  status: string;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AdminStats {
  totalUsers: number;
  planDistribution: Record<PlanId, number>;
  activeTrials: number;
  estimatedRevenue: number;
  recentSignups: { date: string; count: number }[];
}

function generateLicenseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `GESTIO-${segment()}-${segment()}-${segment()}`;
}

/**
 * Checks whether the current authenticated user has super admin privileges.
 * Uses Supabase RPC when available, falls back to local storage in dev mode.
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }
  if (!isSupabaseConfigured) {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const stored = await AsyncStorage.getItem(`@hazione_super_admin_${userId}`);
      if (stored === 'true') return true;
    } catch {}
    return false;
  }
  try {
    const { data, error } = await supabase.rpc('check_is_super_admin');
    if (error) {
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

export async function logAdminAccess(userId: string, action: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('admin_logs').insert({
      user_id: userId,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch {}
}

function computeExpiresAt(createdAt: string, duration: 'lifetime' | '1year' | '1month'): string | null {
  if (duration === 'lifetime') return null;
  const d = new Date(createdAt);
  if (duration === '1year') d.setFullYear(d.getFullYear() + 1);
  else if (duration === '1month') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function computeLicenseStatus(lic: { status?: string; used_by?: string | null; expires_at?: string | null }): 'active' | 'used' | 'expired' | 'revoked' {
  if (lic.status === 'revoked') return 'revoked';
  if (lic.used_by) return 'used';
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) return 'expired';
  return 'active';
}

/**
 * Fetches all licenses with their associated users and owner profiles.
 * Joins license_users, profiles, and companies tables for complete data.
 */
export async function fetchLicenses(): Promise<AdminLicense[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { return []; }

    const licenseIds = (data ?? []).map((l: { id: string }) => l.id);
    const licenseUsersMap = new Map<string, LicenseUser[]>();

    const usedByIds = (data ?? [])
      .map((l: { used_by?: string | null }) => l.used_by)
      .filter((id): id is string => !!id);
    const allUserIdsForProfiles = new Set<string>(usedByIds);

    if (licenseIds.length > 0) {
      const { data: luData } = await supabase
        .from('license_users')
        .select('id, license_id, user_id, assigned_at')
        .in('license_id', licenseIds);

      if (luData && luData.length > 0) {
        (luData as { user_id: string }[]).forEach(lu => allUserIdsForProfiles.add(lu.user_id));
      }

      const allIds = [...allUserIdsForProfiles];
      const profileMap = new Map<string, { email: string; full_name: string }>();
      const companyMap = new Map<string, string>();

      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', allIds);
        (profiles ?? []).forEach((p: { id: string; email: string; full_name: string }) => {
          profileMap.set(p.id, { email: p.email ?? '', full_name: p.full_name ?? '' });
        });

        const { data: companies } = await supabase
          .from('companies')
          .select('owner_id, name')
          .in('owner_id', allIds);
        (companies ?? []).forEach((c: { owner_id: string; name: string }) => {
          if (c.name) companyMap.set(c.owner_id, c.name);
        });
      }

      if (luData && luData.length > 0) {
        (luData as { id: string; license_id: string; user_id: string; assigned_at: string }[]).forEach(lu => {
          const profile = profileMap.get(lu.user_id);
          const entry: LicenseUser = {
            id: lu.id,
            user_id: lu.user_id,
            email: profile?.email ?? '',
            full_name: profile?.full_name ?? '',
            assigned_at: lu.assigned_at,
          };
          const arr = licenseUsersMap.get(lu.license_id) ?? [];
          arr.push(entry);
          licenseUsersMap.set(lu.license_id, arr);
        });
      }

      const usedByProfileMap = profileMap;
      const usedByCompanyMap = companyMap;

      return (data ?? []).map((lic: Record<string, unknown>) => {
        const attached = licenseUsersMap.get(lic.id as string) ?? [];
        const usedById = lic.used_by as string | null;
        const usedByProfile = usedById ? usedByProfileMap.get(usedById) : null;
        const usedByCompany = usedById ? usedByCompanyMap.get(usedById) : null;
        return {
          id: lic.id as string,
          code: lic.code as string,
          plan: (lic.plan ?? 'solo') as PlanId,
          duration: (lic.duration ?? '1year') as 'lifetime' | '1year' | '1month',
          status: computeLicenseStatus({ status: lic.status as string | undefined, used_by: usedById, expires_at: lic.expires_at as string | null }),
          max_users: (lic.max_users as number) ?? 1,
          used_by: usedById,
          used_by_email: usedByProfile?.email ?? null,
          used_by_company: usedByCompany ?? null,
          activated_at: lic.activated_at as string | null,
          expires_at: (lic.expires_at as string | null) ?? null,
          created_at: lic.created_at as string,
          attached_users: attached,
          attached_users_count: attached.length,
        };
      });
    }
    return [];
  } catch { return []; }
}

/**
 * Creates a new license key with the specified plan, duration, and max users.
 * Returns the created license or null on failure.
 */
export async function createLicense(plan: PlanId, duration: 'lifetime' | '1year' | '1month', maxUsers: number = 1): Promise<AdminLicense | null> {
  const code = generateLicenseCode();
  const now = new Date().toISOString();
  const expiresAt = computeExpiresAt(now, duration);

  if (!isSupabaseConfigured) {
    return {
      id: `lic_${Date.now()}`,
      code,
      plan,
      duration,
      status: 'active',
      max_users: maxUsers,
      used_by: null,
      used_by_email: null,
      used_by_company: null,
      activated_at: null,
      expires_at: expiresAt,
      created_at: now,
      attached_users: [],
      attached_users_count: 0,
    };
  }
  try {
    const { data, error } = await supabase
      .from('licenses')
      .insert({
        code,
        plan,
        duration,
        status: 'active',
        max_users: maxUsers,
        expires_at: expiresAt,
        created_at: now,
      })
      .select()
      .single();
    if (error) {
      return null;
    }
    return {
      id: (data as { id: string }).id,
      code: (data as { code: string }).code,
      plan: (data as { plan: PlanId }).plan,
      duration: (data as { duration: 'lifetime' | '1year' | '1month' }).duration,
      status: 'active' as const,
      max_users: maxUsers,
      used_by: null,
      used_by_email: null,
      used_by_company: null,
      activated_at: null,
      expires_at: expiresAt,
      created_at: now,
      attached_users: [],
      attached_users_count: 0,
    };
  } catch { return null; }
}

export async function revokeLicense(licenseId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { error } = await supabase
      .from('licenses')
      .update({ status: 'revoked' })
      .eq('id', licenseId);
    if (error) { return false; }
    return true;
  } catch { return false; }
}

export async function deleteLicense(licenseId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    await supabase.from('license_users').delete().eq('license_id', licenseId);
    const { error } = await supabase.from('licenses').delete().eq('id', licenseId);
    if (error) { return false; }
    return true;
  } catch { return false; }
}

export async function removeLicenseUser(licenseUserId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { error } = await supabase.from('license_users').delete().eq('id', licenseUserId);
    if (error) { return false; }
    return true;
  } catch { return false; }
}

/**
 * Fetches all platform users with their subscription info.
 * Joins profiles and subscriptions tables.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, created_at, last_sign_in_at')
      .order('created_at', { ascending: false });
    if (profErr || !profiles) {
      return [];
    }

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('user_id, plan, status');

    const subsMap = new Map<string, { plan: PlanId; status: string }>();
    (subs ?? []).forEach((s: { user_id: string; plan: string; status: string }) => {
      subsMap.set(s.user_id, { plan: s.plan as PlanId, status: s.status });
    });

    return profiles.map((p: { id: string; email: string; full_name: string; is_active: boolean; created_at: string; last_sign_in_at: string | null }) => {
      const sub = subsMap.get(p.id);
      return {
        id: p.id,
        email: p.email ?? '',
        full_name: p.full_name ?? '',
        plan: sub?.plan ?? 'solo',
        status: sub?.status ?? 'trial',
        is_active: p.is_active ?? true,
        created_at: p.created_at,
        last_sign_in_at: p.last_sign_in_at,
      };
    });
  } catch { return []; }
}

export async function updateUserPlan(userId: string, plan: PlanId): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { error } = await supabase
      .from('subscriptions')
      .upsert({ user_id: userId, plan, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return !error;
  } catch { return false; }
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId);
    return !error;
  } catch { return false; }
}

/**
 * Fetches platform-wide statistics: total users, plan distribution,
 * active trials, estimated monthly revenue, and recent signups.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  const empty: AdminStats = { totalUsers: 0, planDistribution: { solo: 0, pro: 0, business: 0 }, activeTrials: 0, estimatedRevenue: 0, recentSignups: [] };
  if (!isSupabaseConfigured) return empty;
  try {
    const { data: profiles } = await supabase.from('profiles').select('id, created_at');
    const { data: subs } = await supabase.from('subscriptions').select('user_id, plan, status');

    const totalUsers = profiles?.length ?? 0;
    const planDist: Record<PlanId, number> = { solo: 0, pro: 0, business: 0 };
    let activeTrials = 0;
    let estimatedRevenue = 0;

    (subs ?? []).forEach((s: { plan: string; status: string }) => {
      const p = s.plan as PlanId;
      if (planDist[p] !== undefined) planDist[p]++;
      if (s.status === 'trial') activeTrials++;
      if (s.status === 'active' && PLANS[p]) {
        estimatedRevenue += PLANS[p].monthlyPrice;
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMap = new Map<string, number>();
    (profiles ?? []).forEach((p: { created_at: string }) => {
      const d = new Date(p.created_at);
      if (d >= thirtyDaysAgo) {
        const key = d.toISOString().split('T')[0];
        recentMap.set(key, (recentMap.get(key) ?? 0) + 1);
      }
    });
    const recentSignups = Array.from(recentMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalUsers, planDistribution: planDist, activeTrials, estimatedRevenue, recentSignups };
  } catch { return empty; }
}
