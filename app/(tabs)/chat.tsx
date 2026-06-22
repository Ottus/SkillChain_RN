import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface ChatThread {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  timestamp: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useFocusEffect(
    React.useCallback(() => {
      fetchThreads();
    }, [user])
  );

  const fetchThreads = async () => {
    if (!user) return;
    setLoading(true);
    try {
      console.log('[ChatScreen] Fetching threads for DID:', user.id);
      // 1. Fetch messages involving the user
      // We use explicit filters to handle IDs with special characters (like colons in DIDs)
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .or('sender_id.eq.' + user.id + ',receiver_id.eq.' + user.id)
        .order('created_at', { ascending: false });

      if (msgError) throw msgError;

      // 2. Group messages by conversation partner
      const conversationMap = new Map<string, { lastMessage: string; created_at: string }>();
      messages?.forEach(msg => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(otherId)) {
          conversationMap.set(otherId, {
            lastMessage: msg.content,
            created_at: msg.created_at
          });
        }
      });

      // 3. Fetch user profiles for these conversation partners
      if (conversationMap.size > 0) {
        const partnerIds = Array.from(conversationMap.keys());
        const { data: profiles, error: profError } = await supabase
          .from('profile')
          .select('id, full_name, email')
          .in('id', partnerIds);

        if (profError) throw profError;

        const activeThreads: ChatThread[] = (profiles || []).map(p => {
          const convo = conversationMap.get(p.id)!;
          return {
            otherUserId: p.id,
            otherUserName: p.full_name || 'Anonymous User',
            lastMessage: convo.lastMessage,
            timestamp: new Date(convo.created_at).toLocaleTimeString(undefined, { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          };
        });
        setThreads(activeThreads);
      } else {
        setThreads([]);
        // Fetch suggested users to chat with if they have no active conversations
        const { data: suggestions, error: sugError } = await supabase
          .from('profile')
          .select('id, full_name')
          .neq('id', user.id)
          .limit(5);

        if (!sugError) {
          setSuggestedUsers(suggestions || []);
        }
      }
    } catch (e: any) {
      console.error('Error fetching chat threads:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const startChat = (userId: string, userName: string) => {
    router.push({
      pathname: '/chat-detail',
      params: { userId, name: userName }
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 40 }} />
        ) : threads.length === 0 ? (
          <Animated.View entering={FadeInUp} style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No active conversations</Text>
            <Text style={styles.emptySubtitle}>Start a chat with a developer below:</Text>

            <View style={styles.suggestionList}>
              {suggestedUsers.map((user) => (
                <TouchableOpacity 
                  key={user.id}
                  style={styles.suggestionCard}
                  onPress={() => startChat(user.id, user.full_name || 'User')}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(user.full_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.suggestionName}>{user.full_name || 'User'}</Text>
                  <Ionicons name="chatbubble" size={20} color="#405B8F" />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : (
          threads.map((thread, index) => (
            <Animated.View key={thread.otherUserId} entering={FadeInUp.delay(index * 50)}>
              <TouchableOpacity 
                style={styles.chatItem}
                onPress={() => startChat(thread.otherUserId, thread.otherUserName)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {thread.otherUserName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatDetails}>
                  <View style={styles.chatMetaRow}>
                    <Text style={styles.chatName}>{thread.otherUserName}</Text>
                    <Text style={styles.chatTime}>{thread.timestamp}</Text>
                  </View>
                  <Text style={styles.chatPreview} numberOfLines={1}>
                    {thread.lastMessage}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  chatDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  chatMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  chatPreview: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 20,
  },
  suggestionList: {
    width: '100%',
    gap: 12,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'space-between',
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginLeft: 14,
  },
});
