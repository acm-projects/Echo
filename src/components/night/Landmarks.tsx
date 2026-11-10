import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { fonts, night, type Landmark as Kind, type Scene } from '../../../theme';

// One recognisable, animated building at the back of each city. Everything is positioned from the landmark's centre
// line `cx` and the bottom of the city, so the perch helpers below can say exactly where the mascot hangs on it.

export const landmarkX = (width: number) => width * 0.24;
/** Near buildings within this distance of the landmark stay low so they never hide it. */
export const LANDMARK_CLEARANCE = 62;

type Geometry = { width: number; height: number };

const billboard = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const bodyH = height * 0.42;
  const panel = { w: 108, h: 46 };
  const panelTop = height - bodyH - 16 - panel.h;
  return { cx, bodyH, panel, panelTop };
};
const lighthouse = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const towerH = height * 0.74;
  return { cx, towerH, lampY: height - towerH - 12 };
};
const marquee = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const bodyH = height * 0.58;
  // The marquee hangs just under the roofline, clear of the low buildings in front; the blade stands on the roof
  // above it, so the two never overlap.
  const signTop = height - bodyH + 8;
  const blade = { x: cx + 26, w: 14, h: 50, top: signTop - 8 - 50 };
  return { cx, bodyH, signTop, sign: { w: 112, h: 30 }, blade };
};
const clocktower = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const towerH = height * 0.8;
  const top = height - towerH;
  return { cx, towerH, top, clockY: top + 24, r: 14 };
};
const radiotower = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const top = height * 0.04;
  return { cx, top, base: 40 };
};
const ferris = ({ width, height }: Geometry) => {
  const cx = landmarkX(width);
  const r = height * 0.32;
  return { cx, r, cy: height - r - 18 };
};

/** Where the mascot hangs on this landmark: the top-left corner for a <HangingBat>, relative to the city. */
export function landmarkPerch(kind: Kind, g: Geometry) {
  switch (kind) {
    case 'billboard': {
      const b = billboard(g);
      return { x: b.cx + b.panel.w / 2 - 22, y: b.panelTop + b.panel.h };
    }
    case 'marquee': {
      const m = marquee(g);
      return { x: m.cx + m.sign.w / 2 - 24, y: m.signTop + m.sign.h };
    }
    case 'clocktower': {
      const c = clocktower(g);
      return { x: c.cx - 6, y: c.clockY + c.r + 2 };
    }
    case 'lighthouse': {
      const l = lighthouse(g);
      return { x: l.cx + 8, y: l.lampY + 14 };
    }
    case 'radiotower': {
      const t = radiotower(g);
      return { x: t.cx + 4, y: t.top + (g.height - t.top) * 0.36 };
    }
    case 'ferris': {
      const f = ferris(g);
      return { x: f.cx - 6, y: f.cy + f.r + 2 };
    }
  }
}

/**
 * The lit doorway on the landmark that the bat flies into when you open a page from this screen (centre point,
 * relative to the city). It sits just above the low rooftops kept clear around the landmark.
 */
export function landmarkDoor(kind: Kind, g: Geometry) {
  const cx = landmarkX(g.width);
  if (kind === 'ferris') {
    const f = ferris(g);
    return { x: f.cx, y: f.cy };
  }
  return { x: cx, y: g.height * 0.62 };
}

function useLoop(duration: number, animated: boolean, easing = Easing.linear) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration, easing, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [animated, duration, easing, t]);
  return t;
}

// A row of bulbs where a single bright spot chases along, like a theatre sign.
function ChaseBulbs({ count, x, y, spacing, color, animated }: { count: number; x: number; y: number; spacing: number; color: string; animated: boolean }) {
  const t = useLoop(1400, animated);
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const at = i / count;
        const opacity = animated ? t.interpolate({ inputRange: [0, at, Math.min(1, at + 0.08), Math.min(1, at + 0.2), 1], outputRange: [0.35, 0.35, 1, 0.35, 0.35] }) : 0.7;
        return <Animated.View key={i} style={{ position: 'absolute', left: x + i * spacing, top: y, width: 3, height: 3, borderRadius: 1.5, backgroundColor: color, opacity }} />;
      })}
    </>
  );
}

const MESSAGES = ['ONE MORE CHAPTER?', 'STORIES, OUT LOUD', 'LIGHTS LOW · VOLUME UP'];

function Billboard({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const b = billboard(g);
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % MESSAGES.length);
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    }, 3400);
    return () => clearInterval(timer);
  }, [animated, fade]);
  const left = b.cx - b.panel.w / 2;
  return (
    <>
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Rect x={b.cx - 32} y={g.height - b.bodyH} width={64} height={b.bodyH} fill={scene.mid} />
        <Rect x={b.cx - 30} y={b.panelTop + b.panel.h} width={3} height={16} fill={scene.mid} />
        <Rect x={b.cx + 27} y={b.panelTop + b.panel.h} width={3} height={16} fill={scene.mid} />
        <Rect x={left} y={b.panelTop} width={b.panel.w} height={b.panel.h} fill="#140C22" stroke={scene.accent} strokeWidth={1.5} />
      </Svg>
      <Animated.View style={{ position: 'absolute', left, top: b.panelTop, width: b.panel.w, height: b.panel.h, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 10, letterSpacing: 0.8, color: scene.accent, textAlign: 'center' }}>{MESSAGES[i]}</Text>
      </Animated.View>
      <ChaseBulbs count={13} x={left + 3} y={b.panelTop - 5} spacing={8} color={night.window} animated={animated} />
    </>
  );
}

function Lighthouse({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const l = lighthouse(g);
  const sweep = useLoop(5200, animated, Easing.inOut(Easing.sin));
  const base = g.height;
  const top = base - l.towerH;
  return (
    <>
      {/* The beam swings out over the harbour and back */}
      <Animated.View style={{ position: 'absolute', left: l.cx, top: l.lampY - 9, width: 170, height: 18, transformOrigin: 'left center', opacity: animated ? 1 : 0.6, transform: [{ rotate: animated ? sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-28deg', '-152deg', '-28deg'] }) : '-40deg' }] }}>
        <Svg width={170} height={18}><Path d="M0 9 L170 0 L170 18 Z" fill={scene.accent} opacity={0.16} /></Svg>
      </Animated.View>
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={`M${l.cx - 17} ${base} L${l.cx - 11} ${top} H${l.cx + 11} L${l.cx + 17} ${base} Z`} fill={scene.mid} />
        {[0.25, 0.55].map((f) => <Rect key={f} x={l.cx - 15 + f * 4} y={top + l.towerH * f} width={30 - f * 8} height={6} fill={scene.accent} opacity={0.35} />)}
        <Rect x={l.cx - 13} y={top - 3} width={26} height={3} fill={scene.mid} />
        <Rect x={l.cx - 8} y={l.lampY - 6} width={16} height={12} fill={night.window} />
        <Path d={`M${l.cx - 10} ${l.lampY - 6} L${l.cx} ${l.lampY - 16} L${l.cx + 10} ${l.lampY - 6} Z`} fill={scene.mid} />
      </Svg>
    </>
  );
}

function Marquee({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const m = marquee(g);
  const left = m.cx - m.sign.w / 2;
  return (
    <>
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Rect x={m.cx - 44} y={g.height - m.bodyH} width={88} height={m.bodyH} fill={scene.mid} />
        {/* A tall blade sign up the front of the theatre */}
        <Rect x={m.blade.x} y={m.blade.top} width={m.blade.w} height={m.blade.h} fill="#140C22" stroke={night.neonCyan} strokeWidth={1.2} />
        <Rect x={left} y={m.signTop} width={m.sign.w} height={m.sign.h} fill="#140C22" stroke={night.neonPink} strokeWidth={1.5} />
      </Svg>
      <View style={{ position: 'absolute', left: m.blade.x, top: m.blade.top, width: m.blade.w, height: m.blade.h, alignItems: 'center', justifyContent: 'space-evenly' }}>
        {'ECHO'.split('').map((ch, i) => <Text key={i} style={{ fontFamily: fonts.sansBold, fontSize: 9, color: night.neonCyan, lineHeight: 11 }}>{ch}</Text>)}
      </View>
      <View style={{ position: 'absolute', left, top: m.signTop, width: m.sign.w, height: m.sign.h, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 11, letterSpacing: 1.5, color: night.neonPink }}>TONIGHT</Text>
      </View>
      <ChaseBulbs count={14} x={left + 2} y={m.signTop - 5} spacing={8} color={night.window} animated={animated} />
      <ChaseBulbs count={14} x={left + 2} y={m.signTop + m.sign.h + 2} spacing={8} color={night.window} animated={animated} />
    </>
  );
}

function ClockTower({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const c = clocktower(g);
  const minute = useLoop(24000, animated);
  const hour = useLoop(24000 * 12, animated);
  const hand = (t: Animated.Value, length: number, thickness: number) => (
    <Animated.View style={{ position: 'absolute', left: c.cx - thickness / 2, top: c.clockY - length, width: thickness, height: length, borderRadius: thickness, backgroundColor: '#2A1810', transformOrigin: 'bottom', transform: [{ rotate: animated ? t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '60deg' }] }} />
  );
  return (
    <>
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Rect x={c.cx - 18} y={c.top} width={36} height={c.towerH} fill={scene.mid} />
        <Path d={`M${c.cx - 21} ${c.top} L${c.cx} ${c.top - 30} L${c.cx + 21} ${c.top} Z`} fill={scene.mid} />
        <Circle cx={c.cx} cy={c.clockY} r={c.r} fill="#FFE2B0" stroke={scene.accent} strokeWidth={2} />
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return <Line key={deg} x1={c.cx + Math.sin(rad) * (c.r - 2)} y1={c.clockY - Math.cos(rad) * (c.r - 2)} x2={c.cx + Math.sin(rad) * (c.r - 5)} y2={c.clockY - Math.cos(rad) * (c.r - 5)} stroke="#2A1810" strokeWidth={1.4} />;
        })}
      </Svg>
      {hand(hour, 7, 2.4)}
      {hand(minute, 11, 1.6)}
    </>
  );
}

function RadioTower({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const t = radiotower(g);
  // Two rings on slightly different periods, so the broadcast never settles into a mechanical rhythm.
  const pulses = [useLoop(2600, animated, Easing.out(Easing.quad)), useLoop(3700, animated, Easing.out(Easing.quad))];
  const blink = useLoop(1600, animated);
  const lattice: string[] = [];
  for (let i = 0; i < 7; i++) {
    const y1 = g.height - (i / 7) * (g.height - t.top);
    const y2 = g.height - ((i + 1) / 7) * (g.height - t.top);
    const w1 = (t.base / 2) * (1 - i / 7);
    const w2 = (t.base / 2) * (1 - (i + 1) / 7);
    lattice.push(`M${t.cx - w1} ${y1} L${t.cx + w2} ${y2} M${t.cx + w1} ${y1} L${t.cx - w2} ${y2} M${t.cx - w2} ${y2} H${t.cx + w2}`);
  }
  return (
    <>
      {pulses.map((v, i) => (
        <Animated.View
          key={i}
          style={{ position: 'absolute', left: t.cx - 30, top: t.top - 30, width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: scene.accent, opacity: animated ? v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }) : 0, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }] }}
        />
      ))}
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={`M${t.cx - t.base / 2} ${g.height} L${t.cx} ${t.top} L${t.cx + t.base / 2} ${g.height}`} stroke={scene.mid} strokeWidth={2.5} fill="none" />
        <Path d={lattice.join(' ')} stroke={scene.mid} strokeWidth={1.2} fill="none" />
      </Svg>
      <Animated.View style={{ position: 'absolute', left: t.cx - 3, top: t.top - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF5A5A', opacity: animated ? blink.interpolate({ inputRange: [0, 0.5, 0.55, 1], outputRange: [1, 1, 0.15, 0.15] }) : 1 }} />
    </>
  );
}

function Ferris({ g, scene, animated }: { g: Geometry; scene: Scene; animated: boolean }) {
  const f = ferris(g);
  const spin = useLoop(36000, animated);
  const rotate = animated ? spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '0deg';
  const counter = animated ? spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) : '0deg';
  const size = f.r * 2;
  return (
    <>
      <Svg width={g.width} height={g.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={`M${f.cx - f.r * 0.55} ${g.height} L${f.cx} ${f.cy} L${f.cx + f.r * 0.55} ${g.height}`} stroke={scene.mid} strokeWidth={3} fill="none" />
      </Svg>
      <Animated.View style={{ position: 'absolute', left: f.cx - f.r, top: f.cy - f.r, width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          <Circle cx={f.r} cy={f.r} r={f.r - 2} stroke={scene.mid} strokeWidth={2} fill="none" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <Line key={i} x1={f.r} y1={f.r} x2={f.r + Math.cos(a) * (f.r - 2)} y2={f.r + Math.sin(a) * (f.r - 2)} stroke={scene.mid} strokeWidth={1.2} />;
          })}
        </Svg>
        {/* Gondolas ride the rim but stay upright, glowing in the scene's colours */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <Animated.View key={i} style={{ position: 'absolute', left: f.r + Math.cos(a) * (f.r - 2) - 4, top: f.r + Math.sin(a) * (f.r - 2) - 2, transform: [{ rotate: counter }] }}>
              <View style={{ width: 8, height: 7, borderRadius: 2, backgroundColor: i % 2 ? scene.accent : night.window, opacity: 0.85 }} />
            </Animated.View>
          );
        })}
      </Animated.View>
    </>
  );
}

/** The scene's landmark, drawn behind the near skyline. */
export function Landmark({ scene, width, height, animated }: { scene: Scene; width: number; height: number; animated: boolean }) {
  const g = { width, height };
  const props = { g, scene, animated };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {scene.landmark === 'billboard' && <Billboard {...props} />}
      {scene.landmark === 'lighthouse' && <Lighthouse {...props} />}
      {scene.landmark === 'marquee' && <Marquee {...props} />}
      {scene.landmark === 'clocktower' && <ClockTower {...props} />}
      {scene.landmark === 'radiotower' && <RadioTower {...props} />}
      {scene.landmark === 'ferris' && <Ferris {...props} />}
    </View>
  );
}
