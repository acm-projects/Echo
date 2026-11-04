import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { FormField } from '../../components/FormField';
import { GradientButton } from '../../components/GradientButton';
import { HangingBat } from '../../components/night/Bat';
import { colors, fonts, type } from '../../../theme';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      notify('Check your email', 'Enter the email address you signed up with.');
      return;
    }
    setSending(true);
    // The link in the email opens reset-password, which reads the recovery tokens from the URL.
    const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: Linking.createURL('/Test/reset-password') });
    setSending(false);
    if (error) {
      notify('Could not send the link', error.message);
      return;
    }
    setSentTo(address);
  };

  return (
    <Screen scene="dusk">
      <PageHeader title="Reset password" fallback="/Test/login" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.body}>
        <View style={s.batRow}>
          <View style={s.perch} />
          <HangingBat size={34} style={{ marginTop: -2 }} />
        </View>
        {sentTo ? (
          <View style={{ gap: 10 }}>
            <Text style={s.heading}>Check your inbox</Text>
            <Text style={type.body}>We sent a reset link to <Text style={{ color: colors.text }}>{sentTo}</Text>. Open it on this device to choose a new password.</Text>
            <Text style={[type.meta, { marginTop: 8 }]}>Nothing yet? Look in spam, or try again in a minute.</Text>
            <GradientButton title="Send it again" onPress={send} loading={sending} style={{ marginTop: 18 }} />
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Text style={s.heading}>Forgot it? It happens.</Text>
              <Text style={type.body}>Enter your email and we'll send you a link to set a new password.</Text>
            </View>
            <FormField label="EMAIL" icon="mail-outline" placeholder="your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <GradientButton title="Send reset link" onPress={send} loading={sending} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  batRow: { alignItems: 'center', marginBottom: 22 },
  perch: { width: 70, height: 3, borderRadius: 2, backgroundColor: 'rgba(245,198,90,0.5)' },
  heading: { fontFamily: fonts.serif, fontSize: 28, color: colors.text },
});
