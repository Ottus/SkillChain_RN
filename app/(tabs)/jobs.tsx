import { Cache } from '@/constants/Cache';
import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface Job {
  id: string;
  user_id: string;
  title: string;
  description: string;
  salary: number | null;
  salary_scale: string;
  currency: string;
  operation_mode: 'REMOTE' | 'ONSITE' | 'HYBRID';
  contract_type: 'FULL TIME' | 'CONTRACT';
  application_url: string | null;
  created_at: string;
  image_url: string | null;
  profile: {
    full_name: string;
  } | null;
}

export default function JobsScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Reload jobs whenever screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchJobs();
    }, [])
  );

  const fetchJobs = async () => {
    setLoading(true);
    try {
      await Cache.fetchWithSWR(
        'available_jobs',
        async () => {
          const { data, error } = await supabase
            .from('jobs')
            .select(`
              *,
              profile:profile!jobs_user_id_fkey(
                full_name
              )
            `)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data || [];
        },
        (data) => {
          setJobs(data as any);
        },
        () => {
          setLoading(false);
        }
      );
    } catch (e: any) {
      console.error('Error fetching jobs:', e.message);
      setLoading(false);
    }
  };

  const handleApply = (url: string | null) => {
    if (!url) {
      Alert.alert('Apply', 'No application link provided for this job.');
      return;
    }
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.canOpenURL(cleanUrl).then(supported => {
      if (supported) {
        Linking.openURL(cleanUrl);
      } else {
        Alert.alert('Error', 'Cannot open application URL.');
      }
    });
  };

  const filteredJobs = jobs.filter(job => {
    const title = job.title.toLowerCase();
    const desc = job.description.toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query) || desc.includes(query);
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Available Jobs</Text>
        <TouchableOpacity style={styles.filterButton} onPress={fetchJobs}>
          <Ionicons name="refresh" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by job title or keyword..."
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : filteredJobs.length === 0 ? (
        <Animated.View entering={FadeInUp} style={styles.emptyState}>
          <Ionicons name="briefcase" size={80} color="#9CA3AF" style={styles.briefcaseIcon} />
          <Text style={styles.emptyText}>No jobs found</Text>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.jobsList} showsVerticalScrollIndicator={false}>
          {filteredJobs.map((job) => (
            <Animated.View 
              key={job.id} 
              entering={FadeInUp} 
              style={styles.jobCard}
            >
              <View style={styles.jobHeader}>
                {job.image_url ? (
                  <Image source={{ uri: job.image_url }} style={styles.jobLogo} />
                ) : (
                  <View style={[styles.jobLogo, styles.jobLogoPlaceholder]}>
                    <Ionicons name="briefcase" size={20} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.postedBy}>Posted by {job.profile?.full_name || 'Anonymous'}</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <View style={styles.opModeBadge}>
                    <Text style={styles.badgeText}>{job.operation_mode}</Text>
                  </View>
                  <View style={styles.contractBadge}>
                    <Text style={styles.badgeText}>{job.contract_type}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.jobDesc} numberOfLines={3}>{job.description}</Text>

              <View style={styles.jobFooter}>
                <View style={styles.salaryContainer}>
                  <Text style={styles.salaryValue}>
                    {job.salary ? `${job.currency} ${job.salary}` : 'Neg.'}
                  </Text>
                  {job.salary && <Text style={styles.salaryScale}> / {job.salary_scale}</Text>}
                </View>

                <TouchableOpacity 
                  style={styles.applyBtn}
                  onPress={() => handleApply(job.application_url)}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>

                {/* CHAT WITH EMPLOYER */}
                {job.user_id !== user?.id && (
                  <TouchableOpacity 
                    style={[styles.applyBtn, { backgroundColor: '#F3F4F6', marginLeft: 8 }]}
                    onPress={() => router.push({
                      pathname: '/chat-detail',
                      params: { userId: job.user_id, name: job.profile?.full_name || 'Employer' }
                    })}
                  >
                    <Text style={[styles.applyBtnText, { color: '#111827' }]}>Chat</Text>
                  </TouchableOpacity>
                )}
                </View>
                </Animated.View>

          ))}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/post-job')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAF2',
    marginHorizontal: 24,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '500',
  },
  jobsList: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 16,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  postedBy: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  badgeContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  opModeBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contractBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  jobDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    fontWeight: '500',
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  salaryContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  salaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  salaryScale: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  applyBtn: {
    backgroundColor: '#405B8F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  briefcaseIcon: {
    opacity: 0.6,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#405B8F',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  jobLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  jobLogoPlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
