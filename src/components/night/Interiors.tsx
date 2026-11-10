import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fonts, night } from '../../../theme';
import { useMotion } from './NightSky';

// The rooms inside the city's buildings. Pages opened from a tab are "inside" somewhere: the bat flies in through a
// door (see BatTransition) and the page sits on one of these backgrounds instead of the open night sky.
export type InteriorKind = 'bookshop' | 'harbor' | 'cafe' | 'radioroom' | 'studio';

/** The dominant wall colour of each room; BatTransition fills the doorway with it as the camera goes through. */
export const INTERIOR_COLORS: Record<InteriorKind, string> = {
  bookshop: '#2B1A12',
  harbor: '#0B2A33',
  cafe: '#311613',
  radioroom: '#0A1430',
  studio: '#1A0B26',
};

function useLoop(duration: number, run: boolean, easing = Easing.inOut(Easing.sin), yoyo = true) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    const step = Animated.timing(t, { toValue: 1, duration, easing, useNativeDriver: true });
    const loop = Animated.loop(yoyo ? Animated.sequence([step, Animated.timing(t, { toValue: 0, duration, easing, useNativeDriver: true })]) : step);
    loop.start();
    return () => loop.stop();
  }, [duration, easing, run, t, yoyo]);
  return t;
}

function seeded(seed: number) {
  let n = seed;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
}

// Bookshop: shelves of spines along the top, a pendant lamp that sways, dust drifting in its light.
function Bookshop({ width, height, run }: { width: number; height: number; run: boolean }) {
  const sway = useLoop(3200, run);
  const drift = useLoop(9000, run, Easing.linear, false);
  const spines = useMemo(() => {
    const rand = seeded(11);
    const rows: { x: number; y: number; w: number; h: number; c: string }[] = [];
    const colors = ['#6B2E2E', '#2E4A5C', '#5A4A1F', '#3E5A2E', '#5C2D4A', '#7A5A3A'];
    for (const shelfY of [70, 150]) {
      let x = 0;
      while (x < width) {
        const w = 8 + rand() * 10;
        const h = 44 + rand() * 22;
        rows.push({ x, y: shelfY - h, w, h, c: colors[Math.floor(rand() * colors.length)] });
        x += w + (rand() < 0.1 ? 14 : 1);
      }
    }
    return rows;
  }, [width]);
  return (
    <>
      <LinearGradient colors={['#1E120C', INTERIOR_COLORS.bookshop, '#3A2418']} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={170} style={{ position: 'absolute', top: 0, opacity: 0.55 }}>
        {spines.map((b, i) => <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.c} />)}
        <Rect x={0} y={70} width={width} height={6} fill="#4A2E1E" />
        <Rect x={0} y={150} width={width} height={6} fill="#4A2E1E" />
      </Svg>
      <Animated.View style={{ position: 'absolute', right: width * 0.18, top: 0, alignItems: 'center', transformOrigin: 'top', transform: [{ rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }] }}>
        <View style={{ width: 1.5, height: 120, backgroundColor: '#1A0F0A' }} />
        <Svg width={220} height={height * 0.6}>
          <Path d={`M110 0 L0 ${height * 0.6} H220 Z`} fill="#FFD9A0" opacity={0.06} />
          <Path d="M92 0 H128 L120 16 H100 Z" fill="#1A0F0A" />
          <Circle cx={110} cy={18} r={4} fill="#FFD9A0" />
        </Svg>
      </Animated.View>
      {[0.15, 0.4, 0.7].map((f, i) => (
        <Animated.View key={i} style={{ position: 'absolute', right: width * (0.12 + f * 0.15), top: height * (0.25 + f * 0.25), width: 2, height: 2, borderRadius: 1, backgroundColor: '#FFE2B0', opacity: 0.5, transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -40 - i * 12] }) }, { translateX: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 6, -3] }) }] }} />
      ))}
    </>
  );
}

// Harbour archive: teal panelling and a porthole with the sea rolling past outside.
function Harbor({ width, height, run }: { width: number; height: number; run: boolean }) {
  const waves = useLoop(4200, run, Easing.linear, false);
  const r = 46;
  return (
    <>
      <LinearGradient colors={['#071E25', INTERIOR_COLORS.harbor, '#123B44']} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={{ position: 'absolute', opacity: 0.35 }}>
        {Array.from({ length: Math.ceil(width / 34) }, (_, i) => <Rect key={i} x={i * 34} y={height * 0.62} width={1.5} height={height * 0.38} fill="#05161B" />)}
        <Rect x={0} y={height * 0.62} width={width} height={4} fill="#05161B" />
      </Svg>
      <View style={{ position: 'absolute', right: 26, top: height * 0.08, width: r * 2, height: r * 2, borderRadius: r, overflow: 'hidden', backgroundColor: '#0E3A55', borderWidth: 6, borderColor: '#8A6A3A' }}>
        <Animated.View style={{ position: 'absolute', left: -r * 2, top: r * 0.95, transform: [{ translateX: waves.interpolate({ inputRange: [0, 1], outputRange: [0, r * 2] }) }] }}>
          <Svg width={r * 6} height={r}>
            <Path d={Array.from({ length: 6 }, (_, i) => `${i ? '' : `M0 10 `}Q${i * r + r / 2} 0 ${(i + 1) * r} 10`).join(' ') + ` V${r} H0 Z`} fill="#1E7279" />
          </Svg>
        </Animated.View>
        <View style={{ position: 'absolute', left: r * 0.3, top: r * 0.35, width: 3, height: 3, borderRadius: 1.5, backgroundColor: night.window }} />
      </View>
    </>
  );
}

// Café: brick wall, a string of bulbs that twinkle, steam curling off a cup.
function Cafe({ width, height, run }: { width: number; height: number; run: boolean }) {
  const twinkle = useLoop(1800, run);
  const steam = useLoop(2600, run, Easing.out(Easing.quad), false);
  const bricks = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let row = 0; row * 16 < height; row++) for (let x = row % 2 ? -18 : 0; x < width; x += 38) out.push({ x, y: row * 16 });
    return out;
  }, [height, width]);
  const bulbs = Math.ceil(width / 34);
  return (
    <>
      <LinearGradient colors={['#1E0C0A', INTERIOR_COLORS.cafe, '#3E1E16']} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={{ position: 'absolute', opacity: 0.22 }}>
        {bricks.map((b, i) => <Rect key={i} x={b.x} y={b.y} width={35} height={13} fill="#7A3A2A" />)}
      </Svg>
      <Svg width={width} height={70} style={{ position: 'absolute', top: 0 }}>
        <Path d={`M0 18 Q${width / 4} 48 ${width / 2} 26 T${width} 30`} stroke="#140806" strokeWidth={1.2} fill="none" />
      </Svg>
      {Array.from({ length: bulbs }, (_, i) => {
        const x = (i + 0.5) * (width / bulbs);
        const y = 18 + Math.sin((x / width) * Math.PI * 2) * 10 + 12;
        return <Animated.View key={i} style={{ position: 'absolute', left: x - 3, top: y, width: 6, height: 8, borderRadius: 3, backgroundColor: '#FFB45E', opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: i % 3 ? [0.55, 1] : [1, 0.45] }) }} />;
      })}
      <View style={{ position: 'absolute', left: 22, bottom: 34, width: 26, height: 18, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: '#140806' }} />
      {[0, 1].map((i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: 30 + i * 8, bottom: 54, width: 3, height: 16, borderRadius: 2, backgroundColor: 'rgba(255,230,210,0.35)', opacity: steam.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }), transform: [{ translateY: steam.interpolate({ inputRange: [0, 1], outputRange: [0, -26 - i * 6] }) }, { rotate: i ? '12deg' : '-10deg' }] }} />
      ))}
    </>
  );
}

// Radio room: a star-chart wall, a big tuning dial whose needle drifts, and an ON AIR sign.
function RadioRoom({ width, height, run }: { width: number; height: number; run: boolean }) {
  const needle = useLoop(4000, run);
  const onAir = useLoop(1400, run);
  return (
    <>
      <LinearGradient colors={['#050B1E', INTERIOR_COLORS.radioroom, '#13224A']} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={{ position: 'absolute', opacity: 0.18 }}>
        {Array.from({ length: Math.ceil(width / 40) }, (_, i) => <Rect key={`v${i}`} x={i * 40} y={0} width={0.8} height={height} fill="#9CC2FF" />)}
        {Array.from({ length: Math.ceil(height / 40) }, (_, i) => <Rect key={`h${i}`} x={0} y={i * 40} width={width} height={0.8} fill="#9CC2FF" />)}
        <Path d={`M${width * 0.2} ${height * 0.3} L${width * 0.35} ${height * 0.22} L${width * 0.5} ${height * 0.34} L${width * 0.62} ${height * 0.26}`} stroke="#FFE9A8" strokeWidth={1} fill="none" />
      </Svg>
      <View style={{ position: 'absolute', right: -40, bottom: 60, width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: 'rgba(156,194,255,0.25)' }}>
        <Animated.View style={{ position: 'absolute', left: 89, top: 20, width: 2, height: 70, backgroundColor: '#FF8A6A', transformOrigin: 'bottom', transform: [{ rotate: needle.interpolate({ inputRange: [0, 1], outputRange: ['-38deg', '-12deg'] }) }] }} />
      </View>
      <Animated.View style={{ position: 'absolute', right: 20, top: height * 0.12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.2, borderColor: '#FF5A5A', borderRadius: 3, opacity: onAir.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] }) }}>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2, color: '#FF5A5A' }}>ON AIR</Text>
      </Animated.View>
    </>
  );
}

// Studio: acoustic foam on the walls, a REC light, a microphone in silhouette.
function Studio({ width, height, run }: { width: number; height: number; run: boolean }) {
  const rec = useLoop(1100, run);
  return (
    <>
      <LinearGradient colors={['#0E0618', INTERIOR_COLORS.studio, '#2A0F3A']} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={{ position: 'absolute', opacity: 0.2 }}>
        {Array.from({ length: Math.ceil(width / 28) * Math.ceil(height / 28) }, (_, i) => {
          const cols = Math.ceil(width / 28);
          const x = (i % cols) * 28;
          const y = Math.floor(i / cols) * 28;
          return <Path key={i} d={(Math.floor(i / cols) + (i % cols)) % 2 ? `M${x} ${y} L${x + 28} ${y} L${x + 14} ${y + 28} Z` : `M${x} ${y + 28} L${x + 14} ${y} L${x + 28} ${y + 28} Z`} fill="#5B2A7A" />;
        })}
      </Svg>
      <Animated.View style={{ position: 'absolute', right: 22, top: height * 0.11, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: rec.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B5C' }} />
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2, color: '#FF3B5C' }}>REC</Text>
      </Animated.View>
      <Svg width={60} height={140} style={{ position: 'absolute', left: 16, bottom: 0, opacity: 0.5 }}>
        <Rect x={18} y={6} width={24} height={40} rx={12} fill="#0A0412" />
        <Path d="M12 30 Q12 58 30 58 Q48 58 48 30" stroke="#0A0412" strokeWidth={3} fill="none" />
        <Rect x={28} y={58} width={4} height={82} fill="#0A0412" />
      </Svg>
    </>
  );
}

/** Full-bleed room background for pages that live "inside" a building. */
export function Interior({ kind }: { kind: InteriorKind }) {
  const { width, height } = useWindowDimensions();
  const run = useMotion('background');
  const props = { width, height, run };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {kind === 'bookshop' && <Bookshop {...props} />}
      {kind === 'harbor' && <Harbor {...props} />}
      {kind === 'cafe' && <Cafe {...props} />}
      {kind === 'radioroom' && <RadioRoom {...props} />}
      {kind === 'studio' && <Studio {...props} />}
    </View>
  );
}
