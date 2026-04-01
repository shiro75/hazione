import React, { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { getRolePermissions, canAccessModule, canAccessRoute } from '@/constants/permissions';
import type { UserRole, ModuleKey } from '@/types';
import type { RolePermissions } from '@/constants/permissions';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
}

interface RoleState {
  currentUserRole: UserRole;
  permissions: RolePermissions;
  teamMembers: TeamMember[];
  setCurrentUserRole: (role: UserRole) => void;
  updateMemberRole: (memberId: string, role: UserRole) => void;
  addTeamMember: (member: Omit<TeamMember, 'id'>) => void;
  removeTeamMember: (memberId: string) => void;
  canAccess: (moduleKey: ModuleKey) => boolean;
  canAccessPath: (route: string) => boolean;
  canSeePurchasePrice: boolean;
  canSeeMargin: boolean;
  canEditData: boolean;
  canExportReports: boolean;
  canDeleteCompany: boolean;
  canManageSubscription: boolean;
  canManageEmployees: boolean;
  simplifiedDashboard: boolean;
}

export const [RoleProvider, useRole] = createContextHook((): RoleState => {
  const { user } = useAuth();
  const [currentUserRole, setCurrentUserRoleState] = useState<UserRole>('admin');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const userId = user?.id ?? 'anonymous';

  useEffect(() => {
    AsyncStorage.getItem(`user-role-${userId}`).then((stored) => {
      if (stored && (stored === 'admin' || stored === 'manager' || stored === 'employee' || stored === 'accountant')) {
        setCurrentUserRoleState(stored as UserRole);
      }
    }).catch(() => {});

    AsyncStorage.getItem(`team-members-${userId}`).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as TeamMember[];
          setTeamMembers(parsed);
        } catch {}
      }
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (user) {
      setTeamMembers((prev) => {
        if (prev.length > 0) return prev;
        const currentMember: TeamMember = {
          id: user.id,
          firstName: user.user_metadata?.full_name?.split(' ')[0] ?? 'Utilisateur',
          lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') ?? '',
          email: user.email ?? '',
          role: currentUserRole,
          isActive: true,
          lastLoginAt: new Date().toISOString(),
        };
        return [currentMember];
      });
    }
  }, [user, currentUserRole]);

  const setCurrentUserRole = useCallback((role: UserRole) => {
    setCurrentUserRoleState(role);
    void AsyncStorage.setItem(`user-role-${userId}`, role);
    setTeamMembers((prev) => {
      const updated = prev.map((m) => m.id === userId ? { ...m, role } : m);
      void AsyncStorage.setItem(`team-members-${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const updateMemberRole = useCallback((memberId: string, role: UserRole) => {
    setTeamMembers((prev) => {
      const updated = prev.map((m) => m.id === memberId ? { ...m, role } : m);
      void AsyncStorage.setItem(`team-members-${userId}`, JSON.stringify(updated));
      return updated;
    });
    if (memberId === userId) {
      setCurrentUserRoleState(role);
      void AsyncStorage.setItem(`user-role-${userId}`, role);
    }
  }, [userId]);

  const addTeamMember = useCallback((member: Omit<TeamMember, 'id'>) => {
    const newMember: TeamMember = {
      ...member,
      id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
    setTeamMembers((prev) => {
      const updated = [...prev, newMember];
      void AsyncStorage.setItem(`team-members-${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const removeTeamMember = useCallback((memberId: string) => {
    if (memberId === userId) return;
    setTeamMembers((prev) => {
      const updated = prev.filter((m) => m.id !== memberId);
      void AsyncStorage.setItem(`team-members-${userId}`, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const permissions = useMemo(() => getRolePermissions(currentUserRole), [currentUserRole]);

  const canAccess = useCallback((moduleKey: ModuleKey) => {
    return canAccessModule(currentUserRole, moduleKey);
  }, [currentUserRole]);

  const canAccessPath = useCallback((route: string) => {
    return canAccessRoute(currentUserRole, route);
  }, [currentUserRole]);

  return useMemo(() => ({
    currentUserRole,
    permissions,
    teamMembers,
    setCurrentUserRole,
    updateMemberRole,
    addTeamMember,
    removeTeamMember,
    canAccess,
    canAccessPath,
    canSeePurchasePrice: permissions.canSeePurchasePrice,
    canSeeMargin: permissions.canSeeMargin,
    canEditData: permissions.canEditData,
    canExportReports: permissions.canExportReports,
    canDeleteCompany: permissions.canDeleteCompany,
    canManageSubscription: permissions.canManageSubscription,
    canManageEmployees: permissions.canManageEmployees,
    simplifiedDashboard: permissions.simplifiedDashboard,
  }), [currentUserRole, permissions, teamMembers, setCurrentUserRole, updateMemberRole, addTeamMember, removeTeamMember, canAccess, canAccessPath]);
});
