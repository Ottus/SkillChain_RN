import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { Theme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/constants/Supabase';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { usePrivy } from '@privy-io/expo';

const APP_IDENTITY = {
  name: 'SkillChain',
  uri: 'https://skillchain.app',
  icon: 'favicon.png',
};

export default function WalletSettingsScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const [loading, setLoading] = useState(false);
  const [externalSolana, setExternalSolana] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Identify Wallets from linkedAccounts
  const wallets = user?.linkedAccounts || [];
  const embeddedSolana = wallets.find(w => (w as any).walletClientType === 'privy' && (w as any).chainType === 'solana');
  const embeddedEthereum = wallets.find(w => (w as any).walletClientType === 'privy' && (w as any).chainType === 'ethereum');

  useEffect(() => {
    checkExternalWallet();
  }, [user]);

  const checkExternalWallet = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profile')
        .select('solana_address')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setExternalSolana(data?.solana_address || null);
    } catch (e) {
      console.error('Error checking external wallet:', e);
    } finally {
      setChecking(false);
    }
  };

  const handleConnectExternalSolana = async () => {
    if (!user) return;
    console.log('[WalletSettings] Starting external Solana connection (MWA)');
    
    if (Platform.OS === 'web') {
      Alert.alert('Web Wallet', 'Please use a browser extension like Phantom on web.');
      return;
    }

    setLoading(true);
    try {
      const result = await transact(async (wallet) => {
        console.log('[WalletSettings] Requesting authorization from mobile wallet...');
        return await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });
      });

      const publicKey = result.accounts[0].address;
      console.log('[WalletSettings] Received Public Key:', publicKey);

      const { error } = await supabase
        .from('profile')
        .update({ solana_address: publicKey })
        .eq('id', user.id);

      if (error) {
        console.error('[WalletSettings] Supabase Update Error:', error);
        throw error;
      }

      setExternalSolana(publicKey);
      Alert.alert('Success', 'External Solana wallet linked to your SkillChain profile!');
    } catch (e: any) {
      console.error('[WalletSettings] External wallet error:', e);
      Alert.alert('Connection Failed', e.message || 'Could not connect to external wallet. Ensure Phantom or Solflare is installed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectExternal = async () => {
    if (!user) return;
    Alert.alert('Disconnect Wallet', 'Disconnect external Solana wallet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await supabase.from('profile').update({ solana_address: null }).eq('id', user.id);
            setExternalSolana(null);
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
        <Text style={styles.headerTitle}>Wallets</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* EMBEDDED WALLETS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Embedded Wallets (Auto-generated)</Text>
          <Text style={styles.sectionSubtitle}>These wallets are managed securely by Privy and are available across all your devices.</Text>
          
          {/* Solana Embedded */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <View style={[styles.chainIcon, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="flash" size={20} color="#3B82F6" />
              </View>
              <View style={styles.walletMeta}>
                <Text style={styles.chainName}>Solana (SVM)</Text>
                <Text style={styles.walletType}>Embedded • Active</Text>
              </View>
            </View>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText} numberOfLines={1}>
                {embeddedSolana?.address || 'Generating...'}
              </Text>
            </View>
          </Animated.View>

          {/* Ethereum Embedded */}
          <Animated.View entering={FadeInUp.delay(200)} style={[styles.walletCard, { marginTop: 12 }]}>
            <View style={styles.walletHeader}>
              <View style={[styles.chainIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="logo-ethereum" size={20} color="#6366F1" />
              </View>
              <View style={styles.walletMeta}>
                <Text style={styles.chainName}>Ethereum (EVM)</Text>
                <Text style={styles.walletType}>Embedded • Active</Text>
              </View>
            </View>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText} numberOfLines={1}>
                {embeddedEthereum?.address || 'Generating...'}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* EXTERNAL WALLETS SECTION */}
        <View style={[styles.section, { marginTop: 32 }]}>
          <Text style={styles.sectionTitle}>External Wallets</Text>
          <Text style={styles.sectionSubtitle}>Connect your favorite mobile wallet apps like Phantom or Solflare.</Text>

          {externalSolana ? (
            <Animated.View entering={FadeIn} style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <View style={[styles.chainIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="wallet" size={20} color="#4B5563" />
                </View>
                <View style={styles.walletMeta}>
                  <Text style={styles.chainName}>External Solana</Text>
                  <Text style={styles.walletType}>Connected via MWA</Text>
                </View>
                <TouchableOpacity onPress={handleDisconnectExternal} style={styles.disconnectBtn}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={styles.addressContainer}>
                <Text style={styles.addressText} numberOfLines={1}>{externalSolana}</Text>
              </View>
            </Animated.View>
          ) : (
            <TouchableOpacity 
              style={[styles.connectButton, loading && { opacity: 0.7 }]} 
              onPress={handleConnectExternalSolana}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#405B8F" />
              ) : (
                <>
                  <Ionicons name="add" size={20} color="#405B8F" />
                  <Text style={styles.connectButtonText}>Connect External Solana Wallet</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={20} color="#059669" />
          <Text style={styles.infoText}>
            Your funds are protected by multi-party computation (MPC) and biometric security.
          </Text>
        </View>
      </ScrollView>
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
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: '500',
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  chainIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletMeta: {
    marginLeft: 12,
    flex: 1,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  walletType: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 1,
  },
  addressContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  addressText: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  disconnectBtn: {
    padding: 4,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#DCE4F9',
    gap: 8,
  },
  connectButtonText: {
    color: '#405B8F',
    fontSize: 15,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 16,
    marginTop: 40,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
    lineHeight: 18,
  }
});
