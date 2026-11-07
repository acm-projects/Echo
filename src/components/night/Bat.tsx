import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { night } from '../../../theme';

// Echo's mascot, drawn to match assets/images/echo-logo.png: purple wings, pink ears, sleepy closed eyes.

const EYE = '#1A0D24';

function Wing({ mirrored }: { mirrored?: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 60">
      <G transform={mirrored ? 'translate(100,0) scale(-1,1)' : undefined}>
        <Path
          d="M100 16 C80 2 40 -2 2 6 Q12 24 16 42 Q30 32 40 38 Q48 48 58 56 Q66 42 76 46 Q84 52 94 58 L100 40 Z"
          fill={night.batWing}
        />
        <Path d="M100 19 L16 42 M100 22 L58 56 M100 26 L94 58" stroke={night.batWingDark} strokeWidth={2.2} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

function FlyingBody({ away }: { away?: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 60 70">
      <Path d="M18 20 L13 1 L29 13 Z" fill={night.batBody} />
      <Path d="M42 20 L47 1 L31 13 Z" fill={night.batBody} />
      {!away && <Path d="M19 17 L16 6 L25 13 Z" fill={night.batEar} />}
      {!away && <Path d="M41 17 L44 6 L35 13 Z" fill={night.batEar} />}
      <Ellipse cx={30} cy={46} rx={11} ry={16} fill={night.batBody} />
      <Circle cx={30} cy={26} r={14} fill={night.batBody} />
      {away ? (
        // Seen from behind: no face, just the back of the head and a soft line down the spine.
        <Path d="M30 18 V58" stroke={night.batWingDark} strokeWidth={1.6} opacity={0.6} />
      ) : (
        <>
          <Path d="M22 25 q3 3 6 0 M32 25 q3 3 6 0" stroke={EYE} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Ellipse cx={21} cy={31} rx={2.6} ry={1.6} fill={night.batEar} opacity={0.55} />
          <Ellipse cx={39} cy={31} rx={2.6} ry={1.6} fill={night.batEar} opacity={0.55} />
        </>
      )}
    </Svg>
  );
}

/** A bat with flapping wings. `size` is the wingspan; height is 60% of it. `away` shows it from behind. */
export function FlyingBat({ size, flapMs = 260, glow, away, style }: { size: number; flapMs?: number; glow?: boolean; away?: boolean; style?: ViewStyle }) {
  const flap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: flapMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flap, { toValue: 0, duration: flapMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flap, flapMs]);

  // Wings pivot at the shoulders: up-stroke to 30deg, down-stroke to -24deg.
  const left = flap.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '-24deg'] });
  const right = flap.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '24deg'] });
  const bob = flap.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.03] });
  const wingW = size * 0.42;
  const wingH = wingW * 0.6;

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size * 0.6, transform: [{ translateY: bob }] }, style]}>
      {glow && <View style={{ position: 'absolute', left: size * 0.2, top: -size * 0.12, width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, backgroundColor: night.batEar, opacity: 0.14 }} />}
      <Animated.View style={{ position: 'absolute', left: size / 2 - wingW - size * 0.06, top: size * 0.1, width: wingW, height: wingH, transformOrigin: 'right center', transform: [{ rotate: left }] }}>
        <Wing />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: size / 2 + size * 0.06, top: size * 0.1, width: wingW, height: wingH, transformOrigin: 'left center', transform: [{ rotate: right }] }}>
        <Wing mirrored />
      </Animated.View>
      <View style={{ position: 'absolute', left: size / 2 - size * 0.15, top: -size * 0.03, width: size * 0.3, height: size * 0.35 }}>
        <FlyingBody away={away} />
      </View>
    </Animated.View>
  );
}

/** The mascot asleep upside down, wings wrapped, swaying slightly. Hang it from its top edge. */
export function HangingBat({ size, style }: { size: number; style?: ViewStyle }) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sway]);

  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size * 1.5, transformOrigin: 'center top', transform: [{ rotate }] }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 40 60">
        <Path d="M17 0 L17 5 M23 0 L23 5" stroke={night.batBody} strokeWidth={2} strokeLinecap="round" />
        <Path d="M20 4 C34 6 36 30 28 40 L12 40 C4 30 6 6 20 4 Z" fill={night.batWing} />
        <Path d="M20 6 L20 38" stroke={night.batWingDark} strokeWidth={1.4} />
        <Path d="M13 48 L9 59 L19 52 Z M27 48 L31 59 L21 52 Z" fill={night.batBody} />
        <Path d="M14 50 L12 56 L18 52 Z M26 50 L28 56 L22 52 Z" fill={night.batEar} />
        <Circle cx={20} cy={45} r={9} fill={night.batBody} />
        <Path d="M14.5 46 q2.5 -2.4 5 0 M20.5 46 q2.5 -2.4 5 0" stroke={EYE} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
