import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { usePrivy, useEmbeddedEthereumWallet, useEmbeddedSolanaWallet } from '@privy-io/expo';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { ethers } from 'ethers';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

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

  // Embedded wallet hooks
  const solanaWalletState = useEmbeddedSolanaWallet();
  const ethereumWalletState = useEmbeddedEthereumWallet();

  const embeddedSolana = solanaWalletState.wallets ? solanaWalletState.wallets[0] : undefined;
  const embeddedEthereum = ethereumWalletState.wallets ? ethereumWalletState.wallets[0] : undefined;

  // Transfer Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [transferChain, setTransferChain] = useState<'solana' | 'ethereum' | 'external-solana'>('solana');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Copy helper
  const copyToClipboard = async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Wallet address copied to clipboard!');
  };

  // Transfer Solana (Embedded)
  const handleTransferSolana = async () => {
    if (!embeddedSolana) {
      Alert.alert('Error', 'Embedded Solana wallet is not ready.');
      return;
    }
    if (!recipientAddress.trim()) {
      Alert.alert('Error', 'Please enter a recipient address.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setTransferring(true);
    try {
      const provider = await embeddedSolana.getProvider();
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const fromPubkey = new PublicKey(embeddedSolana.address);
      const toPubkey = new PublicKey(recipientAddress.trim());

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.round(Number(amount) * 1_000_000_000),
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const signatureResult = await provider.request({
        method: 'signAndSendTransaction',
        params: {
          transaction: transaction,
          connection: connection,
        },
      });

      const signature = signatureResult.signature;

      console.log('[Transfer Solana] Signature:', signature);
      Alert.alert('Success', `Successfully sent ${amount} SOL.\nTx ID: ${signature.substring(0, 12)}...`);
      setModalVisible(false);
      setRecipientAddress('');
      setAmount('');
    } catch (e: any) {
      console.error('[Transfer Solana] Error:', e);
      Alert.alert('Transfer Failed', e.message || 'Solana transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  // Transfer Ethereum (Embedded)
  const handleTransferEthereum = async () => {
    if (!embeddedEthereum) {
      Alert.alert('Error', 'Embedded Ethereum wallet is not ready.');
      return;
    }
    if (!recipientAddress.trim()) {
      Alert.alert('Error', 'Please enter a recipient address.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setTransferring(true);
    try {
      const provider = await embeddedEthereum.getProvider();
      const web3Provider = new ethers.providers.Web3Provider(provider);
      const signer = web3Provider.getSigner();

      const tx = await signer.sendTransaction({
        to: recipientAddress.trim(),
        value: ethers.utils.parseEther(amount),
      });

      console.log('[Transfer Ethereum] Tx:', tx.hash);
      Alert.alert('Success', `Successfully sent ${amount} ETH.\nTx Hash: ${tx.hash.substring(0, 12)}...`);
      setModalVisible(false);
      setRecipientAddress('');
      setAmount('');
    } catch (e: any) {
      console.error('[Transfer Ethereum] Error:', e);
      Alert.alert('Transfer Failed', e.message || 'Ethereum transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  // Transfer Solana (External Wallet via MWA)
  const handleTransferExternalSolana = async () => {
    if (!externalSolana) {
      Alert.alert('Error', 'External Solana wallet is not connected.');
      return;
    }
    if (!recipientAddress.trim()) {
      Alert.alert('Error', 'Please enter a recipient address.');
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setTransferring(true);
    try {
      await transact(async (wallet) => {
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });

        const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const fromPubkey = new PublicKey(authResult.accounts[0].address);
        const toPubkey = new PublicKey(recipientAddress.trim());

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Math.round(Number(amount) * 1_000_000_000),
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;

        const payload = transaction.serialize({ requireAllSignatures: false }).toString('base64');
        const result = await wallet.signAndSendTransactions({
          payloads: [payload],
        });

        const txSignature = result.signatures[0];

        console.log('[Transfer External Solana] Signature:', txSignature);
        Alert.alert('Success', `Successfully sent ${amount} SOL from external wallet.\nTx: ${txSignature.substring(0, 12)}...`);
      });
      setModalVisible(false);
      setRecipientAddress('');
      setAmount('');
    } catch (e: any) {
      console.error('[Transfer External Solana] Error:', e);
      Alert.alert('Transfer Failed', e.message || 'External Solana transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

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
              {embeddedSolana?.address && (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(embeddedSolana.address)}
                    style={styles.actionIconButton}
                  >
                    <Ionicons name="copy-outline" size={16} color={Theme.colors.primary} />
                    <Text style={styles.actionIconText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setTransferChain('solana');
                      setRecipientAddress('');
                      setAmount('');
                      setModalVisible(true);
                    }}
                    style={[styles.actionIconButton, { marginLeft: 16 }]}
                  >
                    <Ionicons name="send-outline" size={16} color="#059669" />
                    <Text style={[styles.actionIconText, { color: '#059669' }]}>Send</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Ethereum Embedded */}
          <Animated.View entering={FadeInUp.delay(200)} style={[styles.walletCard, { marginTop: 12 }]}>
            <View style={styles.walletHeader}>
              <View style={[styles.chainIcon, { backgroundColor: '#EEF2FF' }]}>
                <FontAwesome5 name="ethereum" size={20} color="#6366F1" />
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
              {embeddedEthereum?.address && (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(embeddedEthereum.address)}
                    style={styles.actionIconButton}
                  >
                    <Ionicons name="copy-outline" size={16} color={Theme.colors.primary} />
                    <Text style={styles.actionIconText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setTransferChain('ethereum');
                      setRecipientAddress('');
                      setAmount('');
                      setModalVisible(true);
                    }}
                    style={[styles.actionIconButton, { marginLeft: 16 }]}
                  >
                    <Ionicons name="send-outline" size={16} color="#059669" />
                    <Text style={[styles.actionIconText, { color: '#059669' }]}>Send</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity 
                    onPress={() => copyToClipboard(externalSolana)}
                    style={styles.actionIconButton}
                  >
                    <Ionicons name="copy-outline" size={16} color={Theme.colors.primary} />
                    <Text style={styles.actionIconText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setTransferChain('external-solana');
                      setRecipientAddress('');
                      setAmount('');
                      setModalVisible(true);
                    }}
                    style={[styles.actionIconButton, { marginLeft: 16 }]}
                  >
                    <Ionicons name="send-outline" size={16} color="#059669" />
                    <Text style={[styles.actionIconText, { color: '#059669' }]}>Send</Text>
                  </TouchableOpacity>
                </View>
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

      {/* Transfer Funds Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Send {transferChain === 'ethereum' ? 'ETH' : 'SOL'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Recipient Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter public address"
                  placeholderTextColor="#9CA3AF"
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  onPress={async () => {
                    const content = await Clipboard.getStringAsync();
                    if (content) setRecipientAddress(content);
                  }}
                  style={styles.pasteButton}
                >
                  <Text style={styles.pasteButtonText}>Paste</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Amount</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.0"
                placeholderTextColor="#9CA3AF"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              <TouchableOpacity 
                style={[styles.sendButton, transferring && { opacity: 0.7 }]}
                onPress={
                  transferChain === 'solana' 
                    ? handleTransferSolana 
                    : transferChain === 'ethereum' 
                    ? handleTransferEthereum 
                    : handleTransferExternalSolana
                }
                disabled={transferring}
              >
                {transferring ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>Confirm & Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalForm: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    height: 54,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  pasteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
  },
  pasteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  amountInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    height: 54,
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sendButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
