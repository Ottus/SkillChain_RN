import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Alert,
  Modal
} from 'react-native';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { supabase } from '@/constants/Supabase';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol';
import { 
  Connection, 
  clusterApiUrl, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';

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
  const { userId, name } = useLocalSearchParams();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Tipping states
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [sendingTip, setSendingTip] = useState(false);
  const [receiverWallet, setReceiverWallet] = useState<string | null>(null);
  const [currentUserWallet, setCurrentUserWallet] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const setupChat = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch receiver's wallet address
      const { data: receiverData } = await supabase
        .from('profile')
        .select('solana_address')
        .eq('id', userId)
        .single();
      
      if (receiverData) {
        setReceiverWallet(receiverData.solana_address);
      }

      // Fetch current user's wallet address
      const { data: currentUserData } = await supabase
        .from('profile')
        .select('solana_address')
        .eq('id', user.id)
        .single();
      
      if (currentUserData) {
        setCurrentUserWallet(currentUserData.solana_address);
      }

      // Fetch message history
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Subscribe to real-time message changes
      const channel = supabase
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

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e: any) {
      console.error('Chat setup error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setupChat();
  }, [setupChat]);

  const handleSendMessage = async (customContent?: string) => {
    const content = customContent || inputText.trim();
    if (!content || !currentUserId || !userId) return;
    
    if (!customContent) setInputText('');

    try {
      const newMsg = {
        sender_id: currentUserId,
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
          sender_id: currentUserId,
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
      Alert.alert('Invalid Amount', 'Please enter a valid SOL amount.');
      return;
    }

    if (!currentUserWallet) {
      Alert.alert(
        'Wallet Not Connected', 
        'Please connect your Solana wallet in Profile settings to send tips.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => router.push('/wallet-settings') }
        ]
      );
      return;
    }

    if (!receiverWallet) {
      Alert.alert('No Receiver Wallet', `${name} hasn't connected a wallet yet.`);
      return;
    }

    setSendingTip(true);

    try {
      const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
      const senderPublicKey = new PublicKey(currentUserWallet);
      const recipientPublicKey = new PublicKey(receiverWallet);
      const lamports = Math.floor(parseFloat(tipAmount) * LAMPORTS_PER_SOL);

      // 1. Initiate MWA transaction
      const signature = await transact(async (wallet) => {
        // Authorize first
        const auth = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });

        // 2. Create Transaction
        const { blockhash } = await connection.getLatestBlockhash();
        const transaction = new Transaction({
          feePayer: senderPublicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: recipientPublicKey,
            lamports,
          })
        );

        // 3. Sign and Send
        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        return signatures[0];
      });

      console.log('Transaction Signature:', signature);
      
      const tipMsg = `💸 Sent a tip of ${tipAmount} SOL\nSig: ${signature.slice(0, 8)}...`;
      await handleSendMessage(tipMsg);
      
      setSendingTip(false);
      setShowTipModal(false);
      setTipAmount('');
      Alert.alert('Success', `Successfully tipped ${tipAmount} SOL to ${name}!`);
    } catch (e: any) {
      console.error('Tipping error:', e);
      setSendingTip(false);
      Alert.alert('Transaction Failed', e.message || 'Could not complete the tip transaction.');
    }
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
              const isMe = msg.sender_id === currentUserId;
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
              <View style={styles.recipientInfo}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarTextSmall}>{(name as string || 'U').charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.recipientName}>To: {name}</Text>
                  <Text style={styles.recipientWallet} numberOfLines={1}>
                    {receiverWallet ? `${receiverWallet.slice(0, 8)}...${receiverWallet.slice(-8)}` : 'No wallet address found'}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Amount (SOL)</Text>
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
                    ? `Connected: ${currentUserWallet.slice(0, 6)}...${currentUserWallet.slice(-4)}` 
                    : 'Wallet not connected'
                  }
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.confirmTipButton, sendingTip && { opacity: 0.7 }]}
                onPress={handleSendTip}
                disabled={sendingTip}
              >
                {sendingTip ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmTipButtonText}>Confirm & Send SOL</Text>
                )}
              </TouchableOpacity>
              
              <Text style={styles.disclaimer}>
                Transactions on Solana are near-instant and non-reversible.
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
