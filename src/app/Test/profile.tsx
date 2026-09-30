import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { colors, fonts, type } from '../theme';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useState, useEffect } from 'react';
type Icon = keyof typeof Ionicons.glyphMap;
const ROWS: { icon: Icon; label: string }[] = [
  { icon: 'download-outline', label: 'Downloads' },
  { icon: 'options-outline', label: 'Playback settings' },
  { icon: 'pulse-outline', label: 'Voice preferences' },
  { icon: 'notifications-outline', label: 'Notifications' },
  { icon: 'help-circle-outline', label: 'Help & support' },
];

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }

    router.replace('/Test/welcome');
  };
  const getUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      Alert.alert('Failed to fetch user', error?.message || 'User not found');
      return;
    }
    else{
      return (user?.user_metadata?.username);
    }
  };

  const getEmail = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      Alert.alert('Failed to fetch user', error?.message || 'User not found');
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.h1}>Profile</Text>
          <Pressable style={s.gear}><Ionicons name="settings-outline" size={22} color={colors.text} /></Pressable>
        </View>

        <View style={{ alignItems: 'center', marginVertical: 24, gap: 6 }}>
          <View style={s.avatar}><Text style={{ fontFamily: fonts.sansBold, fontSize: 30, color: colors.dim }}>ZB</Text></View>
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
          {ROWS.map((r) => <Row key={r.label} icon={r.icon} label={r.label} onPress={() => console.log(`${r.label} pressed`)} />)}
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
  gear: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(214,123,176,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  stats: { flexDirection: 'row', borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  stat: { flex: 1, alignItems: 'center' },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  list: { marginTop: 18, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
