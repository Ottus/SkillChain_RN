import { StyledInput } from '@/components/StyledInput';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';

export default function LoginScreen() {
  const router = useRouter();
  const { isReady, user } = usePrivy();
  const authenticated = !!user;
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
      setLoading(false);
      // layout listener handles redirection
    },
    onError: (error) => {
      Alert.alert('Authentication Error', error.message);
      setLoading(false);
    }
  });

  const { login: loginWithGoogle } = useLoginWithOAuth({
    onSuccess: (user) => {
      // layout listener handles redirection
    },
    onError: (error) => {
      if (error.message.includes('not allowed')) {
        Alert.alert('Configuration Required', 'Google Login must be enabled in the Privy Dashboard.');
      } else {
        Alert.alert('Login Error', error.message);
      }
    }
  });

  // If already authenticated, redirecting is handled by _layout
  if (isReady && authenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Restoring your session...</Text>
        </View>
      </View>
    );
  }

  const handleAuth = async () => {
    if (!email) {
      Alert.alert('Required', 'Please enter your email address to continue.');
      return;
    }

    setLoading(true);
    try {
      if (!isCodeSent) {
        await sendCode({ email });
      } else {
        if (!otp) {
          Alert.alert('Required', 'Please enter the 6-digit verification code.');
          setLoading(false);
          return;
        }
        await loginWithCode({ code: otp, email });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <Animated.View entering={FadeInUp.duration(800)} style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image source={require('../../assets/images/img.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.title}>SkillChain</Text>
            <Text style={styles.subtitle}>
              {isCodeSent 
                ? `Enter the code we sent to\n${email}` 
                : 'Connect your identity and start building in Web3'}
            </Text>
          </View>

          <View style={styles.formContainer}>
            {!isCodeSent ? (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <StyledInput
                  placeholder="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.otpSection}>
                <StyledInput
                  placeholder="6-Digit Code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity onPress={() => setIsCodeSent(false)} style={styles.changeEmail}>
                  <Ionicons name="arrow-back" size={12} color={Theme.colors.primary} />
                  <Text style={styles.changeEmailText}>Use a different email</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonLoading]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isCodeSent ? 'Verify Identity' : 'Continue with Email'}
                </Text>
              )}
            </TouchableOpacity>

            {!isCodeSent && (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>SECURE CONNECT</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity 
                  style={styles.googleButton}
                  onPress={() => loginWithGoogle({ provider: 'google' })}
                  disabled={loading}
                >
                  <Ionicons name="logo-google" size={20} color="#1F2937" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Securely powered by <Text style={styles.privyText}>Privy</Text>
            </Text>
            <View style={styles.termsRow}>
              <TouchableOpacity><Text style={styles.termsText}>Terms</Text></TouchableOpacity>
              <View style={styles.dot} />
              <TouchableOpacity><Text style={styles.termsText}>Privacy</Text></TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 100,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoWrapper: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 280,
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  otpSection: {
    gap: 10,
  },
  changeEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  changeEmailText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonLoading: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  googleButton: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: 60,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  privyText: {
    color: '#111827',
    fontWeight: '800',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  termsText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
});
