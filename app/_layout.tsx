import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Theme } from "@/constants/theme";
import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
import { PrivyProvider, usePrivy } from '@privy-io/expo';

function AuthStateListener() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isReady, error, logout } = usePrivy();

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const isUserLoggedIn = !!user;

    console.log('[AuthStateListener] Nav Logic:', { isUserLoggedIn, inAuthGroup, inTabsGroup, segments });

    // Use a small delay to ensure the router state is synchronized
    const timeout = setTimeout(() => {
      if (isUserLoggedIn) {
        if (!inTabsGroup) {
          console.log('[AuthStateListener] Redirecting logged-in user to (tabs)');
          router.replace("/(tabs)");
        }
      } else {
        if (!inAuthGroup) {
          console.log('[AuthStateListener] Redirecting guest to (auth)/login');
          router.replace("/(auth)/login");
        }
      }
    }, 10);

    return () => clearTimeout(timeout);
  }, [user, isReady, segments]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={{ marginTop: 16, color: Theme.colors.textMuted, fontWeight: '600' }}>Initializing SkillChain...</Text>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || process.env.APP_ID || "";
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || process.env.CLIENT_ID || "";

  console.log('[RootLayout] Initializing with:', { 
    appId: appId ? `${appId.substring(0, 5)}...` : 'MISSING', 
    clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING' 
  });

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: Theme.colors.primary,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        }
      }}
    >
      <StatusBar style="light" />
      <AuthStateListener />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Theme.colors.background },
        }}
      />
    </PrivyProvider>
  );
}

