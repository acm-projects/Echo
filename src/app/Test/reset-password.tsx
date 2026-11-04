import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { FormField } from '../../components/FormField';
import { GradientButton } from '../../components/GradientButton';
import { colors, fonts, type } from '../../../theme';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

// Supabase puts the recovery tokens after '#' in the link. lib/supabase turns off detectSessionInUrl, so read them here.
function recoveryTokens(url: string | null) {
  const hash = url?.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token } : null;
}

export default function ResetPassword() {
  const url = Linking.useURL();
  const [ready, setReady] = useState<'checking' | 'ok' | 'expired'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : url;
    const tokens = recoveryTokens(current);
    if (!tokens) {
      // Opened without a link: fine if a recovery session already exists.
      supabase.auth.getSession().then(({ data }) => setReady(data.session ? 'ok' : 'expired'));
      return;
    }
    supabase.auth.setSession(tokens).then(({ error }) => setReady(error ? 'expired' : 'ok'));
  }, [url]);

  const save = async () => {
    if (password.length < 6) return notify('Too short', 'Use at least 6 characters.');
    if (password !== confirm) return notify('Passwords do not match', 'Enter the same password in both fields.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return notify('Could not update password', error.message);
    notify('Password updated', 'You are signed in with your new password.');
    router.replace('/Test/library');
  };

  return (
    <Screen scene="dusk">
      <PageHeader title="New password" fallback="/Test/login" />
      <View style={s.body}>
        {ready === 'expired' ? (
          <View style={{ gap: 10 }}>
            <Text style={s.heading}>This link has faded</Text>
            <Text style={type.body}>Reset links only work once and expire after an hour. Ask for a fresh one.</Text>
            <GradientButton title="Send a new link" onPress={() => router.replace('/Test/forgot-password')} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={[s.heading, { marginBottom: 14 }]}>Choose a new password</Text>
            <FormField label="NEW PASSWORD" icon="lock-closed-outline" placeholder="at least 6 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <FormField label="CONFIRM" icon="lock-closed-outline" placeholder="type it again" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            <GradientButton title="Save password" onPress={save} loading={saving || ready === 'checking'} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  heading: { fontFamily: fonts.serif, fontSize: 28, color: colors.text },
});
