import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Theme } from "@/constants/theme";
import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrivyProvider, usePrivy } from '@privy-io/expo';

function AuthStateListener() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isReady, error, logout, createWallet } = usePrivy();

  useEffect(() => {
    const isUserLoggedIn = !!user;
    const inAuthGroup = segments[0] === "(auth)";
    const atRoot = segments.length === 0;
    
    console.log('[AuthStateListener] Nav Logic:', { 
      isReady, 
      isUserLoggedIn, 
      inAuthGroup, 
      atRoot, 
      error: error?.message || null,
      segments 
    });

    if (!isReady) return;

    // AUTO-CREATE WALLETS LOGIC
    // Privy docs state auto-creation doesn't work for direct login (loginWithCode)
    // So we handle it here manually once the user is ready
    if (isUserLoggedIn && user.linkedAccounts) {
      const hasSolana = user.linkedAccounts.some(a => (a as any).chainType === 'solana');
      const hasEthereum = user.linkedAccounts.some(a => (a as any).chainType === 'ethereum');

      if (!hasSolana) {
        console.log('[AuthStateListener] Auto-creating Solana wallet...');
        createWallet({ chainType: 'solana' }).catch(e => console.warn('Auto-wallet (SOL) failed:', e));
      }
      if (!hasEthereum) {
        console.log('[AuthStateListener] Auto-creating Ethereum wallet...');
        createWallet({ chainType: 'ethereum' }).catch(e => console.warn('Auto-wallet (ETH) failed:', e));
      }
    }

    if (isUserLoggedIn) {
      if (atRoot || inAuthGroup) {
        console.log('[AuthStateListener] Redirecting to (tabs)');
        router.replace("/(tabs)");
      }
    } else {
      if (!inAuthGroup) {
        console.log('[AuthStateListener] Redirecting to (auth)/login');
        router.replace("/(auth)/login");
      }
    }
  }, [user, isReady, segments, error]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Theme.colors.background, padding: 32 }}>
        <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 32 }}>
          <Ionicons name="flash" size={50} color={Theme.colors.primary} />
        </View>
        
        <ActivityIndicator size="small" color={Theme.colors.primary} />
        <Text style={{ marginTop: 24, color: Theme.colors.text, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 }}>SkillChain</Text>
        <Text style={{ marginTop: 8, color: Theme.colors.textMuted, textAlign: 'center', fontWeight: '500' }}>
          Securely syncing your workspace...
        </Text>

        <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', gap: 12, paddingHorizontal: 32 }}>
          {!!user && (
            <TouchableOpacity 
              onPress={() => router.replace("/(tabs)")}
              style={{ backgroundColor: '#111827', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, width: '100%', marginBottom: 8 }}
            >
              <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '800' }}>Manual Enter Dashboard</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => logout()} style={{ padding: 10 }}>
            <Text style={{ color: Theme.colors.primary, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
              Reset Session
            </Text>
          </TouchableOpacity>

          <Text style={{ color: '#D1D5DB', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 8 }}>
            SDK_READY: {String(isReady)} • AUTH: {!!user ? 'YES' : 'NO'}
          </Text>
        </View>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || process.env.APP_ID || "";
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || process.env.CLIENT_ID || "";

  if (!appId || !clientId) {
    console.error('[RootLayout] Privy App ID or Client ID is MISSING from .env');
  }

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
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          solana: {
            createOnLogin: 'users-without-wallets',
          },
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

