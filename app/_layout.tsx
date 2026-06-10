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
    const isUserLoggedIn = !!user;
    
    console.log('[AuthStateListener] DEBUG:', { 
      isReady, 
      isUserLoggedIn,
      userId: user?.id,
      error: error?.message || null,
      segments 
    });

    if (!isReady) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isUserLoggedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isUserLoggedIn && !inAuthGroup) {
      router.replace("/(auth)/login");
    }
  }, [user, isReady, segments, error]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Theme.colors.background, padding: 32 }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={{ marginTop: 24, color: Theme.colors.text, fontWeight: '800', fontSize: 20 }}>Syncing Identity</Text>
        <Text style={{ marginTop: 8, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
          Initializing SkillChain's secure Web3 layer...
        </Text>

        <View style={{ marginTop: 48, padding: 20, backgroundColor: '#F3F4F6', borderRadius: 16, width: '100%' }}>
          <Text style={{ color: '#4B5563', fontSize: 12, fontWeight: '700', marginBottom: 8 }}>DEBUG CONSOLE</Text>
          <Text style={{ color: '#6B7280', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
            SDK Ready: {String(isReady)}{"\n"}
            User Logged In: {String(!!user)}{"\n"}
            User ID: {user?.id ? `${user.id.substring(0, 12)}...` : 'None'}{"\n"}
            Segments: {JSON.stringify(segments)}{"\n"}
            Error: {error ? error.message : 'None'}
          </Text>
        </View>

        {!!user && (
          <TouchableOpacity 
            onPress={() => router.replace("/(tabs)")}
            style={{ marginTop: 24, backgroundColor: Theme.colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, width: '100%' }}
          >
            <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '700' }}>Force Enter Dashboard</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => logout()}
          style={{ marginTop: 12, padding: 10 }}
        >
          <Text style={{ color: Theme.colors.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
            Logout & Clear Session
          </Text>
        </TouchableOpacity>
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
        },
        solanaClusters: [{
          name: 'mainnet-beta',
          endpoint: 'https://api.mainnet-beta.solana.com'
        }],
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

