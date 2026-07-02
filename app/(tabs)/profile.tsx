import React, { useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Alert, 
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Theme } from '@/constants/Theme';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/constants/Supabase';
import { Cache } from '@/constants/Cache';
import { usePrivy } from '@privy-io/expo';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

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
  avatar_url: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId as string | undefined;
  const { user } = usePrivy();

  // Profile data state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRate, setEditRate] = useState('');
  const [newSkill, setNewSkill] = useState('');

  // Add detail modals
  const [activeModal, setActiveModal] = useState<'work' | 'edu' | 'cert' | null>(null);
  
  // Work modal inputs
  const [workRole, setWorkRole] = useState('');
  const [workCompany, setWorkCompany] = useState('');
  const [workDates, setWorkDates] = useState('');

  // Education modal inputs
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduDegree, setEduDegree] = useState('');

  // Cert modal inputs
  const [certName, setCertName] = useState('');
  const [certIssuer, setCertIssuer] = useState('');

  // Re-run loading on page focus or when userId parameter changes
  const loadProfileData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCurrentUserId(user.id);

      const queryId = targetUserId || user.id;
      const own = queryId === user.id;
      setIsOwnProfile(own);

      await Cache.fetchWithSWR(
        `profile_${queryId}`,
        async () => {
          const { data, error } = await supabase
            .from('profile')
            .select('*')
            .eq('id', queryId)
            .single();

          if (error) throw error;
          return data;
        },
        (data) => {
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
              avatar_url: data.avatar_url,
            };

            setProfile(formattedProfile);
            setEditName(formattedProfile.full_name || '');
            setEditBio(formattedProfile.bio || '');
            setEditRate(formattedProfile.hourly_rate ? String(formattedProfile.hourly_rate) : '');
          }
        },
        () => {
          setLoading(false);
        }
      );
    } catch (e: any) {
      console.error('Error loading profile:', e.message);
      Alert.alert('Profile Error', 'Failed to load profile details.');
      setLoading(false);
    }
  }, [targetUserId, user]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const handleSaveBasicInfo = async () => {
    if (!profile || !currentUserId) return;
    
    try {
      const { error } = await supabase
        .from('profile')
        .update({
          full_name: editName.trim(),
          bio: editBio.trim(),
          hourly_rate: editRate ? parseFloat(editRate) : null
        })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        full_name: editName.trim(),
        bio: editBio.trim(),
        hourly_rate: editRate ? parseFloat(editRate) : null
      } : null);

      setIsEditing(false);
      Alert.alert('Success', 'Basic profile info updated!');
    } catch (e: any) {
      Alert.alert('Save Error', e.message || 'Failed to update profile info.');
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim() || !profile || !currentUserId) return;
    const updatedSkills = [...profile.skills, newSkill.trim().toUpperCase()];

    try {
      const { error } = await supabase
        .from('profile')
        .update({ skills: updatedSkills })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, skills: updatedSkills } : null);
      setNewSkill('');
    } catch {
      Alert.alert('Skill Error', 'Failed to add skill.');
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    if (!profile || !currentUserId || !isOwnProfile) return;
    const updatedSkills = profile.skills.filter(s => s !== skillToRemove);

    try {
      const { error } = await supabase
        .from('profile')
        .update({ skills: updatedSkills })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, skills: updatedSkills } : null);
    } catch {
      Alert.alert('Skill Error', 'Failed to remove skill.');
    }
  };

  const handleAddWorkExperience = async () => {
    if (!workRole.trim() || !workCompany.trim() || !profile || !currentUserId) return;
    const newWork: WorkExperience = {
      role: workRole.trim(),
      company: workCompany.trim(),
      dates: workDates.trim() || 'Present'
    };
    const updatedWork = [...profile.work_experience, newWork];

    try {
      const { error } = await supabase
        .from('profile')
        .update({ work_experience: updatedWork })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, work_experience: updatedWork } : null);
      setActiveModal(null);
      setWorkRole('');
      setWorkCompany('');
      setWorkDates('');
    } catch {
      Alert.alert('Experience Error', 'Failed to save experience.');
    }
  };

  const handleAddEducation = async () => {
    if (!eduInstitution.trim() || !eduDegree.trim() || !profile || !currentUserId) return;
    const newEdu: Education = {
      institution: eduInstitution.trim(),
      degree: eduDegree.trim()
    };
    const updatedEdu = [...profile.education, newEdu];

    try {
      const { error } = await supabase
        .from('profile')
        .update({ education: updatedEdu })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, education: updatedEdu } : null);
      setActiveModal(null);
      setEduInstitution('');
      setEduDegree('');
    } catch {
      Alert.alert('Education Error', 'Failed to save education details.');
    }
  };

  const handleAddCertification = async () => {
    if (!certName.trim() || !certIssuer.trim() || !profile || !currentUserId) return;
    const newCert: Certification = {
      name: certName.trim(),
      issuer: certIssuer.trim()
    };
    const updatedCerts = [...profile.certifications, newCert];

    try {
      const { error } = await supabase
        .from('profile')
        .update({ certifications: updatedCerts })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, certifications: updatedCerts } : null);
      setActiveModal(null);
      setCertName('');
      setCertIssuer('');
    } catch {
      Alert.alert('Certification Error', 'Failed to save certification details.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        } 
      }
    ]);
  };

  const uploadAvatarToStorage = async (uri: string): Promise<string | null> => {
    if (!currentUserId) return null;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert Blob to ArrayBuffer using FileReader and Buffer (React Native friendly)
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
          } else {
            reject(new Error('Failed to read blob as base64'));
          }
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsDataURL(blob);
      });
      
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `avatar_${currentUserId}_${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('post-images')
        .upload(fileName, arrayBuffer, {
          contentType: blob.type || 'image/jpeg',
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (e: any) {
      console.error('Error during profile image upload:', e);
      Alert.alert('Upload Error', `Failed to upload avatar: ${e.message || e}`);
      return null;
    }
  };

  const handleSelectProfilePicture = async () => {
    if (!isOwnProfile || !currentUserId) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Media library permissions are required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || !result.assets[0].uri) {
        return;
      }

      const uri = result.assets[0].uri;
      setLoading(true);

      const uploadedUrl = await uploadAvatarToStorage(uri);
      if (!uploadedUrl) {
        throw new Error('Image upload failed.');
      }

      // Update avatar_url in DB
      const { error } = await supabase
        .from('profile')
        .update({ avatar_url: uploadedUrl })
        .eq('id', currentUserId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, avatar_url: uploadedUrl } : null);
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (e: any) {
      console.error('Error uploading profile picture:', e.message);
      Alert.alert('Error', e.message || 'Failed to upload profile picture.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyCardText}>Profile not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Dynamic Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{isOwnProfile ? 'My Profile' : 'User Profile'}</Text>
          {isOwnProfile && (
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerActionBtn} 
                onPress={() => router.push('/settings')}
              >
                <Ionicons name="settings-outline" size={24} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerActionBtn}
                onPress={() => setIsEditing(!isEditing)}
              >
                <Ionicons name={isEditing ? "close-outline" : "pencil-outline"} size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile Card */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.profileCard}>
          <TouchableOpacity 
            disabled={!isOwnProfile}
            onPress={handleSelectProfilePicture}
            style={styles.avatarWrapper}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarTextBlue}>
                  {(profile.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isOwnProfile && (
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileDetails}>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
              />
            ) : (
              <Text style={styles.username}>{profile.full_name || 'Skillchain User'}</Text>
            )}
            <Text style={styles.email}>{profile.email}</Text>
            {profile.solana_address ? (
              <Text style={styles.walletAddr} numberOfLines={1}>
                {profile.solana_address.substring(0, 6)}...{profile.solana_address.slice(-4)}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        {/* Bio Section */}
        <Animated.View entering={FadeInUp.delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          {isEditing ? (
            <TextInput
              style={[styles.nameInput, styles.bioInput]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell others about yourself..."
              multiline
            />
          ) : profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <Text style={styles.bioTextMuted}>No bio provided.</Text>
          )}
        </Animated.View>

        {/* Hourly Rate */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.section}>
          <Text style={styles.rateLabel}>Hourly Rate</Text>
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={editRate}
              onChangeText={setEditRate}
              placeholder="Hourly rate (USD)"
              keyboardType="numeric"
            />
          ) : (
            <Text style={styles.rateValue}>
              {profile.hourly_rate ? `$${profile.hourly_rate} / hr` : 'Negotiable'}
            </Text>
          )}
        </Animated.View>

        {/* Edit mode save action */}
        {isEditing && (
          <TouchableOpacity 
            style={[styles.actionButton, { marginBottom: 20 }]}
            onPress={handleSaveBasicInfo}
          >
            <Text style={styles.actionButtonText}>Save Basic Info</Text>
          </TouchableOpacity>
        )}

        {/* Skills Section */}
        <Animated.View entering={FadeInUp.delay(250)} style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          
          {isOwnProfile && (
            <View style={styles.addSkillRow}>
              <TextInput
                style={styles.skillInput}
                placeholder="Add skill (e.g. React Native)"
                placeholderTextColor="#9CA3AF"
                value={newSkill}
                onChangeText={setNewSkill}
              />
              <TouchableOpacity style={styles.addSkillBtn} onPress={handleAddSkill}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {profile.skills.length === 0 ? (
            <Text style={styles.bioTextMuted}>No skills added yet.</Text>
          ) : (
            <View style={styles.skillsRow}>
              {profile.skills.map((skill, index) => (
                <View key={index} style={styles.skillPill}>
                  <Text style={styles.skillText}>{skill}</Text>
                  {isOwnProfile && (
                    <TouchableOpacity 
                      onPress={() => handleRemoveSkill(skill)}
                      style={styles.removeSkillBtn}
                    >
                      <Ionicons name="close-circle" size={14} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Work Experience Section */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
          <View style={styles.sectionHeaderWithAdd}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {isOwnProfile && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setActiveModal('work')}>
                <Ionicons name="add" size={20} color="#1E3A8A" />
              </TouchableOpacity>
            )}
          </View>
          
          {profile.work_experience.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No details added yet.</Text>
            </View>
          ) : (
            profile.work_experience.map((work, idx) => (
              <View key={idx} style={[styles.experienceCard, { marginBottom: 8 }]}>
                <Text style={styles.experienceRole}>{work.role}</Text>
                <Text style={styles.experienceCompany}>{work.company}</Text>
                <Text style={styles.experienceDates}>{work.dates}</Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* Education Section */}
        <Animated.View entering={FadeInUp.delay(350)} style={styles.section}>
          <View style={styles.sectionHeaderWithAdd}>
            <Text style={styles.sectionTitle}>Education</Text>
            {isOwnProfile && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setActiveModal('edu')}>
                <Ionicons name="add" size={20} color="#1E3A8A" />
              </TouchableOpacity>
            )}
          </View>

          {profile.education.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No details added yet.</Text>
            </View>
          ) : (
            profile.education.map((edu, idx) => (
              <View key={idx} style={[styles.experienceCard, { marginBottom: 8 }]}>
                <Text style={styles.experienceRole}>{edu.institution}</Text>
                <Text style={styles.experienceCompany}>{edu.degree}</Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* Certifications Section */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
          <View style={styles.sectionHeaderWithAdd}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {isOwnProfile && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setActiveModal('cert')}>
                <Ionicons name="add" size={20} color="#1E3A8A" />
              </TouchableOpacity>
            )}
          </View>

          {profile.certifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No details added yet.</Text>
            </View>
          ) : (
            profile.certifications.map((cert, idx) => (
              <View key={idx} style={[styles.experienceCard, { marginBottom: 8 }]}>
                <Text style={styles.experienceRole}>{cert.name}</Text>
                <Text style={styles.experienceCompany}>{cert.issuer}</Text>
              </View>
            ))
          )}
        </Animated.View>

        {/* Bottom Button Action */}
        {!isOwnProfile && (
          <Animated.View entering={FadeInUp.delay(450)} style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push({
                pathname: '/chat-detail',
                params: { userId: profile.id, name: profile.full_name }
              })}
            >
              <Text style={styles.actionButtonText}>Message {profile.full_name || 'User'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* WORK EXPERIENCE MODAL */}
      <Modal visible={activeModal === 'work'} animationType="fade" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeading}>Add Work Experience</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Role / Position"
                placeholderTextColor="#9CA3AF"
                value={workRole}
                onChangeText={setWorkRole}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Company"
                placeholderTextColor="#9CA3AF"
                value={workCompany}
                onChangeText={setWorkCompany}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Dates (e.g. Jan 2021 - Present)"
                placeholderTextColor="#9CA3AF"
                value={workDates}
                onChangeText={setWorkDates}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setActiveModal(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSaveBtn}
                  onPress={handleAddWorkExperience}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDUCATION MODAL */}
      <Modal visible={activeModal === 'edu'} animationType="fade" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeading}>Add Education</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Institution"
                placeholderTextColor="#9CA3AF"
                value={eduInstitution}
                onChangeText={setEduInstitution}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Degree / Course of Study"
                placeholderTextColor="#9CA3AF"
                value={eduDegree}
                onChangeText={setEduDegree}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setActiveModal(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSaveBtn}
                  onPress={handleAddEducation}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CERTIFICATIONS MODAL */}
      <Modal visible={activeModal === 'cert'} animationType="fade" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeading}>Add Certification</Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Certification Name"
                placeholderTextColor="#9CA3AF"
                value={certName}
                onChangeText={setCertName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Issuing Authority"
                placeholderTextColor="#9CA3AF"
                value={certIssuer}
                onChangeText={setCertIssuer}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancelBtn}
                  onPress={() => setActiveModal(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalSaveBtn}
                  onPress={handleAddCertification}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerActionBtn: {
    padding: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
  },
  profileCard: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextBlue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B82F6',
  },
  profileDetails: {
    marginLeft: 20,
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
    paddingVertical: 4,
  },
  bioInput: {
    fontSize: 15,
    fontWeight: '500',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  email: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 2,
    fontWeight: '500',
  },
  walletAddr: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 4,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderWithAdd: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  bioText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
  },
  bioTextMuted: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  rateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 6,
  },
  rateValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  addSkillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  skillInput: {
    flex: 1,
    backgroundColor: '#EAEAF2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  addSkillBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#405B8F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    backgroundColor: '#E5E7EB',
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  removeSkillBtn: {
    padding: 2,
  },
  experienceCard: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 18,
  },
  emptyCard: {
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'flex-start',
  },
  emptyCardText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  experienceRole: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  experienceCompany: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
    marginTop: 4,
  },
  experienceDates: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#405B8F',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#EAEAF2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#405B8F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
});
