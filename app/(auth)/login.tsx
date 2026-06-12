import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Theme } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { StyledInput } from '@/components/StyledInput';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from '@privy-io/expo';

export default function LoginScreen() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);

  // If already authenticated, don't show the login form
  if (ready && authenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>You are already logged in. Redirecting...</Text>
        </View>
      </View>
    );
  }

  const { sendCode, loginWithCode } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      setIsCodeSent(true);
      setLoading(false);
    },
    onLoginSuccess: (user) => {
      setLoading(false);
    },
    onError: (error) => {
      Alert.alert('Auth Error', error.message);
      setLoading(false);
    }
  });

  const { login: loginWithGoogle } = useLoginWithOAuth({
    onSuccess: (user) => {
      // Handled by _layout
    },
    onError: (error) => {
      if (error.message.includes('not allowed')) {
        Alert.alert('Configuration Required', 'Login with Google must be enabled in your Privy Dashboard (Authentication > Social Login).');
      } else {
        Alert.alert('Login Error', error.message);
      }
    }
  });

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle({ 
        provider: 'google',
        redirectUrl: 'skillchain://privy' 
      });
    } catch (e: any) {
      Alert.alert('Login Error', e.message);
    }
  };

  const handleAuth = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email.');
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
              <Ionicons name="flash" size={40} color={Theme.colors.primary} />
            </View>
            <Text style={styles.title}>SkillChain</Text>
            <Text style={styles.subtitle}>
              {isCodeSent ? `Verification code sent to\n${email}` : 'Sign in to access the future of work'}
            </Text>
          </View>

          <View style={styles.form}>
            {!isCodeSent ? (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <StyledInput
                  placeholder="name@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.otpSection}>
                <StyledInput
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity onPress={() => setIsCodeSent(false)} style={styles.backLink}>
                  <Ionicons name="arrow-back" size={14} color={Theme.colors.primary} />
                  <Text style={styles.backLinkText}>Use a different email</Text>
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
                  {isCodeSent ? 'Verify and Continue' : 'Continue with Email'}
                </Text>
              )}
            </TouchableOpacity>

            {!isCodeSent && (
              <>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>SECURE LOGIN</Text>
                  <View style={styles.line} />
                </View>

                <TouchableOpacity 
                  style={styles.socialButton}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                >
                  <Ionicons name="logo-google" size={20} color="#1F2937" />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By joining, you agree to our <Text style={styles.footerLink}>Terms</Text> and <Text style={styles.footerLink}>Privacy Policy</Text>.
            </Text>
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
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Theme.colors.textMuted,
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 100,
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
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  otpSection: {
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
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
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  socialButton: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  socialButtonText: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 40,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: '#6B7280',
    fontWeight: '600',
  },
});
