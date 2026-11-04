import { Animated } from 'react-native';
import { FlyingBat } from './Bat';

type Point = { x: number; y: number };

function quad(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

// The flight path: dive in from the top-right, skim through the clouds, then climb onto the moon at `land`.
// `progress` 0..0.6 is the dive, 0.6..0.88 the climb, the rest is the landing fade (see welcome.tsx).
function flightPath(width: number, height: number, land: Point) {
  const start = { x: width + 70, y: height * 0.1 };
  const low = { x: width * 0.24, y: height * 0.84 };
  const dive = Array.from({ length: 13 }, (_, i) => quad(start, { x: width * 0.8, y: height * 0.98 }, low, i / 12));
  const climb = Array.from({ length: 10 }, (_, i) => quad(low, { x: -width * 0.05, y: height * 0.5 }, land, (i + 1) / 10));
  const points = [...dive, ...climb];
  const input = [...dive.map((_, i) => (i / 12) * 0.6), ...climb.map((_, i) => 0.6 + ((i + 1) / 10) * 0.28)];
  return { points, input };
}

export function BatSwoop({ progress, width, height, land, size = 150 }: { progress: Animated.Value; width: number; height: number; land: Point; size?: number }) {
  const { points, input } = flightPath(width, height, land);
  const at = (values: number[]) => progress.interpolate({ inputRange: [...input, 1], outputRange: [...values, values[values.length - 1]] });

  const translateX = at(points.map((p) => p.x - size / 2));
  const translateY = at(points.map((p) => p.y - size * 0.3));
  // Bank into the turns: tilt toward the direction of travel.
  const rotate = at(points.map((p, i) => {
    const next = points[Math.min(i + 1, points.length - 1)];
    const prev = points[Math.max(i - 1, 0)];
    const dx = next.x - prev.x;
    return Math.max(-28, Math.min(28, dx * 0.12));
  })).interpolate({ inputRange: [-28, 28], outputRange: ['-28deg', '28deg'] });
  const scale = progress.interpolate({ inputRange: [0, 0.6, 0.88, 1], outputRange: [1.25, 1, 0.45, 0.35] });
  const opacity = progress.interpolate({ inputRange: [0, 0.86, 0.95, 1], outputRange: [1, 1, 0, 0] });

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }}>
      <FlyingBat size={size} flapMs={150} glow />
    </Animated.View>
  );
}
