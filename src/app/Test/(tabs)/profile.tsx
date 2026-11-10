import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '../../../../lib/notify';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../components/Screen';
import { colors, fonts, type } from '../../../../theme';
import { useRouter, type Href } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useState, useEffect } from 'react';
type Icon = keyof typeof Ionicons.glyphMap;
const ROWS: { icon: Icon; label: string; href: Href }[] = [
  { icon: 'download-outline', label: 'Downloads', href: '/Test/downloads' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/Test/notification-settings' },
  { icon: 'sparkles-outline', label: 'Animations', href: '/Test/animation-settings' },
  { icon: 'help-circle-outline', label: 'Help & support', href: '/Test/help' },
];

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      notify('Sign out failed', error.message);
      return;
    }

    router.replace('/Test/welcome');
  };
  const getUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      notify('Failed to fetch user', error?.message || 'User not found');
      return;
    }
    else{
      return (user?.user_metadata?.username);
    }
  };

  const getEmail = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      notify('Failed to fetch user', error?.message || 'User not found');
      return;
    }
    else{
      return (user?.user_metadata?.email);
    }
  };
  useEffect(() => {
    const loadUser = async () => {
      const username = await getUser();
      const email = await getEmail();
      if (username) {
        setUser(username);
      }
      if (email) {
        setEmail(email);
      }
    };
    loadUser();
  }, []);


  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={type.h1}>Profile</Text>

        <View style={{ alignItems: 'center', marginVertical: 24, gap: 6 }}>
          <View style={s.avatar}>
            <Text
              style={{
                fontFamily: fonts.sansBold,
                fontSize: 30,
                color: colors.dim,
              }}>
              {user.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.text }}>{user}</Text>
          <Text style={type.body}>{email}</Text>
        </View>

        <View style={s.stats}>
          {[['12', 'Books'], ['148', 'Hours'], ['8', 'Day streak']].map(([n, l], i) => (
            <View key={l} style={[s.stat, i > 0 && s.divider]}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 28, color: colors.text }}>{n}</Text>
              <Text style={type.meta}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={s.list}>
          {ROWS.map((r) => <Row key={r.label} icon={r.icon} label={r.label} onPress={() => router.push(r.href)} />)}
          <Row icon="log-out-outline" label="Sign out" danger last onPress={handleSignOut} />
        </View>
        <Text style={[type.meta, { textAlign: 'center', marginTop: 20 }]}>Echo 2.4.0</Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, danger, last, onPress }: { icon: Icon; label: string; danger?: boolean; last?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.row, !last && s.rowLine]} onPress={onPress}>
      <View style={s.rowIcon}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.blue} /></View>
      <Text style={{ flex: 1, fontFamily: fonts.sansMd, fontSize: 16, color: danger ? colors.danger : colors.text }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(214,123,176,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stats: { flexDirection: 'row', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  stat: { flex: 1, alignItems: 'center' },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  list: { marginTop: 18, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
