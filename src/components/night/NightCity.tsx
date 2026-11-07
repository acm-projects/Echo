import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { night, scenes, type Scene, type SceneName } from '../../../theme';
import { CityBat } from './RoamingBat';
import { LANDMARK_CLEARANCE, Landmark, landmarkDoor, landmarkPerch, landmarkX } from './Landmarks';
import { departing, recordCity, recordSpots, tallness } from './perchRegistry';

type Window = { x: number; y: number; h: number; lit: boolean; tint: string };
type Roof = 'flat' | 'setback' | 'spire' | 'pitched' | 'dome' | 'slant' | 'crown' | 'tank' | 'plant';
type Building = { x: number; w: number; h: number; roof: Roof; feature: number; windows: Window[] };
export type CityVariant = 'calm' | 'hero';

// Small deterministic PRNG so the skyline is identical on every render and every screen.
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const WIN = 4;
const GAP = 5;

// `roofs` is the scene's mix (repeats weight a style). Buildings near `quietX` stay low so the landmark stays visible.
function skyline(width: number, height: number, seed: number, minH: number, maxH: number, litChance: number, neonChance: number, palette: readonly string[], roofs: readonly string[], quietX: number | null = null) {
  const rand = seeded(seed);
  const buildings: Building[] = [];
  let x = -6;
  while (x < width + 6) {
    const roof = roofs[Math.floor(rand() * roofs.length)] as Roof;
    // Landmarks run a little wider; spires and pitched roofs stay slim.
    const w = (roof === 'dome' || roof === 'crown' ? 34 : roof === 'spire' || roof === 'pitched' ? 20 : 22) + Math.floor(rand() * 32);
    const feature = roof === 'spire' ? 18 + rand() * 20 : roof === 'setback' || roof === 'crown' ? 8 + rand() * 14 : roof === 'pitched' ? w * 0.38 : roof === 'dome' ? w * 0.3 : roof === 'slant' ? 6 + rand() * 12 : 10;
    // Keep the whole silhouette, roof included, inside the layer.
    const quiet = quietX !== null && x < quietX + LANDMARK_CLEARANCE && x + w > quietX - LANDMARK_CLEARANCE;
    const h = Math.min(minH + Math.floor(rand() * (maxH - minH)), height - feature - 2, quiet ? height * 0.3 : Infinity);
    // Most buildings use the scene's main light; a few glow in its second colour or in neon.
    const roll = rand();
    const tint = roll < neonChance ? (rand() < 0.5 ? night.neonCyan : night.neonPink) : roll < 0.35 ? palette[1] ?? palette[0] : palette[0];
    // Window pattern per building: a full grid, tall vertical strips, or a quiet office with few lights on.
    const pattern = rand();
    const strips = pattern > 0.7;
    const lit = pattern < 0.15 ? litChance * 0.4 : litChance;
    const wh = strips ? WIN * 2.6 : WIN + 1;
    const windows: Window[] = [];
    for (let wy = height - h + 8; wy < height - 8 - wh; wy += wh + GAP) {
      for (let wx = x + 5; wx < x + w - 5 - WIN; wx += strips ? WIN + 3 : WIN + GAP) {
        if (rand() < (strips ? 0.75 : 0.55)) windows.push({ x: wx, y: wy, h: wh, lit: rand() < lit, tint });
      }
    }
    buildings.push({ x, w, h, roof, feature, windows });
    // Mostly shoulder to shoulder, with the occasional alley.
    x += w + (rand() < 0.15 ? 4 + Math.floor(rand() * 6) : Math.floor(rand() * 3));
  }
  return buildings;
}

// Outline of one building as an SVG path: walls plus its roof shape.
function outline(b: Building, height: number) {
  const { x, w, feature: f } = b;
  const top = height - b.h;
  const base = `M${x} ${height} V${top}`;
  const end = `V${height} Z`;
  switch (b.roof) {
    case 'setback':
      return `${base} H${x + w * 0.18} V${top - f} H${x + w * 0.82} V${top} H${x + w} ${end}`;
    case 'crown':
      return `${base} H${x + w * 0.12} V${top - f * 0.4} H${x + w * 0.26} V${top - f * 0.75} H${x + w * 0.4} V${top - f} H${x + w * 0.6} V${top - f * 0.75} H${x + w * 0.74} V${top - f * 0.4} H${x + w * 0.88} V${top} H${x + w} ${end}`;
    case 'spire':
      return `${base} H${x + w / 2 - 4} L${x + w / 2} ${top - f} L${x + w / 2 + 4} ${top} H${x + w} ${end}`;
    case 'pitched':
      return `${base} L${x + w / 2} ${top - f} L${x + w} ${top} ${end}`;
    case 'dome':
      return `${base} H${x + w * 0.2} A${w * 0.3} ${f} 0 0 1 ${x + w * 0.8} ${top} H${x + w} ${end}`;
    case 'slant':
      return `${base} L${x + w} ${top + f} ${end}`;
    case 'tank':
      // A water tank on short legs, the kind perched on older rooftops.
      return `${base} H${x + w} ${end} M${x + w * 0.3} ${top} V${top - 5} H${x + w * 0.32} V${top} Z M${x + w * 0.56} ${top} V${top - 5} H${x + w * 0.58} V${top} Z M${x + w * 0.26} ${top - 5} V${top - 14} Q${x + w * 0.44} ${top - 18} ${x + w * 0.62} ${top - 14} V${top - 5} Z`;
    case 'plant':
      // Rooftop machinery: a couple of boxes of uneven size.
      return `${base} H${x + w} ${end} M${x + w * 0.15} ${top} V${top - 6} H${x + w * 0.4} V${top} Z M${x + w * 0.55} ${top} V${top - 4} H${x + w * 0.7} V${top} Z`;
    default:
      return `${base} H${x + w} ${end}`;
  }
}

function roofline(buildings: Building[], height: number) {
  return buildings.map((b) => outline(b, height)).join(' ');
}

// The mascot's antenna goes on the tallest flat-topped building toward the right, so it never floats above a dome.
function antennaBuilding(buildings: Building[], width: number) {
  const candidates = buildings.filter((b) => (b.roof === 'flat' || b.roof === 'setback' || b.roof === 'plant') && b.x > width * 0.5 && b.x < width - 40);
  const pool = candidates.length ? candidates : buildings;
  const best = pool.reduce((a, b) => (b.h > a.h ? b : a), pool[0]);
  const roofTop = best.roof === 'setback' ? best.h + best.feature : best.h;
  return { x: best.x + best.w / 2, roofTop };
}

// The three skylines for a scene. Every caller builds them the same way, so perch positions always line up.
function layers(scene: Scene, width: number, height: number, hero: boolean) {
  const { seed, tall, roofs } = scene.city;
  const quietX = landmarkX(width);
  return {
    far: skyline(width, height, seed + 7, height * 0.45, height * Math.min(0.95, tall + 0.3), 0.12, 0, scene.windows, roofs),
    mid: hero ? skyline(width, height, seed + 13, height * 0.3, height * Math.min(0.85, tall + 0.15), 0.16, 0.18, scene.windows, roofs, quietX) : [],
    near: skyline(width, height, seed, height * 0.18, height * tall, 0.22, hero ? 0.14 : 0.04, scene.windows, roofs, quietX),
  };
}

/**
 * The skyline spot the mascot lands on in this city (top-left of a <HangingBat>, relative to the city): its landmark,
 * or the rooftop antenna. Screens whose bat usually sleeps on a button still land on the skyline first.
 */
export function cityPerch(scene: Scene, width: number, height: number, hero = false) {
  if (scene.perch === 'landmark') return landmarkPerch(scene.landmark, { width, height });
  const a = antennaBuilding(layers(scene, width, height, hero).near, width);
  return { x: a.x + 2, y: height - a.roofTop - 21 };
}

/**
 * Every place in this city the bat can hang from, the landing perch first: the landmark, the antenna, and the edges of
 * a few flat rooftops spread across the skyline. `layer` says which building layer it sits on, so on scrolling heroes
 * the bat moves with that layer's parallax and stays put on its building.
 */
export type CitySpot = { x: number; y: number; layer: 'landmark' | 'near' };
export function citySpots(scene: Scene, width: number, height: number, hero = false): CitySpot[] {
  const { near } = layers(scene, width, height, hero);
  const a = antennaBuilding(near, width);
  const antenna: CitySpot = { x: a.x + 2, y: height - a.roofTop - 21, layer: 'near' };
  const out: CitySpot[] = [{ ...cityPerch(scene, width, height, hero), layer: scene.perch === 'landmark' ? 'landmark' : 'near' }];
  if (scene.perch === 'landmark') out.push(antenna);
  // Roof edges: the corner of a flat roof, a little in from the side, well apart from each other and the antenna.
  const roofs = near.filter((b) => (b.roof === 'flat' || b.roof === 'plant') && b.w > 26 && b.x > 16 && b.x + b.w < width - 16 && b.h > height * 0.25);
  for (const b of roofs) {
    const spot: CitySpot = { x: b.x + b.w - 14, y: height - b.h + 1, layer: 'near' };
    if (out.every((o) => Math.abs(o.x - spot.x) > width * 0.16)) out.push(spot);
    if (out.length >= 5) break;
  }
  return out;
}

type ViewRef = React.ComponentRef<typeof View>;

const nameOf = (scene: Scene) => (Object.keys(scenes) as SceneName[]).find((k) => scenes[k] === scene);

// Records where this city (and its perch) sits on screen each time the screen is focused, for BatTransition.
function Recorder({ target, scene, hero, spots }: { target: React.RefObject<ViewRef | null>; scene: Scene; hero: boolean; spots: CitySpot[] }) {
  const measure = useCallback(() => {
    const name = nameOf(scene);
    if (!name) return;
    // Wait a frame so layout (and any scroll restore) has settled.
    requestAnimationFrame(() =>
      target.current?.measureInWindow((x, y, width, height) => {
        if (!width) return;
        recordCity(name, { x, y, width, height, hero });
        recordSpots(name, 'city', spots.map((s) => ({ x: x + s.x, y: y + s.y })));
      })
    );
  }, [hero, scene, spots, target]);
  // Re-check while focused: scrolling the page moves the city and its spots.
  useFocusEffect(
    useCallback(() => {
      measure();
      const timer = setInterval(measure, 150);
      return () => clearInterval(timer);
    }, [measure])
  );
  return null;
}

const Layer = memo(function Layer({ buildings, width, height, fill, windowOpacity, windowScale = 1 }: { buildings: Building[]; width: number; height: number; fill: string; windowOpacity: number; windowScale?: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, bottom: 0 }}>
      <Path d={roofline(buildings, height)} fill={fill} />
      {buildings.flatMap((b) => b.windows.filter((w) => w.lit).map((w) => <Rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width={WIN * windowScale} height={w.h * windowScale} fill={w.tint} opacity={windowOpacity} />))}
    </Svg>
  );
});

// A window that turns on and off on its own slow schedule, like someone moving between rooms.
function FlickerWindow({ x, y, h, delay, tint }: { x: number; y: number; h: number; delay: number; tint: string }) {
  const on = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(on, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(5000 + delay),
        Animated.timing(on, { toValue: 0, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(3000),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, on]);
  return <Animated.View style={{ position: 'absolute', left: x, top: y, width: WIN, height: h, backgroundColor: tint, opacity: on }} />;
}

// Rooftop neon sign: a glowing outline that hums, then buzzes off for a beat now and then.
function NeonSign({ x, y, color, shape, delay }: { x: number; y: number; color: string; shape: 'note' | 'book'; delay: number }) {
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(6000 + delay),
        Animated.timing(glow, { toValue: 0.25, duration: 60, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 60, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, glow]);
  const d = shape === 'note' ? 'M10 18 A3.5 3 0 1 1 10 17.9 M13.4 18 V4 L22 2 V15 M22 15 A3.5 3 0 1 1 22 14.9 M13.4 7 L22 5' : 'M3 6 Q9 3 14 6 Q19 3 25 6 V20 Q19 17 14 20 Q9 17 3 20 Z M14 6 V20';
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: y, opacity: glow }}>
      <Svg width={28} height={24}>
        <Path d={d} stroke={color} strokeWidth={5} opacity={0.25} fill="none" strokeLinejoin="round" />
        <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

function parallax(scrollY: Animated.Value | undefined, rate: number, max: number) {
  return scrollY ? scrollY.interpolate({ inputRange: [0, max / rate], outputRange: [0, max], extrapolate: 'clamp' }) : 0;
}

/**
 * Night skyline pinned to the bottom of its parent, with the scene's landmark in the back. `calm` is a single quiet
 * skyline for reading screens; `hero` adds a third layer, neon signs and parallax (pass the screen's scroll value).
 * The mascot itself is drawn by RoamingBat, not here. `record` is set by screens so RoamingBat and BatTransition know
 * where this city and its spots are.
 */
export function NightCity({ width, height = 150, animated = true, variant = 'calm', scrollY, scene = scenes.midnight, record = false }: { width: number; height?: number; animated?: boolean; variant?: CityVariant; scrollY?: Animated.Value; scene?: Scene; record?: boolean }) {
  const hero = variant === 'hero';
  const { far, mid, near } = useMemo(() => layers(scene, width, height, hero), [hero, width, height, scene]);
  const spots = useMemo(() => citySpots(scene, width, height, hero), [hero, width, height, scene]);
  const door = useMemo(() => landmarkDoor(scene.landmark, { width, height }), [height, scene, width]);
  const root = useRef<ViewRef>(null);

  const antenna = useMemo(() => antennaBuilding(near, width), [near, width]);
  const flicker = useMemo(() => {
    const dark = near.flatMap((b) => b.windows.filter((w) => !w.lit));
    const rand = seeded(31);
    return Array.from({ length: Math.min(hero ? 10 : 6, dark.length) }, () => dark[Math.floor(rand() * dark.length)]);
  }, [hero, near]);
  const signs = useMemo(() => {
    if (!hero) return [];
    const roofs = mid.filter((b) => b.w > 30 && (b.roof === 'flat' || b.roof === 'plant') && b.x > 10 && b.x < width - 40);
    return [roofs[1], roofs[Math.floor(roofs.length * 0.6)]].filter(Boolean).map((b, i) => ({ x: b.x + b.w / 2 - 14, y: height - b.h - 26, color: i ? night.neonCyan : night.neonPink, shape: (i ? 'book' : 'note') as 'note' | 'book' }));
  }, [hero, mid, height, width]);

  const antennaX = antenna.x;
  const antennaTop = height - antenna.roofTop - 26;

  return (
    // A screen's own city (`record`) eases down and fades when you leave it for a building, and cross-fades with the
    // big skyline (`tallness`) during tab trips.
    <Animated.View ref={root} pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height }, record && { opacity: Animated.multiply(departing.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), tallness.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })), transform: [{ translateY: departing.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }) }] }]}>
      {record && <Recorder target={root} scene={scene} hero={hero} spots={spots} />}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, transform: [{ translateY: parallax(scrollY, 0.12, height * 0.3) }] }}>
        <Layer buildings={far} width={width} height={height} fill={scene.far} windowOpacity={0.5} windowScale={0.8} />
      </Animated.View>
      {/* The landmark stands behind the nearer buildings, which are kept low around it */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, transform: [{ translateY: parallax(scrollY, 0.2, height * 0.4) }] }}>
        <Landmark scene={scene} width={width} height={height} animated={animated} />
        {/* The door the bat flies through when you open a page from this screen */}
        <View style={{ position: 'absolute', left: door.x - 4, top: door.y - 6, width: 8, height: 12, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: night.window, opacity: 0.9 }} />
      </Animated.View>
      {hero && (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, transform: [{ translateY: parallax(scrollY, 0.25, height * 0.5) }] }}>
          <Layer buildings={mid} width={width} height={height} fill={scene.mid} windowOpacity={0.7} />
          {animated ? signs.map((sign, i) => <NeonSign key={i} {...sign} delay={i * 4300} />) : null}
        </Animated.View>
      )}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, transform: [{ translateY: parallax(scrollY, 0.45, height * 0.8) }] }}>
        <Layer buildings={near} width={width} height={height} fill={scene.near} windowOpacity={0.88} />
        {animated && flicker.map((w, i) => <FlickerWindow key={i} x={w.x} y={w.y} h={w.h} tint={w.tint} delay={i * 1700} />)}
        {/* Antenna with a crossbar for the mascot to hang from */}
        <View style={{ position: 'absolute', left: antennaX - 1, top: antennaTop, width: 2, height: 26, backgroundColor: scene.near }} />
        <View style={{ position: 'absolute', left: antennaX - 12, top: antennaTop + 4, width: 24, height: 2, borderRadius: 1, backgroundColor: scene.near }} />
        <View style={{ position: 'absolute', left: antennaX - 2, top: antennaTop - 3, width: 4, height: 4, borderRadius: 2, backgroundColor: night.neonPink }} />
      </Animated.View>
      {/* The mascot lives in the live city, so it scrolls with it and sits behind the page content */}
      {record && <CityBat scene={scene} spots={spots} shift={{ landmark: parallax(scrollY, 0.2, height * 0.4), near: parallax(scrollY, 0.45, height * 0.8) }} />}
    </Animated.View>
  );
}
