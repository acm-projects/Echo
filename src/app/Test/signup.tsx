import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { FormField } from '../components/FormField';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, type } from '../../../theme';
import { supabase } from '../../../lib/supabase';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Missing information', 'Please complete all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() } },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    Alert.alert('Account created', 'You can now sign in to Echo.');
    router.replace('/Test/login');
  };

  return (
    <Screen style={{ paddingHorizontal: 28 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Ionicons name="moon" size={56} color={colors.gold} />
            <Text style={{ fontFamily: fonts.serif, fontSize: 36, letterSpacing: 8, color: colors.pink }}>Echo</Text>
          </View>

          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.text, marginTop: 28 }}>Create your account</Text>
          <Text style={[type.body, { marginBottom: 24 }]}>Start building your listening world</Text>

          <FormField
            label="USERNAME"
            icon="person-outline"
            placeholder="your username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
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
            secureTextEntry={!showPassword}
            right={<Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={10}><Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.faint} /></Pressable>}
          />
          <FormField
            label="CONFIRM PASSWORD"
            icon="lock-closed-outline"
            placeholder="confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            right={<Pressable onPress={() => setShowConfirmPassword((value) => !value)} hitSlop={10}><Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.faint} /></Pressable>}
          />

          <GradientButton title={loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'} onPress={handleSignup} />
          <GradientButton title="Already have an account? Sign in" variant="outline" onPress={() => router.replace('/Test/login')} style={{ marginTop: 14 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}