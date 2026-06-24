import { StyledInput } from '@/components/StyledInput';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';

export default function SignupScreen() {
  const router = useRouter();
  const { isReady, user } = usePrivy();
  const authenticated = !!user;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      setIsCodeSent(true);
      setLoading(false);
    },
    onLoginSuccess: (user) => {
      // Post-signup logic (like saving fullName to Supabase) would go here
      setLoading(false);
    },
    onError: (error) => {
      Alert.alert('Auth Error', error.message);
      setLoading(false);
    }
  });

  // If already authenticated, redirecting happens in _layout, but we show loading here
  if (isReady && authenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={{ marginTop: 16, color: '#6B7280' }}>Signing you in...</Text>
        </View>
      </View>
    );
  }

  const handleAuth = async () => {
    if (!email || (!isCodeSent && !fullName)) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      if (!isCodeSent) {
        await sendCode({ email });
      } else {
        if (!otp) {
          Alert.alert('Error', 'Please enter the verification code.');
          setLoading(false);
          return;
        }
        await loginWithCode({ code: otp, email });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <Animated.View entering={FadeInUp.duration(600)} style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/images/img.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {isCodeSent ? `Verify your email to join\n${email}` : 'Join SkillChain to start your Web3 journey'}
            </Text>
          </View>

          <View style={styles.form}>
            {!isCodeSent ? (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.inputGroup}>
                <StyledInput
                  placeholder="Your Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <StyledInput
                  placeholder="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.otpSection}>
                <StyledInput
                  placeholder="6-digit code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity onPress={() => setIsCodeSent(false)} style={styles.backLink}>
                  <Ionicons name="arrow-back" size={14} color={Theme.colors.primary} />
                  <Text style={styles.backLinkText}>Change email or name</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isCodeSent ? 'Verify & Get Started' : 'Join SkillChain'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.loginRedirect}
              onPress={() => router.push('/(auth)/login')}
              disabled={loading}
            >
              <Text style={styles.loginRedirectText}>
                Already have an account? <Text style={styles.loginRedirectTextBold}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 12,
  },
  otpSection: {
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  backLinkText: {
    color: Theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 40,
  },
  loginRedirect: {
    paddingVertical: 8,
  },
  loginRedirectText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  loginRedirectTextBold: {
    color: Theme.colors.text,
    fontWeight: '700',
  },
});
