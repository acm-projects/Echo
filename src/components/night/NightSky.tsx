import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { night, scenes, type Scene } from '../../../theme';
import { FlyingBat } from './Bat';
import { NightCity, type CityVariant } from './NightCity';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

// [x%, y%, radius, twinkles]
const STARS: [number, number, number, boolean][] = [
  [6, 5, 1.4, false], [17, 12, 1, true], [29, 4, 1.2, false], [41, 15, 0.9, false], [52, 7, 1.5, true],
  [63, 18, 1, false], [74, 6, 1.1, false], [88, 13, 1.4, true], [94, 28, 0.9, false], [9, 26, 1, false],
  [23, 33, 1.3, true], [36, 24, 0.8, false], [58, 30, 1.2, false], [80, 36, 1, true], [47, 41, 0.9, false],
  [14, 45, 1.1, false], [70, 47, 0.8, false], [90, 50, 1.2, false],
];

function Star({ x, y, r, twinkle, delay }: { x: number; y: number; r: number; twinkle: boolean; delay: number }) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (!twinkle) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, twinkle]);
  return <Animated.View style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: night.star, opacity }} />;
}

// Two translucent bands in the scene's glow colour drifting across the upper sky, like an aurora over the city.
function Aurora({ width, height, color }: { width: number; height: number; color: string }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);
  const w = width * 1.4;
  const h = height * 0.4;
  const band = (y: number, amp: number) => `M0 ${y} C${w * 0.25} ${y - amp} ${w * 0.45} ${y + amp} ${w * 0.7} ${y - amp * 0.4} S${w * 0.95} ${y + amp * 0.6} ${w} ${y} L${w} ${y + 22} C${w * 0.8} ${y + 22 + amp} ${w * 0.4} ${y + 22 - amp} 0 ${y + 30} Z`;
  return (
    <Animated.View style={{ position: 'absolute', left: -width * 0.2, top: height * 0.04, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] }) }] }}>
      <Svg width={w} height={h}>
        <Path d={band(h * 0.3, 30)} fill={color} opacity={0.12} />
        <Path d={band(h * 0.5, 22)} fill={night.neonPink} opacity={0.05} />
      </Svg>
    </Animated.View>
  );
}

// Every so often a bat crosses the upper sky on a gentle wave. Only runs while the screen is focused.
function Flyby({ width, height }: { width: number; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [flight, setFlight] = useState<{ y: number; ltr: boolean; size: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout>;
      const schedule = (wait: number) => {
        timer = setTimeout(() => {
          setFlight({ y: height * (0.08 + Math.random() * 0.22), ltr: Math.random() < 0.5, size: 26 + Math.random() * 12 });
          progress.setValue(0);
          Animated.timing(progress, { toValue: 1, duration: 7500, easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
            setFlight(null);
            if (finished) schedule(22000 + Math.random() * 16000);
          });
        }, wait);
      };
      schedule(4000 + Math.random() * 6000);
      return () => {
        clearTimeout(timer);
        progress.stopAnimation();
        setFlight(null);
      };
    }, [height, progress])
  );

  if (!flight) return null;
  const from = flight.ltr ? -60 : width + 20;
  const to = flight.ltr ? width + 20 : -60;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const translateY = progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -18, 6, -10, 4] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: flight.y, transform: [{ translateX }, { translateY }, { scaleX: flight.ltr ? 1 : -1 }] }}>
      <FlyingBat size={flight.size} flapMs={180} style={{ opacity: 0.9 }} />
    </Animated.View>
  );
}

/**
 * Full-bleed night background shared by every inner screen, painted in the screen's `scene` palette.
 * `hero` adds a taller layered city with neon and aurora, drifting with `scrollY`. Reading screens stay `calm`.
 */
export function NightSky({ city = true, variant = 'calm', scrollY, scene = scenes.midnight }: { city?: boolean; variant?: CityVariant; scrollY?: Animated.Value; scene?: Scene }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const hero = variant === 'hero';
  const cityHeight = hero ? Math.min(240, height * 0.27) : Math.min(170, height * 0.2);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={scene.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      {hero && !reduced && <Aurora width={width} height={height} color={scene.glow} />}
      {STARS.map(([x, y, r, tw], i) => <Star key={i} x={x} y={y} r={r} twinkle={tw && !reduced} delay={i * 400} />)}
      {!reduced && <Flyby width={width} height={height} />}
      {city && <NightCity width={width} height={cityHeight} animated={!reduced} variant={variant} scrollY={scrollY} scene={scene} />}
    </View>
  );
}

/**
 * A self-contained illustrated night scene for the top of a screen, like a landing-page hero: aurora, layered
 * neon city and the odd passing bat, with its own horizon glow. Put it first inside the ScrollView and pass the
 * scroll value for parallax.
 */
export function CityHero({ height, scrollY, scene = scenes.dusk, children }: { height: number; scrollY?: Animated.Value; scene?: Scene; children?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  return (
    <View style={{ height, overflow: 'hidden' }}>
      {/* Horizon glow behind the skyline: the scene's sunset or city light */}
      <LinearGradient colors={['rgba(0,0,0,0)', scene.sky[2]]} locations={[0.3, 0.85]} style={StyleSheet.absoluteFill} />
      {!reduced && <Aurora width={width} height={height * 1.6} color={scene.glow} />}
      {!reduced && <Flyby width={width} height={height * 1.4} />}
      <NightCity width={width} height={height * 0.62} animated={!reduced} variant="hero" scrollY={scrollY} scene={scene} />
      {/* Fades the skyline's foot into the page so the content below doesn't sit on a hard edge */}
      <LinearGradient colors={['rgba(0,0,0,0)', scene.sky[1]]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 36 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>{children}</View>
    </View>
  );
}
