import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useEmbeddedEthereumWallet, useEmbeddedSolanaWallet, usePrivy } from '@privy-io/expo';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Image
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface WorkExperience {
  role: string;
  company: string;
  dates: string;
}

interface Education {
  institution: string;
  degree: string;
}

interface Certification {
  name: string;
  issuer: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  bio: string | null;
  hourly_rate: number | null;
  skills: string[];
  work_experience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  solana_address: string | null;
  ethereum_address: string | null;
  avatar_url: string | null;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = usePrivy();
  const solanaWallet = useEmbeddedSolanaWallet();
  const ethereumWallet = useEmbeddedEthereumWallet();
  const params = useLocalSearchParams();
  const targetUserId = params.userId as string | undefined;

  // Profile data state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Identify Wallets from Privy User object
  const accounts = user?.linked_accounts || [];
  const embeddedSolana = accounts.find((a: any) => a.wallet_client_type === 'privy' && a.chain_type === 'solana');
  const embeddedEthereum = accounts.find((a: any) => a.wallet_client_type === 'privy' && a.chain_type === 'ethereum');

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRate, setEditRate] = useState('');
  const [newSkill, setNewSkill] = useState('');

  const syncWalletsToDatabase = useCallback(async (prof: Profile) => {
    if (!user || !isOwnProfile || syncing) return;
    
    const solAddr = (embeddedSolana as any)?.address;
    const ethAddr = (embeddedEthereum as any)?.address;

    const needsSolUpdate = solAddr && solAddr !== prof.solana_address;
    const needsEthUpdate = ethAddr && ethAddr !== prof.ethereum_address;

    if (needsSolUpdate || needsEthUpdate) {
      setSyncing(true);
      try {
        console.log('[Settings] Syncing wallets to database...');
        await supabase
          .from('profile')
          .update({
            solana_address: solAddr || prof.solana_address,
            ethereum_address: ethAddr || prof.ethereum_address
          })
          .eq('id', user.id);
        
        setProfile(prev => prev ? {
          ...prev,
          solana_address: solAddr || prof.solana_address,
          ethereum_address: ethAddr || prof.ethereum_address
        } : null);
      } catch (e) {
        console.error('Wallet sync failed:', e);
      } finally {
        setSyncing(false);
      }
    }
  }, [user, embeddedSolana, embeddedEthereum, isOwnProfile, syncing]);

  const loadProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const currentId = user.id;
      const queryId = targetUserId || currentId;
      const own = queryId === currentId;
      setIsOwnProfile(own);

      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .eq('id', queryId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const formattedProfile: Profile = {
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          bio: data.bio,
          hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
          skills: data.skills || [],
          work_experience: Array.isArray(data.work_experience) ? data.work_experience : [],
          education: Array.isArray(data.education) ? data.education : [],
          certifications: Array.isArray(data.certifications) ? data.certifications : [],
          solana_address: data.solana_address,
          ethereum_address: data.ethereum_address,
          avatar_url: data.avatar_url,
        };

        setProfile(formattedProfile);
        setEditName(formattedProfile.full_name || '');
        setEditBio(formattedProfile.bio || '');
        setEditRate(formattedProfile.hourly_rate ? String(formattedProfile.hourly_rate) : '');
        
        if (own) syncWalletsToDatabase(formattedProfile);
      } else if (own) {
        const emailAccount = user.linked_accounts?.find((acc: any) => acc.type === 'email');
        const emailAddress = (emailAccount as any)?.address || '';
        const newProfile = {
          id: currentId,
          email: emailAddress,
          full_name: emailAddress.split('@')[0] || 'SkillChain User',
          skills: [],
          work_experience: [],
          education: [],
          certifications: [],
          solana_address: (embeddedSolana as any)?.address || null,
          ethereum_address: (embeddedEthereum as any)?.address || null,
        };
        
        const { error: insertError } = await supabase.from('profile').upsert(newProfile);
        if (insertError) console.error('Error creating initial profile:', insertError);
        else setProfile(newProfile as any);
      }
    } catch (e: any) {
      console.error('Error loading profile:', e.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user, embeddedSolana, embeddedEthereum, syncWalletsToDatabase]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const handleSaveBasicInfo = async () => {
    if (!profile || !user) return;
    try {
      const { error } = await supabase.from('profile').update({
        full_name: editName.trim(),
        bio: editBio.trim(),
        hourly_rate: editRate ? parseFloat(editRate) : null
      }).eq('id', user.id);
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, full_name: editName, bio: editBio, hourly_rate: editRate ? parseFloat(editRate) : null } : null);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim() || !profile || !user) return;
    const updatedSkills = [...profile.skills, newSkill.trim().toUpperCase()];
    try {
      await supabase.from('profile').update({ skills: updatedSkills }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, skills: updatedSkills } : null);
      setNewSkill('');
    } catch { Alert.alert('Error', 'Failed to add skill.'); }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    if (!profile || !user) return;
    const updatedSkills = profile.skills.filter(s => s !== skillToRemove);
    try {
      await supabase.from('profile').update({ skills: updatedSkills }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, skills: updatedSkills } : null);
    } catch { Alert.alert('Error', 'Failed to remove skill.'); }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => await logout() }
    ]);
  };

  const handleCreateEmbeddedWallet = async (chain: 'solana' | 'ethereum') => {
    try {
      if (chain === 'solana') {
        await solanaWallet.create!();
      } else {
        await ethereumWallet.create();
      }
      Alert.alert('Success', `Embedded ${chain} wallet created!`);
      loadProfileData();
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        Alert.alert('Wallet Exists', 'Your wallet is already created.');
      } else {
        Alert.alert('Wallet Error', e.message || 'Failed to create wallet.');
      }
    }
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ACCOUNT SECTION */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Animated.View entering={FadeInUp.delay(100)} style={styles.profileCard}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarTextBlue}>{(profile?.full_name || 'U').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileDetails}>
            <Text style={styles.username}>{profile?.full_name || 'Skillchain User'}</Text>
            <Text style={styles.email}>{profile?.email}</Text>
            <TouchableOpacity style={styles.editProfileBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.editProfileBtnText}>Edit Profile Details</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* WALLET HUB SECTION */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Wallet Management</Text>
        <View style={styles.walletHub}>
          <View style={styles.walletItem}>
            <View style={styles.walletItemHeader}>
              <View style={[styles.chainIcon, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="flash" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.chainLabel}>Solana (SVM)</Text>
              <View style={styles.tag}><Text style={styles.tagText}>Embedded</Text></View>
            </View>
            {embeddedSolana ? (
              <View style={styles.addressBox}>
                <Text style={styles.addressValue} numberOfLines={1}>{(embeddedSolana as any).address}</Text>
              </View>
            ) : (
              <View style={styles.missingWalletContainer}>
                <Text style={styles.missingWalletText}>No Solana wallet found for this account.</Text>
                <TouchableOpacity style={styles.createWalletBtn} onPress={() => handleCreateEmbeddedWallet('solana')}>
                  <Ionicons name="add-circle-outline" size={16} color="#4F46E5" />
                  <Text style={styles.createWalletBtnText}>Create Solana Wallet</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.walletItem}>
            <View style={styles.walletItemHeader}>
              <View style={[styles.chainIcon, { backgroundColor: '#EEF2FF' }]}>
                <FontAwesome5 name="ethereum" size={18} color="#6366F1" />
              </View>
              <Text style={styles.chainLabel}>Ethereum (EVM)</Text>
              <View style={styles.tag}><Text style={styles.tagText}>Embedded</Text></View>
            </View>
            {embeddedEthereum ? (
              <View style={styles.addressBox}>
                <Text style={styles.addressValue} numberOfLines={1}>{(embeddedEthereum as any).address}</Text>
              </View>
            ) : (
              <View style={styles.missingWalletContainer}>
                <Text style={styles.missingWalletText}>No Ethereum wallet found for this account.</Text>
                <TouchableOpacity style={styles.createWalletBtn} onPress={() => handleCreateEmbeddedWallet('ethereum')}>
                  <Ionicons name="add-circle-outline" size={16} color="#4F46E5" />
                  <Text style={styles.createWalletBtnText}>Create Ethereum Wallet</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.externalWalletLink} onPress={() => router.push('/wallet-settings')}>
            <Ionicons name="wallet-outline" size={20} color="#111827" />
            <Text style={styles.externalWalletLinkText}>Manage External Wallets</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* PROFESSIONAL PROFILE DETAILS */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Professional Profile</Text>
        
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Bio</Text>
          <Text style={profile?.bio ? styles.detailText : styles.detailTextMuted}>
            {profile?.bio || 'No bio provided.'}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Hourly Rate</Text>
          <Text style={styles.detailValue}>
            {profile?.hourly_rate ? `$${profile.hourly_rate} / hr` : 'Negotiable'}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Skills</Text>
          <View style={styles.skillsRow}>
            {profile?.skills && profile.skills.length > 0 ? (
              profile.skills.map((skill, i) => (
                <View key={i} style={styles.skillPillMini}>
                  <Text style={styles.skillTextMini}>{skill}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.detailTextMuted}>No skills added yet.</Text>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>App Settings</Text>
        <View style={styles.actionsList}>
          <TouchableOpacity style={styles.actionItemRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={[styles.actionItemText, { color: '#EF4444' }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isEditing} animationType="slide">
        <View style={[styles.container, { paddingTop: 60 }]}>
          <View style={styles.modalHeaderFixed}>
             <TouchableOpacity onPress={() => setIsEditing(false)}><Ionicons name="close" size={28} color="#111827" /></TouchableOpacity>
             <Text style={styles.modalTitleInline}>Edit Profile</Text>
             <TouchableOpacity onPress={handleSaveBasicInfo}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 24 }}>
             <Text style={styles.inputLabel}>Full Name</Text>
             <TextInput style={styles.modalInputFlat} value={editName} onChangeText={setEditName} />
             <Text style={styles.inputLabel}>Bio</Text>
             <TextInput style={[styles.modalInputFlat, { height: 100 }]} value={editBio} onChangeText={setEditBio} multiline />
             <Text style={styles.inputLabel}>Hourly Rate (USD)</Text>
             <TextInput style={styles.modalInputFlat} value={editRate} onChangeText={setEditRate} keyboardType="numeric" />
             <Text style={styles.sectionTitle}>Skills</Text>
             <View style={styles.addSkillRow}>
                <TextInput style={styles.skillInput} placeholder="Add skill" value={newSkill} onChangeText={setNewSkill} />
                <TouchableOpacity style={styles.addSkillBtn} onPress={handleAddSkill}><Ionicons name="add" size={20} color="#FFFFFF" /></TouchableOpacity>
             </View>
             <View style={styles.skillsRow}>
                {(profile?.skills || []).map((skill, i) => (
                  <View key={i} style={styles.skillPill}>
                    <Text style={styles.skillText}>{skill}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSkill(skill)}><Ionicons name="close-circle" size={14} color="#6B7280" /></TouchableOpacity>
                  </View>
                ))}
             </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 },
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
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 28, borderWidth: 1, borderColor: '#E5E7EB' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  avatarTextBlue: { fontSize: 28, fontWeight: '700', color: '#4F46E5' },
  profileDetails: { marginLeft: 20, flex: 1 },
  username: { fontSize: 22, fontWeight: '800', color: '#111827' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  editProfileBtn: { marginTop: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  editProfileBtnText: { fontSize: 12, color: '#4B5563', fontWeight: '700' },
  walletHub: { gap: 12 },
  walletItem: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  walletItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  chainIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  chainLabel: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '800', color: '#6B7280' },
  missingWalletContainer: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', gap: 12 },
  missingWalletText: { fontSize: 13, color: '#6B7280', textAlign: 'center', fontWeight: '500' },
  addressBox: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  addressValue: { fontSize: 12, color: '#4B5563', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  createWalletBtn: { backgroundColor: '#EEF2FF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', flexDirection: 'row', gap: 8 },
  createWalletBtnText: { fontSize: 14, color: '#4F46E5', fontWeight: '700' },
  externalWalletLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 12, marginTop: 8 },
  externalWalletLinkText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  detailSection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  detailLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  detailText: { fontSize: 15, color: '#111827', lineHeight: 22, fontWeight: '500' },
  detailTextMuted: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  detailValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  skillPillMini: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#DCE4F9', marginRight: 8, marginBottom: 8 },
  skillTextMini: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },
  actionsList: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  actionItemRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  actionItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  modalHeaderFixed: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitleInline: { fontSize: 18, fontWeight: '800' },
  saveBtnText: { fontSize: 16, color: '#4F46E5', fontWeight: '800' },
  modalInputFlat: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  addSkillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  skillInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12 },
  addSkillBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  skillPill: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8, marginBottom: 8 },
  skillText: { fontSize: 12, fontWeight: '700' },
  avatarImage: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF' }
});
