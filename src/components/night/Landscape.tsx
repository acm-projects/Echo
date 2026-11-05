import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { night, type Scene } from '../../../theme';
import { FlyingBat } from './Bat';
import { LoadingDots } from '../LoadingDots';

// The open country between cities, shown while the next screen is still loading during a transition: the bat flies
// on over a pine forest or a country road until there's somewhere to land.
export type LandscapeKind = 'forest' | 'road';

function seeded(seed: number) {
  let n = seed;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
}

// One strip of scenery two screens wide, scrolled sideways forever. `dir` matches the direction of travel.
function Strip({ width, height, duration, dir, children }: { width: number; height: number; duration: number; dir: number; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [duration, t]);
  return (
    <Animated.View style={{ position: 'absolute', left: dir > 0 ? 0 : -width, bottom: 0, width: width * 2, height, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -dir * width] }) }] }}>
      {children}
    </Animated.View>
  );
}

// Content is drawn for one screen width and repeated, so the loop never shows a seam.
function twice(width: number, draw: (offset: number) => React.ReactNode) {
  return (
    <>
      {draw(0)}
      {draw(width)}
    </>
  );
}

function hills(width: number, height: number, seed: number, peak: number) {
  const rand = seeded(seed);
  let d = `M0 ${height}`;
  const steps = 6;
  const ys = Array.from({ length: steps + 1 }, (_, i) => (i === steps ? 0 : height - peak * (0.5 + rand() * 0.5)));
  ys[steps] = ys[0];
  for (let i = 0; i <= steps; i++) d += ` ${i ? 'S' : 'L'}${(i * width) / steps - width / steps / 2} ${ys[i]} ${(i * width) / steps} ${ys[i]}`;
  return `${d} L${width} ${height} Z`;
}

function pines(width: number, height: number, seed: number, minH: number, maxH: number) {
  const rand = seeded(seed);
  let d = '';
  for (let x = 0; x < width; x += 10 + rand() * 14) {
    const h = minH + rand() * (maxH - minH);
    const w = h * 0.42;
    d += `M${x - w / 2} ${height} L${x} ${height - h} L${x + w / 2} ${height} Z `;
  }
  return d;
}

export function Landscape({ kind, scene, dir }: { kind: LandscapeKind; scene: Scene; dir: number }) {
  const { width, height } = useWindowDimensions();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const far = useMemo(() => hills(width, height * 0.34, 7, height * 0.2), [height, width]);
  const mid = useMemo(() => (kind === 'forest' ? pines(width, height * 0.3, 19, height * 0.08, height * 0.16) : hills(width, height * 0.24, 23, height * 0.09)), [height, kind, width]);
  const near = useMemo(() => (kind === 'forest' ? pines(width, height * 0.22, 41, height * 0.1, height * 0.2) : ''), [height, kind, width]);
  const fireflies = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: 10 }, () => ({ x: rand() * width, y: height * (0.6 + rand() * 0.3), d: rand() * 2000 }));
  }, [height, width]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={scene.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <Strip width={width} height={height * 0.34} duration={14000} dir={dir}>
        {twice(width, (o) => <Svg key={o} width={width} height={height * 0.34} style={{ position: 'absolute', left: o }}><Path d={far} fill={scene.far} /></Svg>)}
      </Strip>
      <Strip width={width} height={height * 0.3} duration={7000} dir={dir}>
        {twice(width, (o) => <Svg key={o} width={width} height={height * 0.3} style={{ position: 'absolute', left: o }}><Path d={mid} fill={scene.mid} /></Svg>)}
      </Strip>
      {kind === 'forest' ? (
        <Strip width={width} height={height * 0.22} duration={3200} dir={dir}>
          {twice(width, (o) => <Svg key={o} width={width} height={height * 0.22} style={{ position: 'absolute', left: o }}><Path d={near} fill={scene.near} /></Svg>)}
        </Strip>
      ) : (
        // A country road: verge, tarmac with a dashed centre line, and streetlamps going by.
        <Strip width={width} height={height * 0.16} duration={2600} dir={dir}>
          {twice(width, (o) => (
            <Svg key={o} width={width} height={height * 0.16} style={{ position: 'absolute', left: o }}>
              <Rect x={0} y={height * 0.16 - 46} width={width} height={46} fill={scene.near} />
              <Rect x={0} y={height * 0.16 - 30} width={width} height={22} fill="#1A1A24" />
              {Array.from({ length: 8 }, (_, i) => <Rect key={i} x={(i * width) / 8} y={height * 0.16 - 20} width={width / 16} height={2} fill="#E8D9A8" opacity={0.6} />)}
              {[0.25, 0.75].map((f) => (
                <Path key={f} d={`M${width * f} ${height * 0.16 - 46} V${height * 0.16 - 46 - 60} h14`} stroke={scene.near} strokeWidth={3} fill="none" />
              ))}
              {[0.25, 0.75].map((f) => <Rect key={`l${f}`} x={width * f + 10} y={height * 0.16 - 46 - 62} width={8} height={5} fill={night.window} />)}
            </Svg>
          ))}
        </Strip>
      )}
      {kind === 'forest' && fireflies.map((f, i) => <Firefly key={i} {...f} />)}
      <Animated.View style={{ position: 'absolute', left: width / 2 - 55, top: height * 0.34, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) }, { rotate: `${dir * 8}deg` }] }}>
        <FlyingBat size={110} flapMs={150} />
      </Animated.View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: height * 0.34 + 110 }}>
        <LoadingDots color={night.window} />
      </View>
    </View>
  );
}

function Firefly({ x, y, d }: { x: number; y: number; d: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(d),
        Animated.timing(t, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [d, t]);
  return <Animated.View style={{ position: 'absolute', left: x, top: y, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#F2F7A8', opacity: t }} />;
}
