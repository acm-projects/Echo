import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../components/MiniPlayer';
import { colors, fonts, gradients } from '../theme';

type Icon = keyof typeof Ionicons.glyphMap;
const TABS: Record<string, { label: string; icon: Icon }> = {
  library: { label: 'Library', icon: 'library-outline' },
  upload: { label: 'Upload', icon: 'cloud-upload-outline' },
  player: { label: 'Player', icon: 'play' },
  community: { label: 'Community', icon: 'people-outline' },
  profile: { label: 'Profile', icon: 'person-outline' },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index].name;
  if (!TABS[active]) return null;
  // TODO: wire to real playback state
  const nowPlaying = { title: 'The Night Circus', chapter: 'Chapter 7 · The room beneath the stars', progress: 0.36, isPlaying: true };

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom || 10 }]}>
      {active !== 'player' && <MiniPlayer {...nowPlaying} onOpen={() => router.navigate('/Test/player')} />}
      <View style={s.bar}>
        {state.routes.map((route : {name: string, key: string}, i : any) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const onPress = () => navigation.navigate(route.name);

          if (route.name === 'player') {
            return (
              <Pressable key={route.key} onPress={onPress} style={s.item}>
                <LinearGradient colors={gradients.cta} style={[s.fab, focused && s.fabActive]}>
                  <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
                </LinearGradient>
                <Text style={[s.label, { color: colors.pink, fontFamily: fonts.sansBold }]}>{tab.label}</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={route.key} onPress={onPress} style={s.item}>
              <Ionicons name={tab.icon} size={24} color={focused ? colors.text : colors.faint} />
              <Text style={[s.label, focused && { color: colors.text }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="library" />
      <Tabs.Screen name="upload" />
      <Tabs.Screen name="player" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#1E0F3E', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6 },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  label: { fontFamily: fonts.sansMd, fontSize: 11, color: colors.faint },
  fab: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 3, borderColor: '#1E0F3E', shadowColor: colors.pink, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabActive: { transform: [{ scale: 1.08 }] },
});
