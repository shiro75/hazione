/**
 * @fileoverview Authentication context provider.
 * Manages Supabase auth session, sign-in/sign-up/sign-out flows,
 * password reset, and account deletion. Exposes useAuth() hook.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { supabase, getRedirectUrl, isSupabaseConfigured } from '@/services/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Email ou mot de passe incorrect' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'Veuillez confirmer votre email avant de vous connecter' };
        }
        return { success: false, error: error.message };
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
      await supabase.auth.signOut();
      router.replace('/landing');
    } catch {
    }
  }, []);

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
      if (!currentEmail) return { success: false, error: 'Impossible de vérifier l\'identité de l\'utilisateur.' };
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Mot de passe incorrect.' };
        }
        return { success: false, error: signInError.message };
      }
      const { error } = await supabase.rpc('delete_user_account');
      if (error) {
        return { success: false, error: error.message };
      }
      setSession(null);
      return { success: true };
    } catch {
      return { success: false, error: 'Erreur lors de la suppression du compte.' };
    }
  }, [session]);

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
