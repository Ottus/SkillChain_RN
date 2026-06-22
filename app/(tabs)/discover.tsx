import { Cache } from '@/constants/Cache';
import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  bio: string | null;
  hourly_rate: number | null;
  skills: string[];
  avatar_url: string | null;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Solana', 'Security', 'UI/UX', 'Kotlin', 'React'];

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      await Cache.fetchWithSWR(
        'discover_profiles',
        async () => {
          const { data, error } = await supabase
            .from('profile')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        },
        (data) => {
          setProfiles(data);
        },
        () => {
          setLoading(false);
        }
      );
    } catch (e: any) {
      console.error('Error fetching discover profiles:', e.message);
      setLoading(false);
    }
  };

  const handleCardPress = (profile: Profile) => {
    // Navigate to profile page passing selected user ID
    router.push({
      pathname: '/settings',
      params: { userId: profile.id }
    });
  };

  // Filter profiles based on search and selected category chip
  const filteredProfiles = profiles.filter(profile => {
    const name = (profile.full_name || '').toLowerCase();
    const bio = (profile.bio || '').toLowerCase();
    const skillsString = (profile.skills || []).join(' ').toLowerCase();
    const query = searchQuery.toLowerCase();

    // Text search filter
    const matchesSearch = name.includes(query) || bio.includes(query) || skillsString.includes(query);

    // Category filter
    const matchesCategory = activeCategory === 'All' || 
      (profile.skills || []).some(skill => 
        skill.toLowerCase().includes(activeCategory.toLowerCase())
      );

    return matchesSearch && matchesCategory;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>ELITE WEB3 TALENT</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search skills, names or chains..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Category Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {categories.map((category) => {
            const isActive = category === activeCategory;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                onPress={() => setActiveCategory(category)}
              >
                <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Talent Cards */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.cardsScroll} showsVerticalScrollIndicator={false}>
          {filteredProfiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={50} color="#9CA3AF" />
              <Text style={styles.emptyText}>No talent found matching criteria.</Text>
            </View>
          ) : (
            filteredProfiles.map((profile, index) => {
              const skillsToShow = (profile.skills || []).slice(0, 3);
              return (
                <Animated.View 
                  key={profile.id}
                  entering={FadeInUp.delay(index * 50)} 
                  style={styles.talentCard}
                >
                  <TouchableOpacity 
                    style={styles.cardHeader}
                    onPress={() => handleCardPress(profile)}
                  >
                    <View style={styles.avatarWrapper}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(profile.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.activeDot} />
                    </View>
                    
                    <View style={styles.talentInfo}>
                      <Text style={styles.talentName}>{profile.full_name || 'Anonymous User'}</Text>
                      {skillsToShow.length > 0 ? (
                        <View style={styles.skillsRow}>
                          {skillsToShow.map((skill, sIdx) => (
                            <View key={sIdx} style={styles.skillBadge}>
                              <Text style={styles.skillBadgeText}>{skill.toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.talentRole}>MEMBER</Text>
                      )}
                    </View>

                    <View style={styles.rateContainer}>
                      <Text style={styles.rateText}>
                        {profile.hourly_rate ? `$${profile.hourly_rate}` : 'Neg.'}
                      </Text>
                      {profile.hourly_rate ? <Text style={styles.rateSubtext}>/ HOUR</Text> : null}
                    </View>
                  </TouchableOpacity>

                  {/* MESSAGE ACTION */}
                  {profile.id !== user?.id && (
                    <TouchableOpacity 
                      style={styles.messageBtn}
                      onPress={() => router.push({
                        pathname: '/chat-detail',
                        params: { userId: profile.id, name: profile.full_name || 'Developer' }
                      })}
                    >
                      <Ionicons name="chatbubbles-outline" size={18} color="#4F46E5" />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 24,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  chipsContainer: {
    height: 48,
    marginBottom: 16,
  },
  chipsContent: {
    paddingHorizontal: 24,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#0F172A',
  },
  chipInactive: {
    backgroundColor: '#E5E7EB',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: '#4B5563',
  },
  cardsScroll: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 16,
  },
  talentCard: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  talentInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  talentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  talentRole: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E3A8A',
    marginTop: 2,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  rateContainer: {
    alignItems: 'flex-end',
  },
  rateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rateSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  });

