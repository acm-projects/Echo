import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { router, usePathname } from 'expo-router';
import { night, scenes, type SceneName } from '../../../theme';
import { FlyingBat, HangingBat } from './Bat';
import { NightCity, cityPerch } from './NightCity';
import { TALL_SHARE, tallness, arrival, batSpot, departing, setBatSpot, cityFor, moonFrame, onPerchesChange, screenReadySince, setTraveling, skylineSpot, type Frame, type Spot } from './perchRegistry';
import { useReducedMotion } from './NightSky';
import { MOTION_KEYS, currentSettings, useSettings, type MotionKind } from '../../data/settings';
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
  | { mode: 'arrive'; to: SceneName; dir: number; takeoff: null }
  // Signing out: the bat rises out of the city, the clouds close beneath it and it flies home to the moon.
  | { mode: 'leave'; from: SceneName; dir: number; takeoff: Spot | null };

// Which Settings switch each trip answers to.
const MOTION_FOR: Record<Trip['mode'], MotionKind> = { swipe: 'navigation', enter: 'rooms', exit: 'rooms', arrive: 'opening', leave: 'opening' };
let reduceMotion = false;
const allowed = (kind: MotionKind) => !reduceMotion && currentSettings()[MOTION_KEYS[kind]];

// Before any navigation the current screen says goodbye, and only then does the route change.
// - Tab trips (a different outdoor scene) are run entirely by BatTransition, which quietly swaps the small city for
//   the big skyline with the bat on it, fades the buttons, then navigates and flies (see `startSwipe`).
// - Anything else: the city eases down and fades, then the buttons fade, then we navigate and a trip may follow.
// Every navigation goes through here (see installDepartures), with `dest` when we know where it's going.
let leaving = false;
let startSwipe: ((dest: string, go: () => void) => boolean) | null = null;
// What a navigation to `dest` would play, from where we are now (null: no trip, just the goodbye fade).
let tripTo: ((dest: string) => Trip['mode'] | null) | null = null;
export function depart(go: () => void, dest?: string) {
  if (leaving || (dest && QUIET_ROUTES.has(dest)) || QUIET_ROUTES.has(visited[visited.length - 1] ?? '')) return go();
  const kind = dest && tripTo ? tripTo(dest) : null;
  // Switched off in Settings: go straight there. Plain page changes count as navigation.
  if (!allowed(kind ? MOTION_FOR[kind] : 'navigation')) return go();
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
  enter: { total: 2000, pause: 0.56, reveal: 0.86 },
  exit: { total: 2000, pause: 0.56, reveal: 0.08 },
  arrive: { total: 4400, pause: 0.6, reveal: 0.86 },
  leave: { total: 4400, pause: 0.45, reveal: 0.9 },
} as const;
// Routes outside the city. Leaving one of these into the app plays the arrival.
const AUTH_ROUTES = new Set(['/', '/Test/welcome', '/Test/login', '/Test/signup', '/login']);
// Same order as the tab bar in Test/(tabs)/_layout.tsx, so the bat flies toward the tab you picked. Signing in lands
// on one of these.
const TAB_ORDER = ['/Test/library', '/Test/shelf', '/Test/community', '/Test/profile'];
// Pages that open and close plainly, with no trip and no goodbye: playback settings, opened from the player.
const QUIET_ROUTES = new Set(['/Test/playback-settings']);
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


type Place = { path: string; scene: SceneName | null; interior: InteriorKind | null };

// The trip a route change plays, decided from the route alone.
function tripKind(prev: Place, path: string): Trip['mode'] | null {
  if (QUIET_ROUTES.has(path) || QUIET_ROUTES.has(prev.path)) return null;
  const outdoor = sceneForPath(path);
  const interior = interiorForPath(path);
  const scene = outdoor ?? prev.scene;
  if (AUTH_ROUTES.has(prev.path)) return TAB_ORDER.includes(path) && outdoor ? 'arrive' : null;
  if (AUTH_ROUTES.has(path)) return prev.scene ? 'leave' : null;
  if (interior && !prev.interior && prev.scene) return 'enter';
  if (prev.interior && !interior && outdoor) return 'exit';
  if (!interior && !prev.interior && prev.scene && scene && scene !== prev.scene) return 'swipe';
  return null;
}

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

// A city along the bottom edge, for when a screen's own isn't known or isn't on screen.
function defaultFrame(width: number, height: number): Frame {
  const cityH = Math.min(220, height * 0.28);
  return { x: 0, y: height - cityH, width, height: cityH, hero: false };
}
// Where a scene's city really is on screen.
function cityFrame(name: SceneName, width: number, height: number): Frame {
  return cityFor(name) ?? defaultFrame(width, height);
}
// The skyline perch on a given city frame, ignoring what the screen recorded.
function computedPerch(name: SceneName, frame: Frame): Spot {
  const local = cityPerch(scenes[name], frame.width, frame.height, frame.hero);
  return { x: frame.x + local.x, y: frame.y + local.y };
}
// The next screen's skyline perch, where the bat lands; computed from the city if the screen hasn't recorded it yet.
function perchSpot(name: SceneName, frame: Frame): Spot {
  return skylineSpot(name) ?? computedPerch(name, frame);
}
// Where the bat takes off from: wherever it was roaming when the trip began, or the screen's skyline perch.
function takeoffSpot(trip: Trip, name: SceneName, frame: Frame): Spot {
  return trip.takeoff ?? perchSpot(name, frame);
}

// A copy of a screen's city, drawn exactly where it sits on screen so the overlay starts and ends seamlessly.
// Screens end above the tab bar, so their city does too; the overlay covers the whole window, so the buildings carry
// on down to its foot (`bottom`) rather than floating over empty sky.
function CityAt({ frame, scene, bottom, style }: { frame: Frame; scene: SceneName; bottom: number; style?: object }) {
  const below = Math.max(0, bottom - (frame.y + frame.height));
  return (
    <Animated.View style={[{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height + below, transformOrigin: 'bottom' }, style]}>
      <NightCity width={frame.width} height={frame.height} animated={false} variant={frame.hero ? 'hero' : 'calm'} scene={scenes[scene]} />
      {below > 0 && <View style={{ position: 'absolute', left: 0, right: 0, top: frame.height - 1, height: below + 1, backgroundColor: scenes[scene].near }} />}
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
  // The screen's own city is mostly hidden behind the tab bar (or scrolled away, on Library), so the trip draws a full
  // one along the foot of the screen and the bat sets out from its skyline perch, flying in through the landmark door.
  const frame = defaultFrame(width, height);
  const local = landmarkDoor(scene.landmark, { width: frame.width, height: frame.height });
  const door = { x: frame.x + local.x, y: frame.y + local.y };
  const perch = computedPerch(trip.city, frame);
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
        <CityAt frame={frame} scene={trip.city} bottom={height} style={{ transformOrigin: `${local.x}px ${local.y}px`, opacity: trip.mode === 'enter' ? r([0, 0.1], [0, 1]) : 1, transform: [{ translateY: trip.mode === 'enter' ? r([0, 0.1], [36, 0]) : 0 }, { scale: r([0.3, 0.85], [1, 16]) }] }} />
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

const CLOUDS = require('../../../assets/images/echo-cloud-frame.png');
const LOGO = require('../../../assets/images/echo-logo.png');
const LOGIN_SKY = '#170033';

// Banks of cloud stacked up the screen, each its own drift direction, so the sky clears like weather rather than
// splitting in two. `top` is where a bank's crest starts, as a fraction of the screen height; `shift` staggers the
// valleys so they don't line up. Each bank keeps the art's own proportions and is solid cloud beneath.
const BANKS = [
  { top: -0.02, dir: -1, shift: 0.22, flip: false },
  { top: 0.14, dir: 1, shift: -0.3, flip: true },
  { top: 0.3, dir: -1, shift: 0.12, flip: true },
  { top: 0.46, dir: 1, shift: -0.18, flip: false },
];
// The colour along the bottom of the cloud art, for the cloud body under each bank.
const CLOUD_BODY = '#5C3576';
const CLOUD_ASPECT = 700 / 1200;

// The cloud image three wide (mirrored either side, overlapping a hair so no seam shows), so a bank can slide most
// of a screen without its end showing. `fill` extends it with solid cloud below, down to that depth.
function CloudStrip({ width, height, fill = 0 }: { width: number; height: number; fill?: number }) {
  return (
    <View style={{ position: 'absolute', left: -width, top: 0, width: width * 3, height: height + fill }}>
      {[-1, 1, -1].map((sx, i) => (
        <Image key={i} source={CLOUDS} resizeMode="stretch" style={{ position: 'absolute', left: i * width - 1, top: 0, width: width + 2, height, transform: [{ scaleX: sx }] }} />
      ))}
      {fill > 0 && <View style={{ position: 'absolute', left: 0, right: 0, top: height - 1, height: fill + 1, backgroundColor: CLOUD_BODY }} />}
    </View>
  );
}

/**
 * The sign-in screens' clouds, as weather. `rest` is the screen's own cloud frame along the foot of the screen.
 * `cover` 0 → 1 brings the other banks up from below until they fill the view. `clear` 0 → 1 drifts every bank off
 * toward its own side as it thins out, the higher banks first and the screen's own frame last.
 */
function CloudCover({ width, height, rest, cover, clear }: { width: number; height: number; rest: { height: number; bottom: number; opacity: number }; cover: Animated.AnimatedInterpolation<number>; clear: Animated.AnimatedInterpolation<number> }) {
  const drift = (i: number, dir: number) => {
    const from = i * 0.12;
    const to = Math.min(1, from + 0.6);
    return {
      opacity: clear.interpolate({ inputRange: [from, to], outputRange: [1, 0], extrapolate: 'clamp' }),
      translateX: clear.interpolate({ inputRange: [from, to], outputRange: [0, dir * width * 0.8], extrapolate: 'clamp' }),
    };
  };
  const base = drift(BANKS.length, 1);
  return (
    <>
      {BANKS.map((b, i) => {
        const d = drift(i, b.dir);
        const art = width * CLOUD_ASPECT * 1.1;
        const fill = height * (1 - b.top) - art + 40;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: b.shift * width,
              top: b.top * height,
              width,
              height: art + fill,
              opacity: Animated.multiply(d.opacity, cover),
              transform: [{ translateX: d.translateX }, { translateY: cover.interpolate({ inputRange: [0, 1], outputRange: [height * (0.7 - b.top), 0] }) }, { scaleX: b.flip ? -1 : 1 }],
            }}
          >
            <CloudStrip width={width} height={art} fill={fill} />
          </Animated.View>
        );
      })}
      {/* The screen's own cloud frame, exactly where it draws it */}
      <Animated.View style={{ position: 'absolute', left: 0, bottom: rest.bottom, width, height: rest.height, opacity: Animated.multiply(base.opacity, rest.opacity), transform: [{ translateX: base.translateX }] }}>
        <CloudStrip width={width} height={rest.height} />
      </Animated.View>
    </>
  );
}

function Crescent({ r }: { r: number }) {
  return (
    <Svg width={r * 2} height={r * 2}>
      <Circle cx={r} cy={r} r={r} fill={night.window} opacity={0.08} />
      <Path d={`M${r} ${r * 0.25} A${r * 0.75} ${r * 0.75} 0 1 0 ${r} ${r * 1.75} A${r * 0.55} ${r * 0.75} 0 1 1 ${r} ${r * 0.25} Z`} fill={night.window} transform={`rotate(-28 ${r} ${r})`} />
    </Svg>
  );
}

/**
 * Signing in. The bat leaves the moon, the clouds part, and it flies away from us into a much bigger city:
 *   0.00–0.06  the bat hangs from the tip of the crescent moon above the clouds.
 *   0.05–0.22  it drops off and swoops down toward the camera.
 *   0.06–0.22  login's clouds thicken to fill the view as we sink into them...
 *   0.20–0.46  ...then clear, banks drifting off left and right, revealing a wide city far below.
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
  // As login.tsx draws them.
  const loginClouds = { height: Math.min(height * 0.28, 270), bottom: -25, opacity: 0.9 };
  const wideW = width * 2.4;
  const wideH = height * 0.5;
  const zoomOut = width / wideW;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.88, 1], [1, 0]) }]}>
        {/* The login sky, turning into the night of the screen we're arriving at */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: LOGIN_SKY }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.3, 0.7], [0, 1]) }]}>
          <LinearGradient colors={to.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Stars />

        {/* The moon drifts up out of frame as we descend */}
        <Animated.View style={{ position: 'absolute', left: moon.x - moon.r, top: moon.y - moon.r, opacity: r([0.3, 0.5], [1, 0]), transform: [{ translateY: r([0.1, 0.5], [0, -height * 0.3]) }] }}>
          <Crescent r={moon.r} />
        </Animated.View>

        {/* A far bigger city than any one screen shows, seen from high above; then the view eases in on our part */}
        <Animated.View style={{ position: 'absolute', left: (width - wideW) / 2, bottom: 0, width: wideW, height: wideH, transformOrigin: 'bottom', opacity: r([0.2, 0.3, 0.8, 0.86], [0, 1, 1, 0]), transform: [{ scale: r([0.18, 0.6, 0.84], [zoomOut * 0.9, zoomOut, 1]) }] }}>
          <NightCity width={wideW} height={wideH} animated={false} variant="hero" scene={to} />
        </Animated.View>
        {/* ...which hands over to the screen's own city exactly where it sits */}
        <CityAt frame={frame} scene={trip.to} bottom={height} style={{ opacity: r([0.8, 0.86], [0, 1]) }} />

        {/* Login's clouds thicken around us as we sink into them, then clear, drifting off both ways */}
        <CloudCover width={width} height={height} rest={loginClouds} cover={r([0.06, 0.22], [0, 1])} clear={r([0.2, 0.46], [0, 1])} />
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
 * Signing out: sign-in played backwards in spirit, though the bat flies forwards the whole way.
 *   0.00–0.08  the city eases back in with the bat on its perch.
 *   0.06–0.34  it lifts off and rises toward us as the camera climbs and the city sinks away (0.14–0.44).
 *   0.20–0.50  the sky turns to the sign-in night, and banks of cloud drift in beneath us from both sides (0.24–0.50)...
 *   0.50–0.74  ...then the higher ones sink away, leaving the welcome screen's cloud frame.
 *   0.34–0.80  the bat climbs to the welcome screen's moon and settles on it as the logo comes in (0.74–0.84).
 *   0.90–1.00  the overlay clears onto the welcome screen, which looks the same underneath.
 */
function LeaveTrip({ p, trip, width, height }: { p: Animated.Value; trip: Extract<Trip, { mode: 'leave' }>; width: number; height: number }) {
  const from = scenes[trip.from];
  const frame = cityFrame(trip.from, width, height);
  const perch = takeoffSpot(trip, trip.from, frame);
  const r = lerp(p);

  // The welcome logo, once that screen has laid it out; until then, where it usually sits.
  const size = Math.min(width * 0.74, height < 720 ? 220 : 280, height * 0.31);
  const logo = moonFrame() ?? { x: (width - size) / 2, y: height * 0.3 - size / 2, width: size, height: size };
  // The bat in the logo hangs right of centre under the moon's tip (as welcome.tsx lands its swoop).
  const home = { x: logo.x + logo.width * 0.6, y: logo.y + logo.height * 0.42 };
  const rise = { x: width / 2 - BAT / 2, y: height * 0.42 };
  // As welcome.tsx draws them.
  const welcomeClouds = { height: Math.min(height * 0.34, 330), bottom: 0, opacity: 1 };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: r([0.9, 1], [1, 0]) }]}>
        <LinearGradient colors={from.sky} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: LOGIN_SKY, opacity: r([0.2, 0.5], [0, 1]) }]} />
        <Stars />

        {/* The city we're leaving: back up after the goodbye, then sinking away below as we climb */}
        <CityAt frame={frame} scene={trip.from} bottom={height} style={{ opacity: r([0, 0.08, 0.3, 0.44], [0, 1, 1, 0]), transform: [{ translateY: r([0, 0.08, 0.14, 0.44], [36, 0, 0, height * 0.35]) }] }} />

        {/* Clouds drift in from both sides beneath us as we climb, then the higher banks sink away, leaving the
            welcome screen's own frame */}
        <CloudCover width={width} height={height} rest={welcomeClouds} cover={r([0.5, 0.74], [1, 0])} clear={r([0.24, 0.5], [1, 0])} />

        {/* The welcome logo comes in as the bat settles onto the moon */}
        <Animated.View style={{ position: 'absolute', left: logo.x, top: logo.y, width: logo.width, height: logo.height, opacity: r([0.74, 0.84], [0, 1]), transform: [{ scale: r([0.74, 0.86], [0.9, 1]) }] }}>
          <Image source={LOGO} resizeMode="contain" style={{ width: logo.width, height: logo.height }} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', left: perch.x, top: perch.y, opacity: r([0, 0.07, 0.09], [1, 1, 0]) }}>
        <HangingBat size={13} />
      </Animated.View>

      {/* Up out of the city toward us, then on up to the moon */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: r([0.06, 0.09, 0.78, 0.84], [0, 1, 1, 0]),
          transform: [
            { translateX: r([0.07, 0.34, 0.58, 0.8], [bx(perch), rise.x, (rise.x + home.x - BAT / 2) / 2 - width * 0.12, home.x - BAT / 2]) },
            { translateY: r([0.07, 0.2, 0.34, 0.58, 0.8], [by(perch), (by(perch) + rise.y) / 2 - 40, rise.y, (rise.y + home.y) / 2 - 30, home.y - BAT * 0.3]) },
            { scale: r([0.07, 0.34, 0.5, 0.8], [0.15, 1.3, 1.1, 0.42]) },
            { rotate: r([0.07, 0.2, 0.34, 0.58, 0.8], ['8deg', '-6deg', '0deg', '-12deg', '0deg']) },
          ],
        }}
      >
        <FlyingBat size={BAT} flapMs={170} />
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
  // Subscribed so the trips' on/off switches (read through currentSettings) are loaded before the first navigation.
  useSettings();
  const p = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const last = useRef<Place | null>(null);
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
      if (!prev?.scene || !to || busy.current || tripKind(prev, dest) !== 'swipe' || !allowed('navigation')) return false;
      preHandled.current = dest;
      play({ mode: 'swipe', from: prev.scene, to, dir: directionOf(history.current, prev.path, dest), takeoff: batSpot() }, go);
      return true;
    };
    tripTo = (dest) => (last.current && !busy.current ? tripKind(last.current, dest) : null);
    return () => {
      startSwipe = null;
      tripTo = null;
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
    if (!prev || busy.current) return;
    const kind = tripKind(prev, pathname);
    if (!kind || !allowed(MOTION_FOR[kind])) return;

    const takeoff = batSpot();
    if (kind === 'arrive' && outdoor) play({ mode: 'arrive', to: outdoor, dir: 1, takeoff: null });
    else if (kind === 'leave' && prev.scene) play({ mode: 'leave', from: prev.scene, dir: 1, takeoff });
    else if (kind === 'enter' && interior && prev.scene) play({ mode: 'enter', city: prev.scene, interior, dir, takeoff });
    else if (kind === 'exit' && outdoor && prev.interior) play({ mode: 'exit', city: outdoor, interior: prev.interior, dir, takeoff: null });
    else if (kind === 'swipe' && prev.scene && scene) play({ mode: 'swipe', from: prev.scene, to: scene, dir, takeoff });
    // `play` only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, reduced]);

  if (!trip) return null;
  return (
    <>
      {trip.mode === 'swipe' && <SkylineTrip p={p} trip={trip} width={width} height={height} />}
      {trip.mode === 'arrive' && <ArriveTrip p={p} trip={trip} width={width} height={height} />}
      {trip.mode === 'leave' && <LeaveTrip p={p} trip={trip} width={width} height={height} />}
      {(trip.mode === 'enter' || trip.mode === 'exit') && <DoorTrip p={p} trip={trip} width={width} height={height} />}
      {waiting && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: waitFade }]}>
          <Landscape kind={waiting} scene={scenes[trip.mode === 'swipe' || trip.mode === 'arrive' ? trip.to : trip.mode === 'leave' ? trip.from : trip.city]} dir={trip.dir} />
        </Animated.View>
      )}
    </>
  );
}
