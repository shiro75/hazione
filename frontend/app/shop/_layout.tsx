/**
 * @fileoverview Layout for the public shop routes (app/shop/*).
 * This is a top-level route registered in app/_layout.tsx as "shop".
 * It wraps the public storefront pages (e.g. /shop/[slug]) with a headerless Stack.
 * These routes are accessible WITHOUT authentication (see auth guard in app/_layout.tsx).
 */
import { Stack } from 'expo-router';

export default function ShopLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
