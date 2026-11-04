import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { night, scenes, type SceneName } from '../../../theme';
import { FlyingBat, HangingBat } from './Bat';
import { NightCity, antennaPoint } from './NightCity';
import { useReducedMotion } from './NightSky';
import { sceneForPath } from './sceneStore';

const DURATION = 2200;

// Scattered with a seeded sequence; simple modular spacing lines the stars up into a diagonal trail.
const STARS: [number, number, number][] = (() => {
  let n = 42;
  const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 26 }, () => [rand() * 100, rand() * 60, 0.35 + rand() * 0.5]);
})();

// Same order as the tab bar in Test/(tabs)/_layout.tsx, so the bat flies toward the tab you picked.
const TAB_ORDER = ['/Test/library', '/Test/upload', '/Test/player', '/Test/community', '/Test/profile'];

// +1 = travel right, -1 = travel left. Between tabs, compare their positions on the bar. Otherwise, returning to a
// page we've already passed through is going back (left); anywhere new is forward (right). `history` is trimmed or
// extended to match.
function directionOf(history: string[], from: string, to: string) {
  const a = TAB_ORDER.indexOf(from);
  const b = TAB_ORDER.indexOf(to);
  const seen = history.lastIndexOf(to);
  if (b >= 0) history.length = 0;
  if (seen >= 0) history.length = seen;
  history.push(to);
  if (a >= 0 && b >= 0) return b > a ? 1 : -1;
  return seen >= 0 || b >= 0 ? -1 : 1;
}

/**
 * Plays whenever the night scene changes, as a sideways swipe from one city to the next. The bat stays near the
 * antenna while the cities pan beneath it, so it reads as flying toward the next tab:
 *   0.00–0.12  the bat asleep on the antenna wakes and lifts off.
 *   0.10–0.62  the old city pans away opposite the direction of travel; the sky shifts to the new scene's colours.
 *   0.40–0.86  the new city slides in from the side the bat is heading.
 *   0.70–0.90  the bat drops onto the new city's antenna and folds up to hang.
 *   0.90–1.00  the overlay fades, revealing the real screen, which has been there underneath all along.
 * Screens that share a scene don't trigger it, and Reduce Motion turns it off.
 */
export function BatTransition() {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const last = useRef<{ path: string; scene: SceneName | null } | null>(null);
  const history = useRef<string[]>([]);
  const [trip, setTrip] = useState<{ from: SceneName; to: SceneName; dir: number } | null>(null);

  // Everything is decided here, from the route alone, in one place: where we came from, where we're going and which
  // way that is. Screens deliberately don't report their own scene: their focus effects run before this one and
  // would start the trip with the previous navigation's direction.
  const pathname = usePathname();
  useEffect(() => {
    const prev = last.current;
    const scene = sceneForPath(pathname) ?? prev?.scene ?? null;
    last.current = { path: pathname, scene };
    const dir = prev ? directionOf(history.current, prev.path, pathname) : 1;
    if (!prev) history.current = [pathname];
    if (!prev?.scene || !scene || scene === prev.scene || reduced || busy.current) return;
    busy.current = true;
    setTrip({ from: prev.scene, to: scene, dir });
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: DURATION, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(() => {
      busy.current = false;
      setTrip(null);
    });
  }, [p, pathname, reduced]);

  if (!trip) return null;
  const { dir } = trip;
  const from = scenes[trip.from];
  const to = scenes[trip.to];
  const cityH = Math.min(220, height * 0.28);
  const perch = antennaPoint(width, cityH);
  const perchY = height - cityH + perch.y;
  const bat = 110;
  const cruiseY = height * 0.38;
  // The bat holds roughly above the antenna while the world moves under it, so it reads as flying in `dir`.
  const home = Math.min(Math.max(perch.x - bat / 2, 16), width - bat - 16);
  const pan = width * 1.15;

  const r = <T extends number | string>(input: number[], output: T[]) => p.interpolate<T>({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: r([0, 0.05, 0.9, 1], [0, 1, 1, 0]) }]}>
      {/* Sky: the old night cross-fades into the new one */}
      <LinearGradient colors={from.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.25, 0.7], [0, 1]) }]}>
        <LinearGradient colors={to.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Distant stars drift only a little, so the cities read as close and the sky as far away */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: r([0, 1], [0, -dir * 50]) }] }]}>
        {STARS.map(([x, y, o], i) => (
          <View key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 2, height: 2, borderRadius: 1, backgroundColor: night.star, opacity: o }} />
        ))}
      </Animated.View>

      {/* Speed streaks while the bat is in full flight */}
      {[0.22, 0.48, 0.66].map((y, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: height * y,
            left: 0,
            width: width * 0.35,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: 'rgba(255,255,255,0.35)',
            opacity: r([0.3, 0.4, 0.62, 0.7], [0, 1, 1, 0]),
            transform: [{ translateX: r([0.3 + i * 0.03, 0.7], dir > 0 ? [width, -width * 0.4] : [-width * 0.4, width]) }],
          }}
        />
      ))}

      {/* Leaving: the old city pans away behind us */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: cityH, transform: [{ translateX: r([0.1, 0.62], [0, -dir * pan]) }] }}>
        <NightCity width={width} height={cityH} animated={false} scene={from} perched={false} />
      </Animated.View>

      {/* Arriving: the new city slides in from the side we're flying toward */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: cityH, transform: [{ translateX: r([0.4, 0.86], [dir * pan, 0]) }] }}>
        <NightCity width={width} height={cityH} animated={false} scene={to} perched={false} />
      </Animated.View>

      {/* Asleep on the old antenna for a beat, then gone as it takes off (it pans away with the old city) */}
      <Animated.View style={{ position: 'absolute', left: perch.x + 2, top: perchY + 1, opacity: r([0, 0.08, 0.12], [1, 1, 0]), transform: [{ translateX: r([0.1, 0.62], [0, -dir * pan]) }] }}>
        <HangingBat size={13} />
      </Animated.View>

      {/* One bat for the whole trip: lift off, cruise while the cities pan under it, drop onto the new antenna */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.06, 0.12, 0.86, 0.9], [0, 1, 1, 0]),
          transform: [
            { translateX: r([0.08, 0.3, 0.55, 0.75, 0.88], [home, home + dir * 26, home + dir * 34, home + dir * 18, home]) },
            { translateY: r([0.08, 0.3, 0.42, 0.55, 0.7, 0.88], [perchY - bat * 0.3, cruiseY, cruiseY - 14, cruiseY + 10, cruiseY - 6, perchY - bat * 0.3]) },
            { scale: r([0.08, 0.3, 0.7, 0.88], [0.15, 1, 1, 0.15]) },
            // Banks into the direction of travel, levels out in the glide, and pulls up to land.
            { rotate: r([0.08, 0.3, 0.6, 0.8, 0.88], [`${dir * 4}deg`, `${dir * 16}deg`, `${dir * 8}deg`, `${-dir * 10}deg`, '0deg']) },
          ],
        }}
      >
        <FlyingBat size={bat} flapMs={150} />
      </Animated.View>

      {/* Lands, folds its wings and hangs, matching the bat on the real screen's antenna */}
      <Animated.View style={{ position: 'absolute', left: perch.x + 2, top: perchY + 1, opacity: r([0.86, 0.9], [0, 1]) }}>
        <HangingBat size={13} />
      </Animated.View>
    </Animated.View>
  );
}
