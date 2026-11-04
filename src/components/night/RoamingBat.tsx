import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { scenes, type Scene, type SceneName } from '../../../theme';
import { FlyingBat, HangingBat } from './Bat';
import { useReducedMotion } from './NightSky';
import { cityFor, isTraveling, onPerchesChange, setBatSpot } from './perchRegistry';
import type { CitySpot } from './NightCity';

const FLIGHT_MS = 1700;
const FLYER = 56;

const nameOf = (scene: Scene) => (Object.keys(scenes) as SceneName[]).find((k) => scenes[k] === scene);

/**
 * The mascot while you're on a screen, living in that screen's city: it sleeps on one skyline spot (the landmark, the
 * antenna, a rooftop edge) and every so often flutters to another. Because it's part of the city it scrolls with it
 * and sits behind the page, like the buildings. Spots are in city coordinates; `shift` is each building layer's
 * parallax offset so the bat stays on its building as a hero scrolls. It starts on the landing perch (spots[0]),
 * where BatTransition puts it, and steps aside while a transition is flying it.
 */
export function CityBat({ scene, spots, shift }: { scene: Scene; spots: CitySpot[]; shift: Record<CitySpot['layer'], Animated.AnimatedInterpolation<number> | number> }) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [, setTick] = useState(0);
  const [at, setAt] = useState(0);
  const [flight, setFlight] = useState<{ from: number; to: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const name = nameOf(scene);

  // Know when a transition starts or ends, and where the city is on screen.
  useEffect(() => onPerchesChange(() => setTick((n) => n + 1)), []);
  const traveling = isTraveling();

  // Back on the landing perch whenever the screen is (re)entered, which is where the transition left it.
  useEffect(() => {
    if (focused) setAt(0);
  }, [focused]);

  // Tell transitions where the bat is, in window coordinates.
  const city = name ? cityFor(name) : undefined;
  const toWindow = (spot: CitySpot) => (city ? { x: city.x + spot.x, y: city.y + spot.y } : null);
  useEffect(() => {
    if (!focused || traveling || flight) return;
    const spot = spots[at];
    if (spot) setBatSpot(toWindow(spot));
  });

  // Now and then, wake up and fly to another spot on the skyline.
  useEffect(() => {
    if (!focused || traveling || reduced || flight || spots.length < 2) return;
    const timer = setTimeout(() => {
      let next = Math.floor(Math.random() * spots.length);
      if (next === at) next = (next + 1) % spots.length;
      setFlight({ from: at, to: next });
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: FLIGHT_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setAt(next);
        setFlight(null);
      });
    }, 8000 + Math.random() * 8000);
    return () => clearTimeout(timer);
  }, [at, flight, focused, progress, reduced, spots.length, traveling]);

  // While in the air, tell any transition that starts mid-flight roughly where the bat is.
  useEffect(() => {
    if (!flight) return;
    const a = toWindow(spots[flight.from]);
    const b = toWindow(spots[flight.to]);
    if (!a || !b) return;
    const id = progress.addListener(({ value }) => setBatSpot({ x: a.x + (b.x - a.x) * value, y: a.y + (b.y - a.y) * value }));
    return () => progress.removeListener(id);
  });

  // A transition takes over the bat (and cancels any flight in progress).
  useEffect(() => {
    if (traveling && flight) {
      progress.stopAnimation();
      setFlight(null);
    }
  }, [flight, progress, traveling]);

  if (!focused || traveling) return null;

  if (flight) {
    const from = spots[flight.from];
    const to = spots[flight.to];
    const lift = Math.min(from.y, to.y) - 60;
    const fx = (s: CitySpot) => s.x + 6 - FLYER / 2;
    const fy = (s: CitySpot) => s.y - FLYER * 0.3;
    return (
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: shift.near }] }]}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [fx(from), fx(to)] }) },
              { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [fy(from), lift, fy(to)] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0.3, 1, 1, 0.3] }) },
              { rotate: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: to.x > from.x ? ['10deg', '0deg', '-6deg'] : ['-10deg', '0deg', '6deg'] }) },
            ],
          }}
        >
          <FlyingBat size={FLYER} flapMs={170} />
        </Animated.View>
      </Animated.View>
    );
  }

  const spot = spots[at];
  if (!spot) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: shift[spot.layer] }] }]}>
      <View style={{ position: 'absolute', left: spot.x, top: spot.y }}>
        <HangingBat size={13} />
      </View>
    </Animated.View>
  );
}
