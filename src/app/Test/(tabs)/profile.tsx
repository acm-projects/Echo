import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { confirm, notify } from '../../../../lib/notify';
import { Screen } from '../../../components/Screen';
import { colors, fonts, type } from '../../../../theme';
import { supabase } from '../../../../lib/supabase';
import { getMyBooks, getMyStreak } from '../../../data';
import { getMyProfile } from '../../../../lib/db/profile';
import { Avatar } from '../../../components/Avatar';
import { removeAvatar, uploadAvatar } from '../../../data/avatars';

type Icon = keyof typeof Ionicons.glyphMap;
const ROWS: { icon: Icon; label: string; href: Href }[] = [
  { icon: 'download-outline', label: 'Downloads', href: '/Test/downloads' },
  { icon: 'notifications-outline', label: 'Notifications', href: '/Test/notification-settings' },
  { icon: 'sparkles-outline', label: 'Animations', href: '/Test/animation-settings' },
  { icon: 'help-circle-outline', label: 'Help & support', href: '/Test/help' },
];

// Whole hours listened, from the streak's running total; under an hour shows as "<1".
const hoursLabel = (seconds: number) => (seconds < 3600 ? (seconds > 0 ? '<1' : '0') : String(Math.floor(seconds / 3600)));

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');
  const [stats, setStats] = useState<{ books: number; hours: string; streak: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [savingPicture, setSavingPicture] = useState(false);

  // Reloaded each time the tab is shown, so a book finished or a chapter listened to elsewhere counts straight away.
  useFocusEffect(useCallback(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const account = data.session?.user;
      setUser(account?.user_metadata?.username ?? account?.email?.split('@')[0] ?? '');
      setEmail(account?.email ?? '');
      setUserId(account?.id ?? null);
      if (account) getMyProfile(supabase).then((profile) => active && setAvatarPath(profile.avatar_url), () => {});
    }).catch(() => {});
    Promise.all([getMyBooks(), getMyStreak()]).then(([books, streak]) => {
      if (active) setStats({ books: books.length, hours: hoursLabel(streak?.total_listen_seconds ?? 0), streak: streak?.current_streak ?? 0 });
    }).catch(() => { if (active) setStats({ books: 0, hours: '0', streak: 0 }); });
    return () => { active = false; };
  }, []));

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify('Sign out failed', error.message);
      return;
    }
    router.replace('/Test/welcome');
  };

  // Tap the picture to pick a new one (cropped square); with one set, you can also remove it.
  const changePicture = async () => {
    if (!email || savingPicture) return;
    if (avatarPath && !(await confirm('Profile picture', 'Pick a new picture, or remove the one you have.', 'Choose new'))) {
      if (await confirm('Remove your picture?', 'People will see your initial instead.', 'Remove')) {
        setSavingPicture(true);
        try { setAvatarPath(await removeAvatar()); } catch (e) { notify('Couldn’t remove your picture', (e as Error).message); } finally { setSavingPicture(false); }
      }
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Photos access needed', 'Allow Echo to use your photos to pick a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setSavingPicture(true);
    try {
      setAvatarPath(await uploadAvatar(result.assets[0]));
    } catch (e) {
      notify('Couldn’t update your picture', (e as Error).message);
    } finally {
      setSavingPicture(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={type.h1}>Profile</Text>

        <View style={{ alignItems: 'center', marginVertical: 24, gap: 6 }}>
          <Pressable onPress={changePicture} disabled={!email || savingPicture} accessibilityRole="button" accessibilityLabel="Change profile picture">
            <Avatar name={user} path={avatarPath} size={96} style={s.avatar} />
            {email ? (
              <View style={s.edit}>
                {savingPicture ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="camera" size={15} color={colors.text} />}
              </View>
            ) : null}
          </Pressable>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.text }}>{user || 'Night listener'}</Text>
          <Text style={type.body}>{email || 'Not signed in'}</Text>
          {userId && (
            <Pressable onPress={() => router.push({ pathname: '/Test/user', params: { id: userId } })} hitSlop={8} accessibilityRole="button">
              <Text style={[type.meta, { color: colors.lilac }]}>See your profile as others do</Text>
            </Pressable>
          )}
        </View>

        <View style={s.stats}>
          {[
            [stats ? String(stats.books) : '–', 'Books'],
            [stats ? stats.hours : '–', 'Hours'],
            [stats ? String(stats.streak) : '–', 'Day streak'],
          ].map(([n, l], i) => (
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
        <Text style={[type.meta, { textAlign: 'center', marginTop: 20 }]}>Echo {version}</Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, danger, last, onPress }: { icon: Icon; label: string; danger?: boolean; last?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.row, !last && s.rowLine]} onPress={onPress} accessibilityRole="button">
      <View style={s.rowIcon}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.blue} /></View>
      <Text style={{ flex: 1, fontFamily: fonts.sansMd, fontSize: 16, color: danger ? colors.danger : colors.text }}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  avatar: { borderWidth: 2, borderColor: 'rgba(214,123,176,0.4)', marginBottom: 6 },
  edit: { position: 'absolute', right: 0, bottom: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: '#2A1F45', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  stat: { flex: 1, alignItems: 'center' },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  list: { marginTop: 18, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
