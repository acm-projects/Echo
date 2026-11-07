import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { router, usePathname } from 'expo-router';
import { night, scenes, type SceneName } from '../../../theme';
import { FlyingBat, HangingBat } from './Bat';
import { NightCity, cityPerch } from './NightCity';
import { TALL_SHARE, tallness, arrival, batSpot, departing, setBatSpot, cityFor, onPerchesChange, screenReadySince, setTraveling, skylineSpot, type Frame, type Spot } from './perchRegistry';
import { useReducedMotion } from './NightSky';
import { interiorForPath, sceneForPath } from './sceneStore';
import { INTERIOR_COLORS, type InteriorKind } from './Interiors';
import { landmarkDoor } from './Landmarks';
import { Landscape, type LandscapeKind } from './Landscape';

// `takeoff` is where the roaming bat was the instant the trip began, captured once so it can't drift mid-flight.
type Trip =
  | { mode: 'swipe'; from: SceneName; to: SceneName; dir: number; takeoff: Spot | null }
  // Into a building from a tab (enter) or back out to one (exit); `city` is the tab's scene.
  | { mode: 'enter' | 'exit'; city: SceneName; interior: InteriorKind; dir: number; takeoff: Spot | null }
  // Signing in: the bat leaves the moon, parts the clouds and flies into the city.
  | { mode: 'arrive'; to: SceneName; dir: number; takeoff: null };

// Before any navigation the current screen says goodbye, and only then does the route change.
// - Tab trips (a different outdoor scene) are run entirely by BatTransition, which quietly swaps the small city for
//   the big skyline with the bat on it, fades the buttons, then navigates and flies (see `startSwipe`).
// - Anything else: the city eases down and fades, then the buttons fade, then we navigate and a trip may follow.
// Every navigation goes through here (see installDepartures), with `dest` when we know where it's going.
let leaving = false;
let reduceMotion = false;
let startSwipe: ((dest: string, go: () => void) => boolean) | null = null;
export function depart(go: () => void, dest?: string) {
  if (leaving || reduceMotion) return go();
  if (dest && startSwipe?.(dest, go)) return;
  leaving = true;
  Animated.sequence([
    Animated.timing(departing, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    Animated.timing(arrival, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
  ]).start(() => {
    leaving = false;
    go();
    // If this navigation doesn't start a trip (same scene, or nowhere to go), bring everything straight back.
    setTimeout(() => {
      if (!tripRunning) restoreScreen();
    }, 60);
  });
}
let tripRunning = false;
function restoreScreen() {
  departing.setValue(0);
  Animated.spring(arrival, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
}

// The pages visited, so `back` can tell where it's going. Kept in step by BatTransition.
const visited: string[] = [];

function destinationOf(name: string, args: unknown[]): string | undefined {
  if (name === 'back' || name === 'dismiss') return visited[visited.length - 2];
  const href = args[0] as string | { pathname?: string } | undefined;
  return typeof href === 'string' ? href.split('?')[0] : href?.pathname;
}

// Wraps expo-router's imperative navigation once, so screens keep calling router.push() etc. as usual.
let installed = false;
function installDepartures() {
  if (installed) return;
  installed = true;
  const r = router as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const name of ['push', 'navigate', 'replace', 'back', 'dismiss', 'dismissTo']) {
    const original = r[name];
    if (typeof original !== 'function') continue;
    r[name] = (...args: unknown[]) => depart(() => original.apply(router, args), destinationOf(name, args));
  }
}

// Each trip's timeline, as fractions of `total` ms. Exits play the enter timeline backwards (1 → 0).
// `pause` is the checkpoint mid-flight: if the next screen isn't ready yet, the bat crosses open country there.
// `reveal` is when the next screen's content comes back in.
const TIMING = {
  // Tab trips: 0.00–0.08 swap to the big skyline, then the bat flies off-stage (OFFSTAGE) and we navigate, then it
  // flies back in from the other side.
  swipe: { total: 3400, pause: 0.45, reveal: 0.78 },
  enter: { total: 2400, pause: 0.56, reveal: 0.86 },
  exit: { total: 2400, pause: 0.56, reveal: 0.08 },
  arrive: { total: 4400, pause: 0.6, reveal: 0.86 },
} as const;
// Routes outside the city. Leaving one of these into the app plays the arrival.
const AUTH_ROUTES = new Set(['/', '/Test/welcome', '/Test/login', '/Test/signup', '/login']);
// When the bat has left the frame on a tab trip; the route changes then, out of sight.
const OFFSTAGE = 0.4;
// Give up waiting and land anyway after this long.
const MAX_WAIT = 8000;

// Scattered with a seeded sequence; simple modular spacing lines the stars up into a diagonal trail.
const STARS: [number, number, number][] = (() => {
  let n = 42;
  const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 26 }, () => [rand() * 100, rand() * 60, 0.35 + rand() * 0.5]);
})();

// Same order as the tab bar in Test/(tabs)/_layout.tsx, so the bat flies toward the tab you picked.
const TAB_ORDER = ['/Test/library', '/Test/shelf', '/Test/community', '/Test/profile'];

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

const BAT = 110;

const lerp = (p: Animated.Value) => <T extends number | string>(input: number[], output: T[]) => p.interpolate<T>({ inputRange: input, outputRange: output, extrapolate: 'clamp' });

// FlyingBat's box for a given hanging spot (HangingBat is 13 wide; the flyer hangs from its centre line).
const bx = (spot: Spot) => spot.x + 6 - BAT / 2;
const by = (spot: Spot) => spot.y - BAT * 0.3;

// Where a scene's city and perch really are on screen, falling back to a city along the bottom edge.
function cityFrame(name: SceneName, width: number, height: number): Frame {
  const cityH = Math.min(220, height * 0.28);
  return cityFor(name) ?? { x: 0, y: height - cityH, width, height: cityH, hero: false };
}
// The next screen's skyline perch, where the bat lands; computed from the city if the screen hasn't recorded it yet.
function perchSpot(name: SceneName, frame: Frame): Spot {
  const recorded = skylineSpot(name);
  if (recorded) return recorded;
  const local = cityPerch(scenes[name], frame.width, frame.height, frame.hero);
  return { x: frame.x + local.x, y: frame.y + local.y };
}
// Where the bat takes off from: wherever it was roaming when the trip began, or the screen's skyline perch.
function takeoffSpot(trip: Trip, name: SceneName, frame: Frame): Spot {
  return trip.takeoff ?? perchSpot(name, frame);
}

// A copy of a screen's city, drawn exactly where it sits on screen so the overlay starts and ends seamlessly.
function CityAt({ frame, scene, style }: { frame: Frame; scene: SceneName; style?: object }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height, transformOrigin: 'bottom' }, style]}>
      <NightCity width={frame.width} height={frame.height} animated={false} variant={frame.hero ? 'hero' : 'calm'} scene={scenes[scene]} />
    </Animated.View>
  );
}

function Stars() {
  return (
    <>
      {STARS.map(([x, y, o], i) => (
        <View key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 2, height: 2, borderRadius: 1, backgroundColor: night.star, opacity: o }} />
      ))}
    </>
  );
}

/**
 * Going into a building (and, played backwards, coming out):
 *   0.00–0.12  the bat wakes on its perch and lifts off.
 *   0.08–0.52  it flies to the lit door on the landmark and slips inside.
 *   0.30–0.85  the camera pushes in through that door until it fills the view...
 *   0.48–0.88  ...and the room's colour floods out from the doorway.
 *   0.90–1.00  the overlay fades, revealing the page inside.
 * The overlay is opaque from the first frame, so the next page is never glimpsed before the trip starts.
 */
function DoorTrip({ p, trip, width, height }: { p: Animated.Value; trip: Extract<Trip, { mode: 'enter' | 'exit' }>; width: number; height: number }) {
  const scene = scenes[trip.city];
  const frame = cityFrame(trip.city, width, height);
  // Entering, the bat leaves from wherever it is; exiting (played backwards), it ends on the skyline perch.
  const perch = trip.mode === 'enter' ? takeoffSpot(trip, trip.city, frame) : perchSpot(trip.city, frame);
  const local = landmarkDoor(scene.landmark, { width: frame.width, height: frame.height });
  const door = { x: frame.x + local.x, y: frame.y + local.y };
  const cover = (Math.hypot(width, height) * 2.2) / 24;
  const r = lerp(p);
  // Entering clears at the end of the timeline; exiting (played backwards) clears as it nears 0.
  const opacity = trip.mode === 'enter' ? r([0.9, 1], [1, 0]) : r([0, 0.06], [0, 1]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: r([0.3, 0.85], [1, 1.5]) }] }]}>
          <LinearGradient colors={scene.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
          <Stars />
        </Animated.View>
        {/* The camera pushes in on the doorway */}
        {/* Entering, the screen's city has just sunk away (depart), so it eases back up before the camera pushes in */}
        <CityAt frame={frame} scene={trip.city} style={{ transformOrigin: `${local.x}px ${local.y}px`, opacity: trip.mode === 'enter' ? r([0, 0.1], [0, 1]) : 1, transform: [{ translateY: trip.mode === 'enter' ? r([0, 0.1], [36, 0]) : 0 }, { scale: r([0.3, 0.85], [1, 16]) }] }} />
        {/* The room's colour floods out of the doorway */}
        <Animated.View style={{ position: 'absolute', left: door.x - 12, top: door.y - 12, width: 24, height: 24, borderRadius: 12, backgroundColor: INTERIOR_COLORS[trip.interior], opacity: r([0.46, 0.52], [0, 1]), transform: [{ scale: r([0.5, 0.88], [0.4, cover]) }] }} />
      </Animated.View>

      <Animated.View style={{ position: 'absolute', left: perch.x, top: perch.y, opacity: r([0, 0.08, 0.12], [1, 1, 0]) }}>
        <HangingBat size={13} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.06, 0.12, 0.5, 0.56], [0, 1, 1, 0]),
          transform: [
            { translateX: r([0.08, 0.5], [bx(perch), door.x - BAT / 2]) },
            { translateY: r([0.08, 0.28, 0.5], [by(perch), Math.min(perch.y, door.y) - 70, door.y - BAT * 0.3]) },
            { scale: r([0.08, 0.25, 0.5, 0.56], [0.15, 0.75, 0.3, 0.05]) },
            { rotate: r([0.08, 0.28, 0.5], [door.x > perch.x ? '10deg' : '-10deg', '0deg', door.x > perch.x ? '-8deg' : '8deg']) },
          ],
        }}
      >
        <FlyingBat size={BAT} flapMs={180} />
      </Animated.View>
    </View>
  );
}

/**
 * Between tabs. The screens themselves swap their small city for a big skyline beneath their content (`tallness`),
 * so this overlay only draws the bat:
 *   0.00–0.08  the small city and its bat fade out as the big skyline, with the bat on it, fades in. Quick and quiet.
 *   0.08       the buttons fade.
 *   0.10–0.40  the bat lifts off and flies out through the side of the screen toward the next tab. The old city is
 *              still there; only once the bat is gone (OFFSTAGE) does the route change and the city with it.
 *   0.45       checkpoint: if the next screen is still loading, the bat crosses open country until it's ready.
 *   0.47–0.74  it flies in from the opposite side, still heading the same way, and lands on the new big skyline.
 *   0.78       the new screen's buttons come in, over the big skyline.
 *   0.88–0.95  the big skyline fades back into the new page's small city, the bat onto its real perch.
 */
function SkylineTrip({ p, trip, width, height }: { p: Animated.Value; trip: Extract<Trip, { mode: 'swipe' }>; width: number; height: number }) {
  const { dir } = trip;
  const toFrame = cityFrame(trip.to, width, height);
  const fromSmall = takeoffSpot(trip, trip.from, cityFrame(trip.from, width, height));
  const toSmall = perchSpot(trip.to, toFrame);
  // Perches on each scene's big skyline, which sits along the bottom of the screen.
  const bigH = height * TALL_SHARE;
  const onBig = (scene: SceneName) => {
    const local = cityPerch(scenes[scene], width, bigH, true);
    return { x: local.x, y: height - bigH + local.y };
  };
  const fromBig = onBig(trip.from);
  const toBig = onBig(trip.to);
  const cruiseY = Math.min(fromBig.y, toBig.y) - height * 0.16;
  // Out of frame on the side we're heading, back in from the other side.
  const exitX = dir > 0 ? width + 30 : -BAT - 30;
  const entryX = dir > 0 ? -BAT - 30 : width + 30;
  const r = lerp(p);
  const hang = (spot: Spot, opacity: Animated.AnimatedInterpolation<number>) => (
    <Animated.View style={{ position: 'absolute', left: spot.x, top: spot.y, opacity }}>
      <HangingBat size={13} />
    </Animated.View>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Small city's bat out, big skyline's bat in, at the same time as the skylines swap */}
      {hang(fromSmall, r([0, 0.07], [1, 0]))}
      {hang(fromBig, r([0, 0.07, 0.1, 0.11], [0, 1, 1, 0]))}

      {/* Out through the side toward the next tab; then, in the new city, back in from the other side to land */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.1, 0.11, 0.4, 0.41, 0.46, 0.47, 0.73, 0.74], [0, 1, 1, 0, 0, 1, 1, 0]),
          transform: [
            { translateX: r([0.1, 0.4, 0.47, 0.74], [bx(fromBig), exitX, entryX, bx(toBig)]) },
            { translateY: r([0.1, 0.24, 0.4, 0.47, 0.62, 0.74], [by(fromBig), cruiseY, cruiseY - 14, cruiseY - 10, cruiseY + 12, by(toBig)]) },
            { scale: r([0.1, 0.24, 0.62, 0.74], [0.15, 0.9, 0.9, 0.15]) },
            { rotate: r([0.1, 0.24, 0.4, 0.47, 0.62, 0.74], [`${dir * 6}deg`, `${dir * 12}deg`, `${dir * 10}deg`, `${dir * 10}deg`, `${-dir * 8}deg`, '0deg']) },
          ],
        }}
      >
        <FlyingBat size={BAT} flapMs={200} />
      </Animated.View>

      {/* On the new big skyline while the buttons come in, then onto the small city as the skyline shrinks back */}
      {hang(toBig, r([0.73, 0.74, 0.88, 0.95], [0, 1, 1, 0]))}
      {hang(toSmall, r([0.88, 0.95, 0.99, 1], [0, 1, 1, 0]))}
    </View>
  );
}

// A soft bank of cloud: overlapping puffs along the top of a solid base. `side` mirrors it for the right half.
function CloudBank({ width, height, color }: { width: number; height: number; color: string }) {
  const puffs = [0.08, 0.26, 0.44, 0.62, 0.8, 0.98].map((x, i) => ({ cx: x * width, cy: height * (0.36 + (i % 2) * 0.1), r: height * (0.3 + (i % 3) * 0.06) }));
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={height * 0.45} width={width} height={height * 0.55} fill={color} />
      {puffs.map((c, i) => <Circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={color} />)}
    </Svg>
  );
}

/**
 * Signing in. The bat leaves the moon, the clouds part, and it flies away from us into a much bigger city:
 *   0.00–0.06  the bat hangs from the tip of the crescent moon above the clouds.
 *   0.05–0.22  it drops off and swoops down toward the camera.
 *   0.16–0.38  the cloud bank splits down the middle and rolls aside, revealing a wide city far below.
 *   0.28–0.34  it turns, and we see it from behind as it heads down into the city...
 *   0.34–0.84  ...flying slowly away from us, shrinking into the distance, while the view eases in on the part of the
 *              city we're arriving in (0.60–0.84) and the sky becomes that screen's night.
 *   0.84       it perches; the screen's content comes in at 0.86 and the overlay clears by 1.00.
 */
function ArriveTrip({ p, trip, width, height }: { p: Animated.Value; trip: Extract<Trip, { mode: 'arrive' }>; width: number; height: number }) {
  const to = scenes[trip.to];
  const frame = cityFrame(trip.to, width, height);
  const end = perchSpot(trip.to, frame);
  const r = lerp(p);

  const moon = { x: width / 2, y: height * 0.16, r: 54 };
  const tip = { x: moon.x + moon.r * 0.42, y: moon.y + moon.r * 0.72 };
  const swoop = { x: width / 2 - BAT / 2, y: height * 0.5 };
  const cloudH = height * 0.42;
  const wideW = width * 2.4;
  const wideH = height * 0.5;
  const zoomOut = width / wideW;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.88, 1], [1, 0]) }]}>
        {/* The login sky, turning into the night of the screen we're arriving at */}
        <LinearGradient colors={['#170033', '#2A1250', '#3A1763']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.3, 0.7], [0, 1]) }]}>
          <LinearGradient colors={to.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Stars />

        {/* The moon drifts up out of frame as we descend */}
        <Animated.View style={{ position: 'absolute', left: moon.x - moon.r, top: moon.y - moon.r, opacity: r([0.3, 0.5], [1, 0]), transform: [{ translateY: r([0.1, 0.5], [0, -height * 0.3]) }] }}>
          <Svg width={moon.r * 2} height={moon.r * 2}>
            <Circle cx={moon.r} cy={moon.r} r={moon.r} fill={night.window} opacity={0.08} />
            <Path d={`M${moon.r} ${moon.r * 0.25} A${moon.r * 0.75} ${moon.r * 0.75} 0 1 0 ${moon.r} ${moon.r * 1.75} A${moon.r * 0.55} ${moon.r * 0.75} 0 1 1 ${moon.r} ${moon.r * 0.25} Z`} fill={night.window} transform={`rotate(-28 ${moon.r} ${moon.r})`} />
          </Svg>
        </Animated.View>

        {/* A far bigger city than any one screen shows, seen from high above; then the view eases in on our part */}
        <Animated.View style={{ position: 'absolute', left: (width - wideW) / 2, bottom: 0, width: wideW, height: wideH, transformOrigin: 'bottom', opacity: r([0.14, 0.24, 0.8, 0.86], [0, 1, 1, 0]), transform: [{ scale: r([0.18, 0.6, 0.84], [zoomOut * 0.9, zoomOut, 1]) }] }}>
          <NightCity width={wideW} height={wideH} animated={false} variant="hero" scene={to} />
        </Animated.View>
        {/* ...which hands over to the screen's own city exactly where it sits */}
        <CityAt frame={frame} scene={trip.to} style={{ opacity: r([0.8, 0.86], [0, 1]) }} />

        {/* The clouds split down the middle and roll aside */}
        <Animated.View style={{ position: 'absolute', left: 0, top: height * 0.4, opacity: r([0.3, 0.4], [1, 0]), transform: [{ translateX: r([0.16, 0.38], [0, -width * 0.75]) }] }}>
          <CloudBank width={width * 0.62} height={cloudH} color="#5B3479" />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: width * 0.38, top: height * 0.38, opacity: r([0.3, 0.4], [1, 0]), transform: [{ translateX: r([0.16, 0.38], [0, width * 0.75]) }, { scaleX: -1 }] }}>
          <CloudBank width={width * 0.62} height={cloudH} color="#6B3E86" />
        </Animated.View>
      </Animated.View>

      {/* Asleep on the moon's tip, for a breath */}
      <Animated.View style={{ position: 'absolute', left: tip.x, top: tip.y, opacity: r([0, 0.05, 0.07], [1, 1, 0]), transform: [{ translateY: r([0, 0.1], [0, 0]) }] }}>
        <HangingBat size={14} />
      </Animated.View>

      {/* The swoop down toward us, facing the camera */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.05, 0.07, 0.29, 0.33], [0, 1, 1, 0]),
          transform: [
            { translateX: r([0.05, 0.2], [tip.x + 7 - BAT / 2, swoop.x]) },
            { translateY: r([0.05, 0.14, 0.22], [tip.y - BAT * 0.3, height * 0.28, swoop.y]) },
            { scale: r([0.05, 0.22], [0.15, 1.5]) },
            { rotate: r([0.05, 0.14, 0.22], ['-18deg', '10deg', '0deg']) },
          ],
        }}
      >
        <FlyingBat size={BAT} flapMs={130} />
      </Animated.View>

      {/* Turned away from us, flying slowly down into the city and onto the perch */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.28, 0.33, 0.82, 0.85], [0, 1, 1, 0]),
          transform: [
            { translateX: r([0.3, 0.6, 0.84], [swoop.x, (swoop.x + bx(end)) / 2 + width * 0.08, bx(end)]) },
            { translateY: r([0.3, 0.6, 0.84], [swoop.y, (swoop.y + by(end)) / 2 + 20, by(end)]) },
            { scale: r([0.3, 0.6, 0.84], [1.5, 0.6, 0.15]) },
            { rotate: r([0.3, 0.5, 0.7, 0.84], ['0deg', '6deg', '-5deg', '0deg']) },
          ],
        }}
      >
        <FlyingBat size={BAT} flapMs={210} away />
      </Animated.View>

      <Animated.View style={{ position: 'absolute', left: end.x, top: end.y, opacity: r([0.83, 0.86, 0.97, 1], [0, 1, 1, 0]) }}>
        <HangingBat size={13} />
      </Animated.View>
    </View>
  );
}

/**
 * Sits above every screen and plays a short trip whenever the route changes: a skyline crossing between tabs
 * (SkylineTrip), or going in and out of a building for pages opened from a tab (DoorTrip). If the next screen is
 * slow to load, the trip pauses mid-flight over open country (Landscape) until it's ready. Screens that share a scene
 * don't trigger it, and Reduce Motion turns it off.
 */
export function BatTransition() {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const last = useRef<{ path: string; scene: SceneName | null; interior: InteriorKind | null } | null>(null);
  const history = useRef<string[]>([]);
  const trips = useRef(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [waiting, setWaiting] = useState<LandscapeKind | null>(null);
  const waitFade = useRef(new Animated.Value(0)).current;
  // The destination screen records its city and perch a moment after it mounts; redraw when it does.
  const [, setTick] = useState(0);
  useEffect(() => (trip ? onPerchesChange(() => setTick((n) => n + 1)) : undefined), [trip]);

  // Runs one trip. `go` is the navigation still to happen: tab trips start before navigating (see startSwipe), so
  // the swap to the big skyline and the buttons fading play on the old screen first. Trips aren't tied to an effect's
  // lifetime, because their own navigation re-runs the route effect.
  const play = (next: Trip, go?: () => void) => {
    const timing = TIMING[next.mode];
    const backwards = next.mode === 'exit';
    const swipe = next.mode === 'swipe';
    const startedAt = Date.now();
    const easeIn = Easing.in(Easing.sin);
    let unsubscribe: (() => void) | undefined;

    busy.current = true;
    tripRunning = true;
    setTraveling(true);
    // Building trips start after the old city has sunk away; the next screen's city should be in place at the end.
    departing.setValue(0);
    trips.current += 1;
    setTrip(next);
    p.setValue(backwards ? 1 : 0);

    const finish = () => {
      busy.current = false;
      tripRunning = false;
      setBatSpot(null);
      setTraveling(false);
      setTrip(null);
    };
    const at = (fraction: number, from: number, run: () => void) => setTimeout(run, Math.abs(fraction - from) * timing.total);
    const secondHalf = () => {
      const end = backwards ? 0 : 1;
      at(timing.reveal, timing.pause, () => Animated.spring(arrival, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start());
      // Tab trips: once the buttons are back, the big skyline fades into the new page's small city.
      if (swipe) at(0.88, timing.pause, () => Animated.timing(tallness, { toValue: 0, duration: 240, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start());
      Animated.timing(p, { toValue: end, duration: Math.abs(end - timing.pause) * timing.total, easing: Easing.out(Easing.sin), useNativeDriver: true }).start(finish);
    };
    const checkpoint = () => {
      if (screenReadySince(startedAt)) return secondHalf();
      // Not ready yet: fly on over open country until it is (or until we've waited long enough).
      setWaiting(trips.current % 2 ? 'forest' : 'road');
      Animated.timing(waitFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      const resume = () => {
        unsubscribe?.();
        unsubscribe = undefined;
        Animated.timing(waitFade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setWaiting(null));
        secondHalf();
      };
      unsubscribe = onPerchesChange(() => screenReadySince(startedAt) && resume());
      setTimeout(() => unsubscribe && resume(), MAX_WAIT);
    };
    // Ease in to the checkpoint and out of it: the halves meet at the same speed, so the bat never stalls mid-air.
    const toCheckpoint = (from: number) =>
      Animated.timing(p, { toValue: timing.pause, duration: Math.abs(timing.pause - from) * timing.total, easing: easeIn, useNativeDriver: true }).start(checkpoint);

    if (!swipe) {
      // The content under the overlay disappears now and comes back with the bat.
      arrival.setValue(0);
      return toCheckpoint(backwards ? 1 : 0);
    }
    // Tab trip: swap quietly to the big skyline (bat and all) and fade the buttons, then the bat flies out of frame.
    // Only once it's gone do we navigate, so the city changes while nobody's watching.
    Animated.timing(tallness, { toValue: 1, duration: 0.08 * timing.total, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(p, { toValue: 0.08, duration: 0.08 * timing.total, easing: Easing.linear, useNativeDriver: true }).start(() => {
      Animated.timing(arrival, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
      Animated.timing(p, { toValue: OFFSTAGE, duration: (OFFSTAGE - 0.08) * timing.total, easing: easeIn, useNativeDriver: true }).start(() => {
        go?.();
        toCheckpoint(OFFSTAGE);
      });
    });
  };

  // Tab trips are started by `depart`, before navigating, so the old screen can say goodbye first.
  const preHandled = useRef<string | null>(null);
  useEffect(() => {
    startSwipe = (dest, go) => {
      const prev = last.current;
      const to = sceneForPath(dest);
      if (!prev || prev.interior || !prev.scene || !to || to === prev.scene || busy.current || reduced || AUTH_ROUTES.has(prev.path)) return false;
      preHandled.current = dest;
      play({ mode: 'swipe', from: prev.scene, to, dir: directionOf(history.current, prev.path, dest), takeoff: batSpot() }, go);
      return true;
    };
    return () => {
      startSwipe = null;
    };
  });

  // Every other trip is decided here, from the route alone, the moment it changes. It's a layout effect so the
  // overlay is up before the next screen is ever painted.
  const pathname = usePathname();
  useEffect(() => {
    installDepartures();
  }, []);
  useEffect(() => {
    reduceMotion = reduced;
  }, [reduced]);
  useLayoutEffect(() => {
    if (visited[visited.length - 2] === pathname) visited.pop();
    else if (visited[visited.length - 1] !== pathname) visited.push(pathname);

    const prev = last.current;
    const outdoor = sceneForPath(pathname);
    const interior = interiorForPath(pathname);
    // Indoors (or on a route with no scene) we're still in the city we walked in from.
    const scene = outdoor ?? prev?.scene ?? null;
    last.current = { path: pathname, scene, interior };
    // A tab trip already under way arrived here; its direction was worked out when it started.
    if (preHandled.current === pathname) {
      preHandled.current = null;
      return;
    }
    const dir = prev ? directionOf(history.current, prev.path, pathname) : 1;
    if (!prev) history.current = [pathname];
    if (!prev || reduced || busy.current) return;

    const takeoff = batSpot();
    let next: Trip | null = null;
    if (AUTH_ROUTES.has(prev.path) && outdoor) next = { mode: 'arrive', to: outdoor, dir: 1, takeoff: null };
    else if (interior && !prev.interior && prev.scene) next = { mode: 'enter', city: prev.scene, interior, dir, takeoff };
    else if (prev.interior && !interior && outdoor) next = { mode: 'exit', city: outdoor, interior: prev.interior, dir, takeoff: null };
    else if (!interior && !prev.interior && prev.scene && scene && scene !== prev.scene) next = { mode: 'swipe', from: prev.scene, to: scene, dir, takeoff };
    if (next) play(next);
    // `play` only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, reduced]);

  if (!trip) return null;
  return (
    <>
      {trip.mode === 'swipe' ? <SkylineTrip p={p} trip={trip} width={width} height={height} /> : trip.mode === 'arrive' ? <ArriveTrip p={p} trip={trip} width={width} height={height} /> : <DoorTrip p={p} trip={trip} width={width} height={height} />}
      {waiting && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: waitFade }]}>
          <Landscape kind={waiting} scene={scenes[trip.mode === 'swipe' || trip.mode === 'arrive' ? trip.to : trip.city]} dir={trip.dir} />
        </Animated.View>
      )}
    </>
  );
}
