import { ReactNode } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scenes, type SceneName } from '../../theme';
import { NightSky } from './night/NightSky';
import { arrival, markScreenReady } from './night/perchRegistry';
import { useFocusEffect } from 'expo-router';
import { INTERIOR_COLORS, Interior, type InteriorKind } from './night/Interiors';
import type { CityVariant } from './night/NightCity';

// Every inner screen sits in the same night city, but each picks its own `scene` (sky, horizon glow, window light).
// Pass `variant="hero"` and the ScrollView's `scrollY` on showpiece screens for the layered parallax city.
// `recordCity={false}` when another city on the screen (a CityHero) is the one transitions should use.
// Pages opened from a tab pass `interior` instead: they're inside one of the city's buildings, not out under the sky.
export function Screen({ children, style, city = true, scene = 'midnight', variant, scrollY, interior, recordCity = true, lanterns }: { children: ReactNode; style?: ViewStyle; city?: boolean; scene?: SceneName; variant?: CityVariant; scrollY?: Animated.Value; interior?: InteriorKind; recordCity?: boolean; lanterns?: boolean }) {
  const palette = scenes[scene];
  useFocusEffect(markScreenReady);
  return (
    <View style={[s.root, { backgroundColor: interior ? INTERIOR_COLORS[interior] : palette.sky[0] }]}>
      {interior ? <Interior kind={interior} /> : <NightSky city={city} variant={variant} scrollY={scrollY} scene={palette} record={recordCity} lanterns={lanterns} />}
      <SafeAreaView style={[s.fill, style]} edges={['top']}>
        <Animated.View style={[s.fill, { opacity: arrival, transform: [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{children}</Animated.View>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({ root: { flex: 1 }, fill: { flex: 1 } });
