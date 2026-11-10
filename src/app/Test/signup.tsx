
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '../../components/FormField';
import { colors, fonts } from '../../../theme';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

// Subtle stars matching the login screen
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

// Animated nighttime stars
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

export default function Signup() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const logoFloat = useRef(
    new Animated.Value(0)
  ).current;

  // Gently float the moon and sleeping bat
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

  // Preserve Supabase signup functionality
  const handleSignup = async () => {
    if (loading) return;

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (
      !cleanUsername ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      notify(
        'Missing information',
        'Please complete all fields.'
      );
      return;
    }

    if (password !== confirmPassword) {
      notify(
        'Passwords do not match',
        'Enter the same password in both fields.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
          },
        },
      });

      if (error) {
        notify('Sign up failed', error.message);
        return;
      }

      if (!data.session) {
        notify(
          'Check your email',
          'Your account request was received. If email confirmation is enabled, follow the verification link before signing in.'
        );
      } else {
        notify(
          'Account created',
          'Your Echo account has been created.'
        );
      }

      router.replace('/Test/login');
    } catch {
      notify(
        'Something went wrong',
        'Unable to create your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Consistent navigation
  const handleBack = () => {
    router.replace('/Test/welcome');
  };

  const logoSize = Math.min(width * 0.24, 100);
  const cloudHeight = Math.min(height * 0.28, 270);

  return (
    <View style={styles.screen}>
      {/* Decorative stars */}
      <TwinklingStars width={width} height={height} />

      {/* Illustrated clouds */}
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

      {/* Back arrow always returns to welcome */}
      <Pressable
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Back to welcome"
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
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 42,
              paddingBottom: insets.bottom + 20,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            {/* Floating logo */}
            <Animated.View
              style={{
                transform: [{ translateY: logoFloat }],
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

            {/* Echo wordmark */}
            <Text style={styles.logoText}>Echo</Text>

            <Text style={styles.subtitle}>
              Start building your listening world
            </Text>

            <View style={styles.ornament}>
              <View style={styles.ornamentLine} />
              <Text style={styles.smallMoon}>☾</Text>
              <View style={styles.ornamentLine} />
            </View>

            {/* Signup fields */}
            <View style={styles.form}>
              <View style={styles.compactField}>
                <FormField
                  label="Username"
                  icon="person-outline"
                  placeholder="Choose a username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.compactField}>
                <FormField
                  label="Email"
                  icon="mail-outline"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.compactField}>
                <FormField
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="Create a password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  right={
                    <Pressable
                      onPress={() =>
                        setShowPassword((value) => !value)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      hitSlop={10}
                    >
                      <Ionicons
                        name={
                          showPassword
                            ? 'eye-outline'
                            : 'eye-off-outline'
                        }
                        size={20}
                        color="#BDA5D3"
                      />
                    </Pressable>
                  }
                />
              </View>

              <View style={styles.compactField}>
                <FormField
                  label="Confirm password"
                  icon="lock-closed-outline"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  right={
                    <Pressable
                      onPress={() =>
                        setShowConfirmPassword((value) => !value)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        showConfirmPassword
                          ? 'Hide password confirmation'
                          : 'Show password confirmation'
                      }
                      hitSlop={10}
                    >
                      <Ionicons
                        name={
                          showConfirmPassword
                            ? 'eye-outline'
                            : 'eye-off-outline'
                        }
                        size={20}
                        color="#BDA5D3"
                      />
                    </Pressable>
                  }
                />
              </View>

              {/* Create account button */}
              <Pressable
                onPress={handleSignup}
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.createButton,
                  (pressed || loading) && styles.pressed,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#29123C" />
                ) : (
                  <Text style={styles.createButtonText}>
                    Create account
                  </Text>
                )}
              </Pressable>

              {/* Navigate to login */}
              <Pressable
                onPress={() =>
                  router.replace('/Test/login')
                }
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.signInButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.signInText}>
                  Already have an account? Login
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },

  logoText: {
    fontFamily: fonts.wordmark,
    fontSize: 42,
    color: '#F1A8CF',
    letterSpacing: 0.5,
    lineHeight: 58,
    paddingBottom: 8,
    marginTop: -5,
  },

  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 18,
  },

  ornamentLine: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(245,198,90,0.5)',
  },

  smallMoon: {
    fontSize: 15,
    color: colors.gold,
  },

  subtitle: {
    fontFamily: fonts.tagline,
    fontSize: 17,
    color: colors.dim,
    textAlign: 'center',
    marginTop: 2,
  },

  form: {
    width: '100%',
    maxWidth: 420,
  },

  compactField: {
    marginBottom: -12,
  },

  createButton: {
    backgroundColor: '#DF87B6',
    minHeight: 56,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#EFA2CB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    elevation: 3,
  },

  createButtonText: {
    fontFamily: fonts.button,
    fontSize: 17,
    letterSpacing: 0.3,
    color: '#29123C',
  },

  signInButton: {
    minHeight: 56,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#E894C5',
    backgroundColor: 'rgba(55,24,83,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 10,
  },

  signInText: {
    fontFamily: fonts.button,
    fontSize: 17,
    color: '#F1A8CF',
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
