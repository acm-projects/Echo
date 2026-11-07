import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const SPARKS = [-70, -35, 0, 35, 70, 110];

/**
 * Tiny stars that pop out of a button and fade, for small celebrations (a like, a save).
 * Re-plays whenever `trigger` changes to a new truthy value.
 */
export function Burst({ trigger, color }: { trigger: number; color: string }) {
  const t = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!trigger) return;
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t, trigger]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 8, width: 0, height: 0 }}>
      {SPARKS.map((deg, i) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const dist = 16 + (i % 2) * 6;
        return (
          <Animated.View
            key={deg}
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: color,
              opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * dist] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * dist] }) },
                { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.6] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
