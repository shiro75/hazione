/**
 * @fileoverview Mobile slide-in navigation menu context.
 * Tracks open/closed state of the mobile sidebar drawer.
 * Used by (app)/_layout.tsx to show/hide the navigation modal on small screens.
 */
import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export const [MobileMenuProvider, useMobileMenu] = createContextHook(() => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  return useMemo(() => ({ mobileMenuOpen, openMenu, closeMenu }), [mobileMenuOpen, openMenu, closeMenu]);
});
