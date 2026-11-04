
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '../../../theme';
import { supabase } from '../../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const STARS = [
  { x: 0.12, y: 0.08, size: 3 },
  { x: 0.81, y: 0.13, size: 2 },
  { x: 0.22, y: 0.25, size: 2 },
  { x: 0.89, y: 0.32, size: 3 },
  { x: 0.08, y: 0.44, size: 2 },
  { x: 0.76, y: 0.50, size: 2 },
  { x: 0.14, y: 0.68, size: 3 },
  { x: 0.87, y: 0.72, size: 2 },
] as const;

const ADDITIONAL_STARS = [
  { x: 0.27, y: 0.06, size: 2, delay: 150 },
  { x: 0.24, y: 0.17, size: 3, delay: 450 },
  { x: 0.75, y: 0.07, size: 2, delay: 750 },
  { x: 0.91, y: 0.17, size: 3, delay: 1050 },
  { x: 0.77, y: 0.22, size: 2, delay: 1350 },
  { x: 0.97, y: 0.23, size: 2, delay: 1650 },
] as const;

function TwinklingStar({
  x,
  y,
  size,
  delay,
  width,
  height,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  width: number;
  height: number;
}) {
  const twinkle = useRef(
    new Animated.Value(0.18)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(twinkle, {
          toValue: 0.6,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0.18,
          duration: 2100,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, twinkle]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: width * x,
        top: height * y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F7E2BE',
        opacity: twinkle,
      }}
    />
  );
}

function TwinklingStars({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const twinkle = useRef(
    new Animated.Value(0.35)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 0.85,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0.35,
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [twinkle]);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.stars,
      ]}
    >
      {STARS.filter((star) => star.y <= 0.3).map((star, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            left: width * star.x,
            top: height * star.y,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#F7E2BE',
            opacity: twinkle,
          }}
        />
      ))}
      {ADDITIONAL_STARS.map((star, index) => (
        <TwinklingStar
          key={`additional-${index}`}
          {...star}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

export default function Login() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loginError, setLoginError] = useState('');

  const logoFloat = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -7,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [logoFloat]);

  // Supabase authentication
  const handleLogin = async () => {
    if (loading) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      Alert.alert(
        'Missing information',
        'Please enter your email and password.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        setLoginError(error.message);
        Alert.alert(
          'Login failed',
          error.message
        );
        return;
      }

      router.replace('/Test/player');
    } catch {
      Alert.alert(
        'Something went wrong',
        'Please try signing in again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Back always goes to Welcome, not navigation history
  const handleBack = () => {
    router.replace('/Test/welcome');
  };

  const logoSize = Math.min(width * 0.32, 125);

  const cloudHeight = Math.min(
    height * 0.28,
    270
  );

  return (
    <View style={styles.screen}>
      {/* Night sky */}
      <TwinklingStars
        width={width}
        height={height}
      />

      {/* Decorative clouds behind everything */}
      <View
        pointerEvents="none"
        style={styles.cloudContainer}
      >
        <Image
          source={require('../../../assets/images/echo-cloud-frame.png')}
          resizeMode="stretch"
          style={{
            width,
            height: cloudHeight,
            opacity: 0.9,
          }}
        />
      </View>

      {/* Back button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={handleBack}
        style={[
          styles.backButton,
          { top: insets.top + 12 },
        ]}
      >
        <Ionicons
          name="arrow-back"
          size={23}
          color={colors.text}
        />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            <View style={styles.header}>
              {/* Echo moon and bat logo */}
              <Animated.View
                style={{
                  transform: [
                    { translateY: logoFloat },
                  ],
                }}
              >
                <Image
                  source={require('../../../assets/images/echo-logo.png')}
                  resizeMode="contain"
                  style={{
                    width: logoSize,
                    height: logoSize,
                  }}
                />
              </Animated.View>

              <Text style={styles.logoText}>
                Echo
              </Text>

              <Text style={styles.subtitle}>
                Your next story is waiting
              </Text>
            </View>

            {/* Login fields */}
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View
                  style={[
                    styles.inputBox,
                    emailFocused && styles.inputFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#C5ACDD"
                  />
                  <TextInput
                    placeholder="name@example.com"
                    placeholderTextColor={colors.dim}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setLoginError('');
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View
                  style={[
                    styles.inputBox,
                    passwordFocused && styles.inputFocused,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#C5ACDD"
                  />
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor={colors.dim}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setLoginError('');
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    style={styles.input}
                  />
                  <Pressable
                    onPress={() =>
                      setShow((current) => !current)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      show
                        ? 'Hide password'
                        : 'Show password'
                    }
                    hitSlop={12}
                  >
                    <Ionicons
                      name={
                        show
                          ? 'eye-outline'
                          : 'eye-off-outline'
                      }
                      size={20}
                      color="#BDA5D3"
                    />
                  </Pressable>
                </View>
              </View>

              {loginError ? (
                <Text style={styles.loginError}>
                  {loginError === 'Invalid login credentials'
                    ? "That email and password don't match. Try again?"
                    : loginError}
                </Text>
              ) : null}

              <Pressable
                style={styles.forgotPassword}
                hitSlop={12}
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Password reset',
                    'Password reset is not set up yet.'
                  )
                }
              >
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </Pressable>

              {/* Sign in */}
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.signInButton,
                  pressed && styles.pressed,
                  loading && styles.loading,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    color="#29123C"
                  />
                ) : (
                  <Text style={styles.signInText}>
                    Login
                  </Text>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  or
                </Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Signup button */}
              <Pressable
                onPress={() =>
                  router.push('/Test/signup')
                }
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.signUpButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.signUpText}>
                  Create account
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#170033',
    overflow: 'hidden',
  },

  keyboardView: {
    flex: 1,
    zIndex: 2,
  },

  stars: {
    zIndex: 0,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },

  mainContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  header: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },

  cloudContainer: {
    position: 'absolute',
    bottom: -25,
    left: 0,
    right: 0,
    zIndex: 0,
  },

  backButton: {
    position: 'absolute',
    left: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor:
      'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },

  logoText: {
    fontFamily: fonts.display,
    fontSize: 46,
    color: '#F1A8CF',
    lineHeight: 58,
    letterSpacing: 0.5,
    paddingBottom: 8,
    marginTop: -6,
    textShadowColor: 'rgba(241,168,207,0.42)',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 18,
  },

  subtitle: {
    fontFamily: fonts.tagline,
    fontSize: 17,
    lineHeight: 24,
    color: colors.dim,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  },

  form: {
    width: '100%',
    maxWidth: 420,
  },

  field: {
    marginBottom: 20,
  },

  fieldLabel: {
    fontFamily: fonts.button,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.085)',
    borderWidth: 1,
    borderColor: colors.border,
  },

  inputFocused: {
    borderColor: colors.pink,
    shadowColor: colors.pink,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 3,
  },

  input: {
    flex: 1,
    minHeight: 56,
    color: colors.text,
    fontFamily: fonts.tagline,
    fontSize: 16,
  },

  loginError: {
    fontFamily: fonts.tagline,
    fontSize: 14,
    color: colors.danger,
    marginTop: -4,
    marginBottom: 8,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 20,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  forgotText: {
    fontFamily: fonts.button,
    color: colors.rose,
    fontSize: 14,
  },

  signInButton: {
    backgroundColor: '#DF87B6',
    minHeight: 56,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#EFA2CB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.pink,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  signInText: {
    fontFamily: fonts.button,
    fontSize: 17,
    letterSpacing: 0.3,
    color: '#29123C',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(243,233,255,0.22)',
  },

  dividerText: {
    fontFamily: fonts.tagline,
    fontSize: 13,
    color: '#CBB6E0',
  },

  signUpButton: {
    minHeight: 56,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#E894C5',
    backgroundColor: 'rgba(23,0,51,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signUpText: {
    fontFamily: fonts.button,
    fontSize: 17,
    color: '#F1A8CF',
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  loading: {
    opacity: 0.78,
  },
});
