import { Theme } from "@/constants/Theme";
import { Ionicons } from "@expo/vector-icons";
import { PrivyProvider, useEmbeddedEthereumWallet, useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { supabase } from '@/constants/Supabase';

function AuthStateListener() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isReady, error, logout } = usePrivy();
  const solanaWallet = useEmbeddedSolanaWallet();
  const ethereumWallet = useEmbeddedEthereumWallet();

  useEffect(() => {
    const syncProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profile')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[AuthStateListener] Error checking profile:', error);
          return;
        }

        if (!data) {
          console.log('[AuthStateListener] Profile not found. Creating default profile...');
          const emailAccount = user.linked_accounts?.find((acc: any) => acc.type === 'email' || acc.email);
          const emailAddress = emailAccount?.address || emailAccount?.email || user.email || '';
          const fullName = emailAddress ? emailAddress.split('@')[0] : 'SkillChain User';
          
          const newProfile = {
            id: user.id,
            email: emailAddress,
            full_name: fullName,
            skills: [],
            work_experience: [],
            education: [],
            certifications: [],
            solana_address: null,
            ethereum_address: null,
          };

          const { error: insertError } = await supabase
            .from('profile')
            .insert(newProfile);

          if (insertError) {
            console.error('[AuthStateListener] Error creating default profile:', insertError);
          } else {
            console.log('[AuthStateListener] Default profile created successfully');
          }
        }
      } catch (profileErr) {
        console.error('[AuthStateListener] Profile sync exception:', profileErr);
      }
    };

    if (isReady && user) {
      syncProfile();
    }
  }, [user, isReady]);

  useEffect(() => {
    const isUserLoggedIn = !!user;
    const inAuthGroup = segments[0] === "(auth)";
    const atRoot = (segments as string[]).length === 0;
    
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
    if (isUserLoggedIn) {
      const accounts = user.linked_accounts || [];
      const hasSolana = accounts.some((a: any) => a.chain_type === 'solana' && a.wallet_client_type === 'privy');
      const hasEthereum = accounts.some((a: any) => a.chain_type === 'ethereum' && a.wallet_client_type === 'privy');

      if (!hasSolana) {
        console.log('[AuthStateListener] Auto-creating Solana wallet...');
        solanaWallet.create!()
          .then(() => console.log('[AuthStateListener] Solana wallet created successfully'))
          .catch((e: any) => {
            if (!e.message.includes('already exists')) {
              console.warn('Auto-wallet (SOL) failed:', e.message);
            }
          });
      }
      
      if (!hasEthereum) {
        console.log('[AuthStateListener] Auto-creating Ethereum wallet...');
        ethereumWallet.create()
          .then(() => console.log('[AuthStateListener] Ethereum wallet created successfully'))
          .catch((e: any) => {
            if (!e.message.includes('already exists')) {
              console.warn('Auto-wallet (ETH) failed:', e.message);
            }
          });
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
        <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <Image source={require('../assets/images/img.png')} style={{ width: '100%', height: '100%', borderRadius: 30 }} resizeMode="contain" />
        </View>
        
        <ActivityIndicator size="small" color={Theme.colors.primary} />
        <Text style={{ marginTop: 24, color: Theme.colors.text, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 }}>SkillChain</Text>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || process.env.APP_ID || "";
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || process.env.CLIENT_ID || "";
  const isWeb = Platform.OS === 'web';

  if (!appId || !clientId) {
    console.error('[RootLayout] Privy App ID or Client ID is MISSING from .env');
  }

  console.log('[RootLayout] Initializing with:', { 
    appId: appId ? `${appId.substring(0, 5)}...` : 'MISSING', 
    clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
    platform: Platform.OS,
    isWeb 
  });

  // Privy doesn't work well in Expo Web without additional setup
  // Use only on native platforms
  if (isWeb) {
    return (
      <>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Theme.colors.background },
          }}
        />
      </>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        appearance: {
          theme: 'light',
          accentColor: '#6366f1',
        },
      } as any}
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

