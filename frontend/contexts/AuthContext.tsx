/**
 * @fileoverview Authentication context provider.
 * Manages Supabase auth session, sign-in/sign-up/sign-out flows,
 * password reset, and account deletion. Exposes useAuth() hook.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { supabase, getRedirectUrl, isSupabaseConfigured } from '@/services/supabase';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasElevatedAccess: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, extra?: { companyName?: string; sector?: string; siret?: string; address?: string; postalCode?: string; city?: string; country?: string; phone?: string; plan?: string }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>;
}

async function checkElevated(uid: string): Promise<boolean> {
  if (!uid || !isSupabaseConfigured) return false;
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

export const [AuthProvider, useAuth] = createContextHook((): AuthState => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasElevatedAccess, setHasElevatedAccess] = useState<boolean>(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) {
        checkElevated(s.user.id).then(setHasElevatedAccess).catch(() => setHasElevatedAccess(false)).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        checkElevated(s.user.id).then(setHasElevatedAccess).catch(() => setHasElevatedAccess(false));
      } else {
        setHasElevatedAccess(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) return { success: false, error: 'La connexion à la base de données n\'est pas configurée.' };
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Email ou mot de passe incorrect' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'Veuillez confirmer votre email avant de vous connecter' };
        }
        return { success: false, error: error.message };
      }

      if (signInData?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('id', signInData.user.id)
          .single();

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          return { success: false, error: 'Ce compte a été désactivé. Contactez le support pour plus d\'informations.' };
        }
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Erreur de connexion. Vérifiez votre connexion internet.' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string, extra?: { companyName?: string; sector?: string; siret?: string; address?: string; postalCode?: string; city?: string; country?: string; phone?: string; plan?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) return { success: false, error: 'La connexion à la base de données n\'est pas configurée.' };
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: extra?.companyName || '',
            sector: extra?.sector || '',
            siret: extra?.siret || '',
            address: extra?.address || '',
            postal_code: extra?.postalCode || '',
            city: extra?.city || '',
            country: extra?.country || 'France',
            phone: extra?.phone || '',
            plan: extra?.plan || 'solo',
          },
          emailRedirectTo: getRedirectUrl(),
        },
      });
      if (error) {
        if (error.message.includes('already registered')) {
          return { success: false, error: 'Un compte existe déjà avec cet email' };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur lors de l\'inscription. Vérifiez votre connexion internet.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setHasElevatedAccess(false);
      setSession(null);
      queryClient.clear();
      await supabase.auth.signOut({ scope: 'global' });
      const allKeys = await AsyncStorage.getAllKeys();
      const sessionKeys = allKeys.filter(k =>
        k.startsWith('sb-') ||
        k.startsWith('supabase') ||
        k.includes('auth-token') ||
        k.includes('session')
      );
      if (sessionKeys.length > 0) {
        await AsyncStorage.multiRemove(sessionKeys);
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
        } catch {}
      }
    } catch {
      setSession(null);
    }
  }, [queryClient]);

  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur lors de l\'envoi du lien de réinitialisation' };
    }
  }, []);

  const deleteAccount = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) return { success: false, error: 'La connexion à la base de données n\'est pas configurée.' };
    if (!password) return { success: false, error: 'Le mot de passe est requis.' };
    try {
      const currentEmail = session?.user?.email;
      const userId = session?.user?.id;
      if (!currentEmail || !userId) return { success: false, error: 'Impossible de vérifier l\'identité de l\'utilisateur.' };

      console.log('deleteAccount: verifying password for user', userId);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Mot de passe incorrect.' };
        }
        return { success: false, error: signInError.message };
      }
      console.log('deleteAccount: password verified successfully');

      const companyId = userId;

      const tablesToClean = [
        'product_recipes', 'product_variants', 'stock_movements', 'delivery_notes',
        'reminder_logs', 'email_send_logs', 'audit_logs', 'cash_movements',
        'shop_order_items', 'shop_orders', 'shops',
        'sales', 'invoices', 'supplier_invoices', 'purchase_orders',
        'products', 'clients', 'suppliers', 'categories', 'brands',
        'quotes', 'payments', 'payment_transactions',
        'employees', 'employee_schedules', 'payslips', 'expenses',
      ];
      for (const table of tablesToClean) {
        try {
          const { error: delErr } = await supabase.from(table).delete().eq('company_id', companyId);
          if (delErr) {
            console.log(`deleteAccount: clean ${table} error:`, delErr.message);
          } else {
            console.log(`deleteAccount: cleaned table ${table}`);
          }
        } catch (e) {
          console.log(`deleteAccount: failed to clean table ${table}:`, e);
        }
      }

      try {
        const { error: companyDelErr } = await supabase.from('companies').delete().eq('id', companyId);
        if (companyDelErr) {
          console.log('deleteAccount: failed to delete company:', companyDelErr.message);
        } else {
          console.log('deleteAccount: company deleted');
        }
      } catch (e) {
        console.log('deleteAccount: company deletion error:', e);
      }

      console.log('deleteAccount: calling delete_user_account RPC...');
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) {
        console.log('deleteAccount: RPC delete_user_account failed:', rpcError.message);
        console.log('deleteAccount: falling back to profile deactivation');
        const { error: deactivateError } = await supabase
          .from('profiles')
          .update({
            is_active: false,
            full_name: '[Compte supprimé]',
            email: `deleted_${Date.now()}@removed.local`,
          })
          .eq('id', userId);
        if (deactivateError) {
          console.log('deleteAccount: deactivation also failed:', deactivateError.message);
          return { success: false, error: 'Impossible de supprimer le compte. La fonction delete_user_account() n\'est peut-être pas déployée dans Supabase. Exécutez le fichier supabase-schema.sql dans l\'éditeur SQL de votre projet Supabase.' };
        }
      } else {
        console.log('deleteAccount: RPC delete_user_account succeeded — user removed from auth.users');
      }

      queryClient.clear();
      const allKeys = await AsyncStorage.getAllKeys();
      if (allKeys.length > 0) {
        await AsyncStorage.multiRemove(allKeys);
      }

      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch {}

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
        } catch {}
      }

      setSession(null);
      setHasElevatedAccess(false);
      return { success: true };
    } catch (err) {
      console.log('deleteAccount error:', err);
      return { success: false, error: 'Erreur lors de la suppression du compte. Veuillez réessayer.' };
    }
  }, [session, queryClient]);

  return useMemo(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: !!session,
    hasElevatedAccess,
    signIn,
    signUp,
    signOut,
    resetPassword,
    deleteAccount,
  }), [session, isLoading, hasElevatedAccess, signIn, signUp, signOut, resetPassword, deleteAccount]);
});
