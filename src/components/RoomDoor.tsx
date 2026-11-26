import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Rect,
  Path,
  Circle,
  G,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { useReducedMotion } from './night/NightSky';

type Props = {
  id: string;
  name: string;
  width?: number;
  height?: number;
  visibility?: 'public' | 'private';
  opening?: boolean;
};

const PALETTES = [
  {
    wall: '#29212D',
    frame: '#76504C',
    door: '#57353F',
    panel: '#432A35',
    trim: '#986B60',
    light: '#E8B475',
    neon: '#E8B475',
  },
  {
    wall: '#1C1C30',
    frame: '#4A425D',
    door: '#30283F',
    panel: '#241E32',
    trim: '#77618A',
    light: '#D8A1CA',
    neon: '#D67BB0',
  },
  {
    wall: '#202B30',
    frame: '#506361',
    door: '#334B4D',
    panel: '#263B40',
    trim: '#73877E',
    light: '#E5BE82',
    neon: '#86C5BC',
  },
];

function hash(value: string) {
  let result = 0;

  for (let i = 0; i < value.length; i++) {
    result = (Math.imul(result, 31) + value.charCodeAt(i)) >>> 0;
  }

  return result;
}

export function RoomDoor({
  id,
  name,
  width = 130,
  height = 170,
  visibility = 'public',
  opening = false,
}: Props) {
  const seed = hash(id || name);
  const variant = seed % 3;
  const palette = PALETTES[variant];
  const arched = variant === 2;
  const cyber = variant === 1;
  const locked = visibility === 'private';

  const reduced = useReducedMotion();
  const flicker = useRef(new Animated.Value(0.8)).current;
  const swing = useRef(new Animated.Value(0)).current;

  const uid = `door-${seed}-${width}-${height}`;
  const wallId = `${uid}-wall`;
  const glowId = `${uid}-glow`;
  const glassId = `${uid}-glass`;

  const outline = arched
    ? 'M24 190 V64 A46 46 0 0 1 116 64 V190 Z'
    : 'M24 30 H116 V190 H24 Z';

  const leaf = arched
    ? 'M32 190 V64 A38 38 0 0 1 108 64 V190 Z'
    : 'M32 38 H108 V190 H32 Z';

  useEffect(() => {
    if (reduced) {
      flicker.setValue(0.85);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 1,
          duration: 1300 + seed % 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(flicker, {
          toValue: 0.73,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(flicker, {
          toValue: 0.92,
          duration: 650,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [flicker, reduced, seed]);

  useEffect(() => {
    if (reduced || !opening) {
      swing.stopAnimation();
      swing.setValue(0);
      return;
    }

    const animation = Animated.timing(swing, {
      toValue: 1,
      duration: 460,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [opening, reduced, swing]);

  const scale = Math.min(width / 140, height / 210);
  const artWidth = 140 * scale;
  const artHeight = 210 * scale;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[s.container, { width, height }]}
    >
      <View style={{ width: artWidth, height: artHeight }}>
        <Svg
          width={artWidth}
          height={artHeight}
          viewBox="0 0 140 210"
        >
          <Defs>
            <LinearGradient
              id={wallId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0" stopColor={palette.wall} />
              <Stop offset="1" stopColor="#17121F" />
            </LinearGradient>

            <RadialGradient
              id={glowId}
              cx="50%"
              cy="35%"
              rx="50%"
              ry="65%"
            >
              <Stop
                offset="0"
                stopColor={palette.light}
                stopOpacity={0.24}
              />
              <Stop
                offset="1"
                stopColor={palette.light}
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>

          <Rect
            width={140}
            height={210}
            rx={8}
            fill={`url(#${wallId})`}
          />

          {Array.from({ length: 7 }, (_, i) => (
            <G key={i} opacity={0.14}>
              <Path
                d={`M0 ${34 + i * 24} H140`}
                stroke={palette.trim}
                strokeWidth={0.7}
              />
              <Path
                d={`M${i % 2 ? 13 : 20} ${34 + i * 24} v24`}
                stroke={palette.trim}
                strokeWidth={0.7}
              />
              <Path
                d={`M${i % 2 ? 128 : 120} ${34 + i * 24} v24`}
                stroke={palette.trim}
                strokeWidth={0.7}
              />
            </G>
          ))}

          <Rect
            width={140}
            height={210}
            fill={`url(#${glowId})`}
          />

          {!arched && (
            <Rect
              x={17}
              y={23}
              width={106}
              height={9}
              rx={2}
              fill={palette.frame}
            />
          )}

          <Path d={outline} fill={palette.frame} />

          <Path
            d={leaf}
            fill="#F3BD7D"
            stroke="#15101B"
            strokeWidth={4}
          />

          <Rect
            x={36}
            y={87}
            width={68}
            height={100}
            fill="#C38A59"
          />

          <Rect
            x={40}
            y={93}
            width={60}
            height={70}
            fill="#795345"
          />

          {[103, 125, 147].map((y, row) => (
            <G key={y}>
              {Array.from({ length: 8 }, (_, i) => {
                const bookHeight = 11 + (seed + i * 7 + row) % 8;

                return (
                  <Rect
                    key={i}
                    x={42 + i * 7}
                    y={y - bookHeight}
                    width={5}
                    height={bookHeight}
                    rx={0.6}
                    fill={
                      [
                        '#5C3D48',
                        '#42575D',
                        '#B08762',
                        '#75654B',
                      ][(seed + i + row) % 4]
                    }
                  />
                );
              })}

              <Rect
                x={39}
                y={y}
                width={62}
                height={3}
                fill="#50332F"
              />
            </G>
          ))}

          <Path
            d="M32 190 L48 165 H92 L108 190 Z"
            fill="#A36D4B"
          />

          <Rect
            x={16}
            y={190}
            width={108}
            height={7}
            rx={1}
            fill={palette.frame}
          />

          <Rect
            x={8}
            y={198}
            width={124}
            height={5}
            rx={1}
            fill={palette.panel}
          />
        </Svg>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: swing.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -38 * scale],
                  }),
                },
                {
                  scaleX: swing.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.12],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg
            width={artWidth}
            height={artHeight}
            viewBox="0 0 140 210"
          >
            <Defs>
              <LinearGradient
                id={glassId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop
                  offset="0"
                  stopColor={locked ? '#514458' : palette.light}
                />
                <Stop
                  offset="1"
                  stopColor={locked ? '#30283C' : '#936B59'}
                />
              </LinearGradient>
            </Defs>

            <Path
              d={leaf}
              fill={palette.door}
              stroke={palette.trim}
              strokeWidth={1}
            />

            {arched ? (
              <Path
                d="M41 108 V64 A29 29 0 0 1 99 64 V108 Z"
                fill={`url(#${glassId})`}
                stroke={palette.panel}
                strokeWidth={4}
              />
            ) : (
              <Rect
                x={41}
                y={47}
                width={58}
                height={65}
                rx={cyber ? 1 : 3}
                fill={`url(#${glassId})`}
                stroke={palette.panel}
                strokeWidth={4}
              />
            )}

            {!locked && (
              <G opacity={0.65}>
                <Rect
                  x={44}
                  y={96}
                  width={52}
                  height={3}
                  fill={palette.panel}
                />

                {Array.from({ length: 7 }, (_, i) => {
                  const h = 11 + (seed + i * 3) % 9;

                  return (
                    <Rect
                      key={i}
                      x={45 + i * 7}
                      y={96 - h}
                      width={5}
                      height={h}
                      fill={
                        ['#65434B', '#51616A', '#8B6D50'][i % 3]
                      }
                    />
                  );
                })}
              </G>
            )}

            <Path
              d={arched ? 'M70 35 V108' : 'M70 47 V112'}
              stroke={palette.door}
              strokeWidth={4}
            />

            <Path
              d="M41 78 H99"
              stroke={palette.door}
              strokeWidth={4}
            />

            <Path
              d="M46 51 L63 51 L46 72 Z"
              fill="#FFFFFF"
              opacity={0.09}
            />

            <Rect
              x={41}
              y={125}
              width={58}
              height={54}
              rx={2}
              fill={palette.panel}
              stroke={palette.trim}
              strokeWidth={1}
            />

            <Rect
              x={46}
              y={130}
              width={48}
              height={44}
              rx={1}
              fill={palette.door}
              opacity={0.7}
            />

            {cyber ? (
              <Rect
                x={100}
                y={115}
                width={3}
                height={24}
                rx={1.5}
                fill="#D5B9DC"
              />
            ) : (
              <Circle
                cx={99}
                cy={119}
                r={3.5}
                fill="#E1B477"
              />
            )}

            {cyber && (
              <Rect
                x={36}
                y={42}
                width={68}
                height={143}
                rx={2}
                fill="none"
                stroke={palette.neon}
                strokeWidth={0.8}
                opacity={0.7}
              />
            )}

            {locked && (
              <G>
                <Path
                  d="M65 118 V113 A5 5 0 0 1 75 113 V118"
                  stroke="#E3B77C"
                  strokeWidth={2.5}
                  fill="none"
                />

                <Rect
                  x={62}
                  y={117}
                  width={16}
                  height={13}
                  rx={2}
                  fill="#C49A63"
                />

                <Circle
                  cx={70}
                  cy={122}
                  r={1.6}
                  fill="#46312E"
                />

                <Rect
                  x={69}
                  y={122}
                  width={2}
                  height={4}
                  fill="#46312E"
                />
              </G>
            )}
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: flicker },
          ]}
        >
          <Svg
            width={artWidth}
            height={artHeight}
            viewBox="0 0 140 210"
          >
            {arched ? (
              <G>
                {[8, 124].map((x) => (
                  <G key={x}>
                    <Rect
                      x={x - 4}
                      y={56}
                      width={16}
                      height={36}
                      rx={7}
                      fill={palette.light}
                      opacity={0.07}
                    />

                    <Rect
                      x={x}
                      y={62}
                      width={8}
                      height={22}
                      rx={2}
                      fill={palette.light}
                    />

                    <Rect
                      x={x - 1}
                      y={59}
                      width={10}
                      height={4}
                      rx={1}
                      fill={palette.frame}
                    />

                    <Rect
                      x={x - 1}
                      y={83}
                      width={10}
                      height={4}
                      rx={1}
                      fill={palette.frame}
                    />
                  </G>
                ))}
              </G>
            ) : cyber ? (
              <G>
                <Rect
                  x={38}
                  y={8}
                  width={64}
                  height={14}
                  rx={5}
                  fill={palette.neon}
                  opacity={0.09}
                />

                <Rect
                  x={43}
                  y={13}
                  width={54}
                  height={3}
                  rx={1.5}
                  fill={palette.neon}
                />

                <Rect
                  x={19}
                  y={39}
                  width={2}
                  height={141}
                  fill={palette.neon}
                  opacity={0.5}
                />
              </G>
            ) : (
              <G>
                <Path
                  d="M57 16 L30 65 H110 L83 16 Z"
                  fill={palette.light}
                  opacity={0.07}
                />

                <Rect
                  x={53}
                  y={8}
                  width={34}
                  height={8}
                  rx={3}
                  fill={palette.frame}
                />

                <Rect
                  x={57}
                  y={13}
                  width={26}
                  height={4}
                  rx={2}
                  fill={palette.light}
                />
              </G>
            )}
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
});