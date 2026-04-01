import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { DataProvider } from "@/contexts/DataContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { BankingProvider } from "@/contexts/BankingContext";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="landing" options={{ headerShown: false }} />
      <Stack.Screen name="shop" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="super-admin" options={{ headerShown: false, presentation: "modal" }} />

      <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
    </Stack>
  );
}

function GestureWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  const { GestureHandlerRootView } = require('react-native-gesture-handler');
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <RoleProvider>
              <OfflineProvider>
                <SubscriptionProvider>
                  <BankingProvider>
                    {children}
                  </BankingProvider>
                </SubscriptionProvider>
              </OfflineProvider>
            </RoleProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default function RootLayout() {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      void SplashScreen.hideAsync();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureWrapper>
        <AppProviders>
          <RootLayoutNav />
        </AppProviders>
      </GestureWrapper>
    </QueryClientProvider>
  );
}
