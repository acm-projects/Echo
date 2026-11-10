import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { useReducedMotion } from './night/NightSky';

/** "Loading" with three dots that hop one after another, for under the bat on loading screens. */
export function LoadingDots({ color = colors.text, size = 15 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduced) {
      dots.forEach((d) => d.setValue(1));
      return;
    }
    const hop = (d: Animated.Value) =>
      Animated.sequence([
        Animated.timing(d, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]);
    const loop = Animated.loop(Animated.sequence([Animated.stagger(160, dots.map(hop)), Animated.delay(260)]));
    loop.start();
    return () => loop.stop();
  }, [dots, reduced]);

  return (
    <View style={s.row} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Text style={[s.word, { color, fontSize: size }]}>Loading</Text>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            { width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: color, marginBottom: size * 0.2 },
            { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.35] }) }] },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  word: { fontFamily: fonts.sansBold, letterSpacing: 1, marginRight: 2 },
});
