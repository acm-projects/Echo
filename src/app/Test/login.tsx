
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
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '../components/FormField';
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
      style={StyleSheet.absoluteFill}
    >
      {STARS.map((star, index) => (
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

  const logoSize = Math.min(
    width * 0.38,
    155
  );

  const compact = height < 720;

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
        accessibilityLabel="Back to welcome"
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
              paddingTop: insets.top + 65,
              paddingBottom: insets.bottom + 35,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
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

            <View style={styles.ornament}>
              <View style={styles.ornamentLine} />

              <Text style={styles.smallMoon}>
                ☾
              </Text>

              <View style={styles.ornamentLine} />
            </View>

            <Text
              style={[
                styles.welcomeTitle,
                {
                  marginTop: compact ? 18 : 25,
                },
              ]}
            >
              Welcome back
            </Text>

            <Text style={styles.subtitle}>
              Your next story is waiting
            </Text>

            {/* Login fields */}
            <View style={styles.form}>
              <FormField
                label="EMAIL"
                icon="mail-outline"
                placeholder="your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <FormField
                label="PASSWORD"
                icon="lock-closed-outline"
                placeholder="password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                right={
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
                    hitSlop={10}
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
                }
              />

              {/* Password recovery left unchanged */}
              <Pressable
                style={styles.forgotPassword}
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
                  (pressed || loading) &&
                    styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    color="#29123C"
                  />
                ) : (
                  <Text style={styles.signInText}>
                    SIGN IN
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
                  New here? Create account
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
    fontFamily: fonts.serif,
    fontSize: 46,
    color: '#F1A8CF',
    letterSpacing: 3,
    marginTop: -5,
    textShadowColor:
      'rgba(241,168,207,0.4)',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 15,
  },

  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 7,
  },

  ornamentLine: {
    width: 32,
    height: 1,
    backgroundColor:
      'rgba(245,198,90,0.5)',
  },

  smallMoon: {
    fontSize: 15,
    color: colors.gold,
  },

  welcomeTitle: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: '#F3D8F1',
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: '#CBB6E0',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 25,
  },

  form: {
    width: '100%',
    maxWidth: 420,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 0,
    marginBottom: 15,
    paddingVertical: 5,
  },

  forgotText: {
    fontFamily: fonts.sansMd,
    color: '#E7A2CD',
    fontSize: 13,
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
    fontFamily: fonts.sansBold,
    fontSize: 15,
    letterSpacing: 2,
    color: '#29123C',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    fontFamily: fonts.sansMd,
    fontSize: 13,
    color: '#CBB6E0',
  },

  signUpButton: {
    minHeight: 56,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#E894C5',
    backgroundColor:
      'rgba(55,24,83,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  signUpText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: '#F1A8CF',
  },

  pressed: {
    opacity: 0.78,
  },
});
