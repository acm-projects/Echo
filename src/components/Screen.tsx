import { ReactNode } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scenes, type SceneName } from '../../theme';
import { NightSky } from './night/NightSky';
import type { CityVariant } from './night/NightCity';

// Every inner screen sits in the same night city, but each picks its own `scene` (sky, horizon glow, window light).
// Pass `variant="hero"` and the ScrollView's `scrollY` on showpiece screens for the layered parallax city.
export function Screen({ children, style, city = true, scene = 'midnight', variant, scrollY }: { children: ReactNode; style?: ViewStyle; city?: boolean; scene?: SceneName; variant?: CityVariant; scrollY?: Animated.Value }) {
  const palette = scenes[scene];
  return (
    <View style={[s.root, { backgroundColor: palette.sky[0] }]}>
      <NightSky city={city} variant={variant} scrollY={scrollY} scene={palette} />
      <SafeAreaView style={[s.fill, style]} edges={['top']}>{children}</SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({ root: { flex: 1 }, fill: { flex: 1 } });
