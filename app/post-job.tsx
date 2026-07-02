import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
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
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';

export default function PostJobScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [salaryScale, setSalaryScale] = useState('per month');
  const [operationMode, setOperationMode] = useState<'REMOTE' | 'ONSITE' | 'HYBRID'>('REMOTE');
  const [contractType, setContractType] = useState<'FULL TIME' | 'CONTRACT'>('FULL TIME');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showSalaryScaleDropdown, setShowSalaryScaleDropdown] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);

  const handleSelectImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    if (!user) return null;
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
      const fileName = `job_${user.id}_${Date.now()}.${fileExt}`;
      
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
      console.error('Error during image upload:', e);
      Alert.alert('Upload Error', `Failed to upload image: ${e.message || e}`);
      return null;
    }
  };

  const handlePublishJob = async () => {
    if (!title.trim() || !description.trim() || !applicationUrl.trim()) {
      Alert.alert('Error', 'Job Title, Description, and Application URL are required fields.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to post a job.');
      return;
    }

    setLoading(true);
    try {
      let finalImageUrl = null;
      if (imageUri) {
        finalImageUrl = await uploadImageToStorage(imageUri);
        if (!finalImageUrl) {
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.from('jobs').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        salary: salary ? parseFloat(salary) : null,
        salary_scale: salaryScale.trim(),
        currency: currency.trim(),
        operation_mode: operationMode,
        contract_type: contractType,
        application_url: applicationUrl.trim(),
        image_url: finalImageUrl,
      });

      if (error) throw error;

      Alert.alert('Success', 'Job listing posted successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post job listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.duration(600)} style={styles.form}>
          {/* Logo / Image Picker */}
          <View style={styles.imagePickerContainer}>
            <Text style={styles.sectionLabel}>Company Logo / Job Image</Text>
            <TouchableOpacity style={styles.imagePickerBox} onPress={handleSelectImage}>
              {imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <View style={styles.changeImageOverlay}>
                    <Ionicons name="camera" size={20} color="#FFFFFF" />
                    <Text style={styles.changeImageText}>Change Image</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.pickerPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.pickerPlaceholderText}>Upload Company Logo or Job Image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Job Title */}
          <TextInput 
            style={styles.input} 
            placeholder="Job Title *"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          {/* Job Description */}
          <TextInput 
            style={[styles.input, styles.textArea]} 
            placeholder="Job Description *"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          {/* Salary and Currency row */}
          <View style={[styles.row, { zIndex: 3000 }]}>
            <TextInput 
              style={[styles.input, styles.halfInput]} 
              placeholder="Salary"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={salary}
              onChangeText={setSalary}
            />
            <View style={{ position: 'relative', zIndex: 3000 }}>
              <TouchableOpacity 
                style={styles.dropdown} 
                onPress={() => {
                  setShowCurrencyDropdown(!showCurrencyDropdown);
                  setShowSalaryScaleDropdown(false);
                }}
              >
                <Text style={styles.dropdownText}>{currency}</Text>
                <Ionicons name={showCurrencyDropdown ? "chevron-up" : "chevron-down"} size={16} color="#4B5563" />
              </TouchableOpacity>
              
              {showCurrencyDropdown && (
                <View style={styles.dropdownMenu}>
                  {['USD', 'EUR', 'GBP', 'NGN', 'CYN', 'CAD'].map((item) => (
                    <TouchableOpacity 
                      key={item} 
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCurrency(item);
                        setShowCurrencyDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        currency === item && styles.dropdownItemTextActive
                      ]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Salary Scale */}
          <View style={{ zIndex: 2000, position: 'relative' }}>
            <TouchableOpacity 
              style={styles.salaryScaleDropdown}
              onPress={() => {
                setShowSalaryScaleDropdown(!showSalaryScaleDropdown);
                setShowCurrencyDropdown(false);
              }}
            >
              <Text style={styles.salaryScaleDropdownText}>
                {salaryScale || 'Select Salary Scale'}
              </Text>
              <Ionicons name={showSalaryScaleDropdown ? "chevron-up" : "chevron-down"} size={18} color="#4B5563" />
            </TouchableOpacity>

            {showSalaryScaleDropdown && (
              <View style={styles.salaryScaleMenu}>
                {['per month', 'per project', 'per week'].map((item) => (
                  <TouchableOpacity 
                    key={item} 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSalaryScale(item);
                      setShowSalaryScaleDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      salaryScale === item && styles.dropdownItemTextActive
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Operation Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Operation Mode</Text>
            <View style={styles.pillsRow}>
              {['REMOTE', 'ONSITE', 'HYBRID'].map((mode) => {
                const isActive = mode === operationMode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                    onPress={() => setOperationMode(mode as any)}
                  >
                    <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Contract Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Contract Type</Text>
            <View style={styles.pillsRow}>
              {['FULL TIME', 'CONTRACT'].map((type) => {
                const isActive = type === contractType;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                    onPress={() => setContractType(type as any)}
                  >
                    <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Application URL */}
          <TextInput 
            style={styles.input} 
            placeholder="Application URL (External link) *"
            placeholderTextColor="#9CA3AF"
            keyboardType="url"
            autoCapitalize="none"
            value={applicationUrl}
            onChangeText={setApplicationUrl}
          />

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handlePublishJob}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Publish Job</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  dropdown: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  salaryScaleDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  salaryScaleDropdownText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 9999,
  },
  salaryScaleMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 9999,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#6366F1', // Primary indigo accent
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#DCE4F9', // active light blue from mockup 3
    borderColor: '#9CA3AF',
  },
  pillInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#9CA3AF',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#1E3A8A',
  },
  pillTextInactive: {
    color: '#4B5563',
  },
  submitButton: {
    backgroundColor: '#405B8F',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  imagePickerContainer: {
    marginBottom: 8,
  },
  imagePickerBox: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderStyle: 'dashed',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  pickerPlaceholderText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
});
