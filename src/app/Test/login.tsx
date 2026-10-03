import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { Screen } from '../components/Screen';
import { FormField } from '../components/FormField';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, type } from '../../../theme';
import { supabase } from '../../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      router.replace('/Test/player');
    }
  };

  return (
    <Screen style={{ paddingHorizontal: 28 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 18,
          marginTop: 16,
        }}
      >
        <Ionicons
          name="moon"
          size={56}
          color={colors.gold}
        />

        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 36,
            letterSpacing: 8,
            color: colors.pink,
          }}
        >
          Echo
        </Text>
      </View>

      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: 30,
          color: colors.text,
          marginTop: 36,
          marginBottom: 28,
        }}
      >
        Welcome back
      </Text>

      <FormField
        label="EMAIL"
        icon="mail-outline"
        placeholder="your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
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
            onPress={() => setShow(!show)}
            hitSlop={10}
          >
            <Ionicons
              name={show ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.faint}
            />
          </Pressable>
        }
      />

      <Pressable
        style={{
          alignSelf: 'flex-end',
          marginBottom: 20,
        }}
      >
        <Text style={type.body}>
          Forgot password?
        </Text>
      </Pressable>

      <GradientButton
        title="SIGN IN"
        onPress={handleLogin}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginVertical: 22,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border,
          }}
        />

        <Text style={type.meta}>or</Text>

        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: colors.border,
          }}
        />
      </View>

      <GradientButton
        title="New here? Create account"
        variant="outline"
        onPress={() => router.push('./signup')}
      />
    </Screen>
  );
}