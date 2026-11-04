import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from './night/NightSky';

/**
 * A pen-drawn underline that sketches itself in once, left to right. `seed` (usually the heading text) gives each
 * one its own wobble, so no two underlines on a screen look machine-identical.
 * The stroke is revealed by widening a clipping box rather than animating the SVG path, which on web would leak
 * Animated's props onto the DOM <path>.
 */
export function DoodleUnderline({ width, color, seed = '', delay = 250 }: { width: number; color: string; seed?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const draw = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  const d = useMemo(() => {
    let n = [...seed].reduce((a, ch) => a + ch.charCodeAt(0), 7);
    const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const y = 6;
    const mid = width * (0.4 + rand() * 0.2);
    // One slightly uneven stroke that overshoots and flicks back, like a quick underline made with a pen.
    return `M2 ${y + rand() * 2} Q${mid} ${y - 3 - rand() * 3} ${width - 4} ${y + rand() * 2} q-${width * 0.18} ${2 + rand() * 2} -${width * 0.34} ${3 + rand() * 2}`;
  }, [seed, width]);

  useEffect(() => {
    if (reduced) return;
    Animated.timing(draw, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [delay, draw, reduced]);

  return (
    <Animated.View style={{ width: draw.interpolate({ inputRange: [0, 1], outputRange: [0, width] }), height: 14, marginTop: 2, overflow: 'hidden' }}>
      <Svg width={width} height={14}>
        <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
