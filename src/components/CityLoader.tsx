import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, scenes, type SceneName } from '../../theme';
import { FlyingBat } from './night/Bat';
import { NightCity } from './night/NightCity';
import { useReducedMotion } from './night/NightSky';

/** In-page loading state: a little cityscape with its lights coming on while the bat flies across. */
export function CityLoader({ scene = 'midnight', label = 'Lighting up the city…' }: { scene?: SceneName; label?: string }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(fly, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [fly, reduced]);

  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="progressbar" accessibilityLabel={label}>
      {width > 0 && (
        <>
          <View style={s.city}>
            <NightCity width={width} height={90} scene={scenes[scene]} />
          </View>
          <Animated.View style={{ position: 'absolute', top: 6, left: 0, transform: [{ translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-50, width + 10] }) }, { translateY: fly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [10, -4, 8] }) }] }}>
            <FlyingBat size={40} flapMs={140} />
          </Animated.View>
        </>
      )}
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 140, justifyContent: 'flex-end', marginVertical: 12, overflow: 'hidden' },
  city: { position: 'absolute', left: 0, right: 0, top: 0, height: 100 },
  label: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.dim, textAlign: 'center' },
});
