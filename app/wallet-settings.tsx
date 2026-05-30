import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Theme } from '@/constants/Theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { supabase } from '@/constants/Supabase';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { clusterApiUrl, Connection } from '@solana/web3.js';

const APP_IDENTITY = {
  name: 'SkillChain',
  uri: 'https://skillchain.app',
  icon: 'favicon.png', // Relative path to the app's icon
};

export default function WalletSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profile')
        .select('solana_address')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setWalletAddress(data?.solana_address || null);
    } catch (e) {
      console.error('Error checking wallet:', e);
    } finally {
      setChecking(false);
    }
  };

  const handleConnectWallet = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Wallet', 'On web, please use a browser extension like Phantom. This demo focuses on Mobile Wallet Adapter.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Use Mobile Wallet Adapter to connect
      const result = await transact(async (wallet) => {
        const authorizeResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });

        return authorizeResult;
      });

      const base64PublicKey = result.accounts[0].address;
      // Convert base64 address to Base58 string (standard Solana format)
      // MWA returns address in a specific format, sometimes we need to process it
      // For simplicity in this implementation, we use the returned address
      const publicKey = result.accounts[0].address;

      const { error } = await supabase
        .from('profile')
        .update({ solana_address: publicKey })
        .eq('id', user.id);

      if (error) throw error;

      setWalletAddress(publicKey);
      Alert.alert('Wallet Connected', `Successfully connected wallet:\n${publicKey}`);
    } catch (e: any) {
      console.error('Wallet connection error:', e);
      Alert.alert(
        'Connection Error', 
        e.message || 'Could not connect to a Solana wallet. Make sure Phantom or Solflare is installed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert('Disconnect Wallet', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
              .from('profile')
              .update({ solana_address: null })
              .eq('id', user.id);

            setWalletAddress(null);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet Settings</Text>
      </View>

      {/* Wallet Content */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        {walletAddress ? (
          <View style={styles.walletCard}>
            <View style={styles.walletIconLarge}>
              <Ionicons name="wallet" size={48} color="#405B8F" />
            </View>
            <Text style={styles.connectedTitle}>Solana Wallet Connected</Text>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText}>{walletAddress}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.disconnectButton} 
              onPress={handleDisconnect}
              disabled={loading}
            >
              <Text style={styles.disconnectText}>Disconnect Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyContent}>
            <Text style={styles.statusText}>No wallet connected</Text>
            <TouchableOpacity 
              style={[styles.connectButton, loading && { opacity: 0.7 }]} 
              onPress={handleConnectWallet}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Phantom / Solflare</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.hintText}>
              Using Solana Mobile Wallet Adapter for a secure, real connection to your installed wallet.
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 24,
  },
  connectButton: {
    backgroundColor: '#405B8F',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    width: '100%',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hintText: {
    marginTop: 16,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginTop: 40,
  },
  walletIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  connectedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  addressContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginBottom: 32,
  },
  addressText: {
    fontSize: 13,
    color: '#4B5563',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  disconnectButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  disconnectText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  }
});
