import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/constants/Supabase';
import { usePrivy } from '@privy-io/expo';

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
});
