import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../../../components/MiniPlayer';
import { colors, fonts, scenes, type SceneName } from '../../../../theme';

type Icon = keyof typeof Ionicons.glyphMap;
// Must match the `scene` each tab screen passes to <Screen>, so its skyline stands on the bar.
const SCENE_BY_TAB: Record<string, SceneName> = { library: 'dusk', upload: 'tidewater', player: 'neon', community: 'ember', profile: 'midnight' };
const TABS: Record<string, { label: string; icon: Icon }> = {
  library: { label: 'Library', icon: 'library-outline' },
  upload: { label: 'Upload', icon: 'cloud-upload-outline' },
  player: { label: 'Player', icon: 'play' },
  community: { label: 'Community', icon: 'people-outline' },
  profile: { label: 'Profile', icon: 'person-outline' },
};

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index].name;
  if (!TABS[active]) return null;
  const scene = scenes[SCENE_BY_TAB[active] ?? 'midnight'];

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom || 10, backgroundColor: scene.near }]}>
      {active !== 'player' && <MiniPlayer accent={scene.accent} onOpen={() => router.navigate('/Test/player')} />}
      <View style={s.bar}>
        {state.routes.map((route : {name: string, key: string}, i : any) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          const onPress = () => navigateToTab(route.key);

          if (route.name === 'player') {
            return (
              <Pressable key={route.key} onPress={onPress} style={s.item}>
                <View style={[s.fab, { backgroundColor: scene.accent }, focused && s.fabActive]}>
                  <Ionicons name="play" size={26} color="#16121F" style={{ marginLeft: 3 }} />
                </View>
                <Text style={[s.label, { color: scene.accent, fontFamily: fonts.sansBold }]}>{tab.label}</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={route.key} onPress={onPress} style={s.item}>
              <HopIcon name={tab.icon} focused={focused} />
              <Text style={[s.label, focused && { color: colors.text }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// A small hop and settle when a tab becomes active, so the bar feels like it responds to you.
function HopIcon({ name, focused }: { name: Icon; focused: boolean }) {
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!focused) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [focused, hop]);
  const translateY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] });
  return (
    <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
      <Ionicons name={name} size={24} color={focused ? colors.text : colors.faint} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: 'fade', sceneStyle: { backgroundColor: '#030818' } }}>
      <Tabs.Screen name="library" />
      <Tabs.Screen name="upload" />
      <Tabs.Screen name="player" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  // Background comes from the active tab's scene (the near skyline colour) so the city appears to stand on the bar.
  wrap: { paddingTop: 8 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6 },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  label: { fontFamily: fonts.sansMd, fontSize: 11, color: colors.faint },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: -24, borderWidth: 3, borderColor: 'rgba(0,0,0,0.35)' },
  fabActive: { transform: [{ scale: 1.08 }] },
});
