import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../../../components/MiniPlayer';
import { depart } from '../../../components/night/BatTransition';
import { colors, fonts, scenes, type SceneName } from '../../../../theme';

type Icon = keyof typeof Ionicons.glyphMap;
// Must match the `scene` each tab screen passes to <Screen>, so its skyline stands on the bar.
const SCENE_BY_TAB: Record<string, SceneName> = { library: 'dusk', shelf: 'aurora', community: 'ember', profile: 'midnight' };
const TABS: Record<string, { label: string; icon: Icon }> = {
  library: { label: 'Library', icon: 'compass-outline' },
  shelf: { label: 'Your Shelf', icon: 'library-outline' },
  community: { label: 'Community', icon: 'people-outline' },
  profile: { label: 'Profile', icon: 'person-outline' },
};
// Tabs where the floating + (add a book) appears.
const ADD_ON = new Set(['library', 'shelf']);

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index].name;
  if (!TABS[active]) return null;
  const scene = scenes[SCENE_BY_TAB[active] ?? 'midnight'];

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom || 10, backgroundColor: scene.near }]}>
      {ADD_ON.has(active) && (
        <Pressable style={[s.add, { backgroundColor: scene.accent }]} onPress={() => router.push('/Test/upload')} accessibilityRole="button" accessibilityLabel="Add a book">
          <Ionicons name="add" size={28} color="#16121F" />
        </Pressable>
      )}
      <MiniPlayer accent={scene.accent} onOpen={() => router.push('/Test/player')} />
      <View style={s.bar}>
        {state.routes.map((route : {name: string, key: string}, i : any) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          // Say goodbye to the current screen (city sinks, buttons fade) before switching tabs.
          const onPress = () => (focused ? undefined : depart(() => navigateToTab(route.key), `/Test/${route.name}`));

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
      <Tabs.Screen name="shelf" />
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
  // Floats above the mini-player at the right edge, like a bookmark you can always reach.
  add: { position: 'absolute', right: 18, top: -64, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(0,0,0,0.35)', zIndex: 2 },
});
