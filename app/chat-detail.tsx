import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import {
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
    clusterApiUrl,
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction
} from '@solana/web3.js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';

const COMMON_EVM_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: 'native', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
];

interface TokenInfo {
  symbol: string;
  name: string;
  mint?: string; // Solana
  address?: string; // EVM
  decimals: number;
  balance: string;
  isNative?: boolean;
}

const APP_IDENTITY = {
  name: 'SkillChain',
  uri: 'https://skillchain.app',
  icon: 'favicon.png',
};

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const { userId, name } = useLocalSearchParams();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tipping states
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipChain, setTipChain] = useState<'solana' | 'ethereum'>('solana');
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [receiverSolWallet, setReceiverSolWallet] = useState<string | null>(null);
  const [receiverEthWallet, setReceiverEthWallet] = useState<string | null>(null);

  // Token states
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [fetchingBalances, setFetchingBalances] = useState(false);

  // Identify Wallets from linkedAccounts
  const wallets = user?.linked_accounts || [];
  const embeddedSolana = wallets.find((w: any) => w.wallet_client_type === 'privy' && w.chain_type === 'solana');
  const externalSolana = wallets.find((w: any) => w.wallet_client_type !== 'privy' && w.chain_type === 'solana');
  const currentSolWallet = (embeddedSolana as any)?.address || (externalSolana as any)?.address;

  const embeddedEthereum = wallets.find((w: any) => w.wallet_client_type === 'privy' && w.chain_type === 'ethereum');
  const externalEthereum = wallets.find((w: any) => w.wallet_client_type !== 'privy' && w.chain_type === 'ethereum');
  const currentEthWallet = (embeddedEthereum as any)?.address || (externalEthereum as any)?.address;

  const currentUserWallet = tipChain === 'solana' ? currentSolWallet : currentEthWallet;
  const receiverWallet = tipChain === 'solana' ? receiverSolWallet : receiverEthWallet;

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchBalances = useCallback(async () => {
    if (!user || !currentUserWallet) return;
    setFetchingBalances(true);
    
    try {
      if (tipChain === 'solana') {
        const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
        const owner = new PublicKey(currentSolWallet!);
        
        // Fetch native SOL
        const solBalance = await connection.getBalance(owner);
        const solToken: TokenInfo = {
          symbol: 'SOL',
          name: 'Solana',
          isNative: true,
          decimals: 9,
          balance: (solBalance / LAMPORTS_PER_SOL).toFixed(4),
        };

        // Fetch SPL tokens
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
          programId: TOKEN_PROGRAM_ID,
        });
        
        const splTokens: TokenInfo[] = tokenAccounts.value.map(acc => {
          const info = acc.account.data.parsed.info;
          return {
            symbol: 'Token', // We'd need an indexer for real symbols
            name: info.mint.substring(0, 8),
            mint: info.mint,
            decimals: info.tokenAmount.decimals,
            balance: info.tokenAmount.uiAmountString,
          };
        }).filter(t => parseFloat(t.balance) > 0);

        const allTokens = [solToken, ...splTokens];
        setAvailableTokens(allTokens);
        setSelectedToken(allTokens[0]);
      } else {
        const ethToken: TokenInfo = {
          symbol: 'ETH',
          name: 'Ethereum',
          isNative: true,
          address: 'native',
          decimals: 18,
          balance: 'Check wallet', 
        };
        
        const allTokens = [ethToken, ...COMMON_EVM_TOKENS.slice(1).map(t => ({ ...t, balance: '0.00' }))];
        setAvailableTokens(allTokens);
        setSelectedToken(ethToken);
      }
    } catch (e) {
      console.error('Error fetching balances:', e);
    } finally {
      setFetchingBalances(false);
    }
  }, [user, tipChain, currentSolWallet, currentEthWallet]);

  useEffect(() => {
    if (showTipModal) fetchBalances();
  }, [showTipModal, fetchBalances]);

  useEffect(() => {
    if (!userId || !user) return;

    let active = true;
    let channel: any = null;

    const setupChat = async () => {
      setLoading(true);
      try {
        // Fetch receiver's wallet addresses
        const { data: receiverData } = await supabase
          .from('profile')
          .select('solana_address, ethereum_address')
          .eq('id', userId)
          .single();
        
        if (!active) return;

        if (receiverData) {
          setReceiverSolWallet(receiverData.solana_address);
          setReceiverEthWallet(receiverData.ethereum_address);
        }

        // Fetch message history
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (!active) return;

        setMessages(data || []);

        // Subscribe to real-time message changes
        channel = supabase
          .channel(`chat-room-${user.id}-${userId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const newMsg = payload.new as Message;
              if (
                (newMsg.sender_id === user.id && newMsg.receiver_id === userId) ||
                (newMsg.sender_id === userId && newMsg.receiver_id === user.id)
              ) {
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
              }
            }
          )
          .subscribe();

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
      } catch (e: any) {
        console.error('Chat setup error:', e.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setupChat();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, user]);

  const handleSendMessage = async (customContent?: string) => {
    const content = customContent || inputText.trim();
    if (!content || !user || !userId) return;
    
    if (!customContent) setInputText('');

    try {
      const newMsg = {
        sender_id: user.id,
        receiver_id: userId as string,
        content: content,
      };

      const { data, error } = await supabase
        .from('messages')
        .insert(newMsg)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

        // Notify Receiver
        await supabase.from('notifications').insert({
          receiver_id: userId as string,
          sender_id: user.id,
          type: 'chat',
          content: customContent ? 'sent you a tip' : 'sent you a message'
        });
      }
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Failed to send message.');
    }
  };

  const handleSendTip = async () => {
    if (!tipAmount || isNaN(parseFloat(tipAmount)) || parseFloat(tipAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (!selectedToken) {
      Alert.alert('No Token', 'Please select a token to send.');
      return;
    }

    if (!currentSolWallet) {
      Alert.alert('No Wallet', 'Please ensure your embedded wallet is ready.');
      return;
    }

    if (!receiverSolWallet) {
      Alert.alert('No Receiver Wallet', `${name} hasn't connected a Solana wallet yet.`);
      return;
    }

    setSendingTip(true);

    try {
      const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
      const senderPublicKey = new PublicKey(currentSolWallet);
      const recipientPublicKey = new PublicKey(receiverSolWallet);

      let signature: string;

      if (selectedToken.isNative) {
        // SOL Transfer
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipientPublicKey,
            lamports: Math.floor(parseFloat(tipAmount) * LAMPORTS_PER_SOL),
          })
        );
        
        signature = await signAndSendSolana(transaction, connection);
      } else {
        // SPL Token Transfer
        const mintPublicKey = new PublicKey(selectedToken.mint!);
        const fromAta = await getAssociatedTokenAddress(mintPublicKey, senderPublicKey);
        const toAta = await getAssociatedTokenAddress(mintPublicKey, recipientPublicKey);

        const transaction = new Transaction().add(
          createTransferInstruction(
            fromAta,
            toAta,
            senderPublicKey,
            Math.floor(parseFloat(tipAmount) * Math.pow(10, selectedToken.decimals))
          )
        );

        signature = await signAndSendSolana(transaction, connection);
      }

      const tipMsg = `💸 Sent ${tipAmount} ${selectedToken.symbol}\nSig: ${signature.slice(0, 8)}...`;
      await handleSendMessage(tipMsg);
      
      setSendingTip(false);
      setShowTipModal(false);
      setTipAmount('');
      Alert.alert('Success', `Successfully tipped ${tipAmount} ${selectedToken.symbol} to ${name}!`);
    } catch (e: any) {
      console.error('Tipping error:', e);
      setSendingTip(false);
      Alert.alert('Transaction Failed', e.message || 'Could not complete the transaction.');
    }
  };

  const signAndSendSolana = async (transaction: Transaction, connection: Connection) => {
    const senderPublicKey = new PublicKey(currentSolWallet!);
    if (embeddedSolana) {
      const provider = await (embeddedSolana as any).getProvider();
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderPublicKey;
      
      const base64Transaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');
      return await provider.request({
        method: 'signAndSendTransaction',
        params: { transaction: base64Transaction, connection }
      }) as string;
    } else {
      return await transact(async (wallet) => {
        await wallet.authorize({ cluster: 'mainnet-beta', identity: APP_IDENTITY });
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPublicKey;
        const base64Transaction = transaction.serialize({ requireAllSignatures: false }).toString('base64');
        const sigs = await wallet.signAndSendTransactions({ payloads: [base64Transaction] });
        return sigs.signatures[0];
      });
    }
  };

  const handleSendEvmTip = async () => {
    if (!selectedToken || !receiverEthWallet) {
      Alert.alert('Error', 'Token or receiver address missing.');
      return;
    }
    setSendingTip(true);

    try {
      const provider = await (embeddedEthereum as any)?.getProvider();
      if (!provider) throw new Error('No EVM provider');
      
      const amount = BigInt(Math.floor(parseFloat(tipAmount) * Math.pow(10, selectedToken.decimals)));
      let txHash: string;

      if (selectedToken.isNative) {
        txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: currentEthWallet,
            to: receiverEthWallet,
            value: '0x' + amount.toString(16),
          }]
        });
      } else {
        // ERC-20 Transfer: method ID a9059cbb for transfer(address,uint256)
        const data = `0xa9059cbb${receiverEthWallet.slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`;
        txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: currentEthWallet,
            to: selectedToken.address,
            data: data,
          }]
        });
      }

      const tipMsg = `💸 Sent ${tipAmount} ${selectedToken.symbol}\nHash: ${txHash.slice(0, 10)}...`;
      await handleSendMessage(tipMsg);
      
      setSendingTip(false);
      setShowTipModal(false);
      setTipAmount('');
      Alert.alert('Success', `Successfully tipped ${tipAmount} ${selectedToken.symbol} to ${name}!`);
    } catch (e: any) {
      console.error('EVM Tipping error:', e);
      setSendingTip(false);
      Alert.alert('Transaction Failed', e.message || 'Could not complete the EVM tip.');
    }
  };

  const executeTip = () => {
    if (tipChain === 'solana') handleSendTip();
    else handleSendEvmTip();
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerName}>{name || 'Chat'}</Text>
        </View>
        
        {/* Right side payment $ action */}
        <TouchableOpacity 
          style={styles.payButton}
          onPress={() => setShowTipModal(true)}
        >
          <View style={styles.payIconContainer}>
            <Text style={styles.payButtonText}>$</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer} 
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet. Send a message to start conversation!</Text>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === user?.id;
              const isTip = msg.content.startsWith('💸 Sent a tip of');
              const msgTime = new Date(msg.created_at).toLocaleTimeString(undefined, { 
                hour: '2-digit', 
                minute: '2-digit' 
              });

              return (
                <Animated.View 
                  key={msg.id || index}
                  entering={FadeIn.delay(50)} 
                  style={isMe ? styles.messageRowRight : styles.messageRowLeft}
                >
                  <View style={[
                    isMe ? styles.bubbleRight : styles.bubbleLeft,
                    isTip && styles.tipBubble
                  ]}>
                    <Text style={[
                      isMe ? styles.messageTextRight : styles.messageTextLeft,
                      isTip && styles.tipText
                    ]}>
                      {msg.content}
                    </Text>
                    <Text style={isMe ? styles.timestampTextRight : styles.timestampTextLeft}>
                      {msgTime}
                    </Text>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput 
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSendMessage()}
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={() => handleSendMessage()}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tipping Modal */}
      <Modal
        visible={showTipModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTipModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={SlideInUp} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send a Tip</Text>
              <TouchableOpacity onPress={() => setShowTipModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Chain Selector */}
              <View style={styles.chainSelector}>
                <TouchableOpacity 
                  style={[styles.chainToggle, tipChain === 'solana' && styles.chainToggleActive]}
                  onPress={() => setTipChain('solana')}
                >
                  <Ionicons name="flash" size={16} color={tipChain === 'solana' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.chainToggleText, tipChain === 'solana' && styles.chainToggleTextActive]}>Solana</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chainToggle, tipChain === 'ethereum' && styles.chainToggleActive]}
                  onPress={() => setTipChain('ethereum')}
                >
                  <FontAwesome5 name="ethereum" size={16} color={tipChain === 'ethereum' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.chainToggleText, tipChain === 'ethereum' && styles.chainToggleTextActive]}>Ethereum</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.recipientInfo}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarTextSmall}>{(name as string || 'U').charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>To: {name}</Text>
                  <Text style={styles.recipientWallet} numberOfLines={1}>
                    {receiverWallet ? `${receiverWallet.slice(0, 10)}...${receiverWallet.slice(-10)}` : 'No wallet address found'}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Token & Amount</Text>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenList}>
                {fetchingBalances ? (
                  <ActivityIndicator size="small" color={Theme.colors.primary} />
                ) : (
                  availableTokens.map((t, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.tokenPill, selectedToken?.symbol === t.symbol && styles.tokenPillActive]}
                      onPress={() => setSelectedToken(t)}
                    >
                      <Text style={[styles.tokenPillText, selectedToken?.symbol === t.symbol && styles.tokenPillTextActive]}>
                        {t.symbol}
                      </Text>
                      <Text style={[styles.tokenBalance, selectedToken?.symbol === t.symbol && styles.tokenBalanceActive]}>
                        {t.balance}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TextInput
                style={styles.tipInput}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={tipAmount}
                onChangeText={setTipAmount}
                autoFocus
              />

              <View style={styles.walletStatus}>
                <Ionicons 
                  name={currentUserWallet ? "checkmark-circle" : "alert-circle"} 
                  size={16} 
                  color={currentUserWallet ? "#10B981" : "#F59E0B"} 
                />
                <Text style={[styles.walletStatusText, { color: currentUserWallet ? "#059669" : "#D97706" }]}>
                  {currentUserWallet 
                    ? `Using: ${currentUserWallet.slice(0, 6)}...${currentUserWallet.slice(-4)}` 
                    : 'Your wallet not ready'
                  }
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.confirmTipButton, (sendingTip || !currentUserWallet || !receiverWallet) && { opacity: 0.7 }]}
                onPress={executeTip}
                disabled={sendingTip || !currentUserWallet || !receiverWallet}
              >
                {sendingTip ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmTipButtonText}>
                    Confirm & Send {tipChain === 'solana' ? 'SOL' : 'ETH'}
                  </Text>
                )}
              </TouchableOpacity>
              
              <Text style={styles.disclaimer}>
                Transactions are near-instant and non-reversible.
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 40,
    paddingHorizontal: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: Theme.colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  payButton: {
    padding: 4,
  },
  payIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE4F9',
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#405B8F',
  },
  messagesContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  messageRowLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  messageRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  bubbleLeft: {
    backgroundColor: '#EAEAF2',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '80%',
  },
  bubbleRight: {
    backgroundColor: '#405B8F',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '80%',
  },
  tipBubble: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  messageTextLeft: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  messageTextRight: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  tipText: {
    color: '#0369A1',
    fontWeight: '700',
  },
  timestampTextLeft: {
    fontSize: 10,
    color: '#9CA3AF',
    alignSelf: 'flex-end',
    marginTop: 4,
    fontWeight: '600',
  },
  timestampTextRight: {
    fontSize: 10,
    color: '#D1D5DB',
    alignSelf: 'flex-end',
    marginTop: 4,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: Theme.colors.background,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#EAEAF2',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#405B8F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalBody: {
    gap: 16,
  },
  chainSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  chainToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  chainToggleActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chainToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chainToggleTextActive: {
    color: '#FFFFFF',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCE4F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  recipientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  recipientWallet: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: -8,
  },
  tipInput: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    textAlign: 'center',
    marginTop: 10,
  },
  tokenList: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
  },
  tokenPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  tokenPillActive: {
    backgroundColor: '#4F46E5',
  },
  tokenPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  tokenBalance: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  tokenBalanceActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  walletStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginTop: 4,
  },
  walletStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmTipButton: {
    backgroundColor: '#405B8F',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmTipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  }
});
