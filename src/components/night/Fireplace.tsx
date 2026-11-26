import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type FireplaceProps = {
  width: number;
  run: boolean;
};

const softEase = Easing.inOut(Easing.sin);

function useCycle(
  duration: number,
  run: boolean,
  reverse = false,
  delay = 0
) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.setValue(0);

    if (!run) return;

    const forward = Animated.timing(value, {
      toValue: 1,
      duration,
      delay,
      easing: reverse ? softEase : Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    });

    const animation = Animated.loop(
      reverse
        ? Animated.sequence([
            forward,
            Animated.timing(value, {
              toValue: 0,
              duration,
              easing: softEase,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ])
        : forward
    );

    animation.start();

    return () => animation.stop();
  }, [value, duration, run, reverse, delay]);

  return value;
}

function Flame({
  x,
  y,
  width,
  height,
  duration,
  color,
  run,
  scale,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
  color: string;
  run: boolean;
  scale: number;
}) {
  const flicker = useCycle(duration, run, true);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        opacity: flicker.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
        }),
        transform: [
          {
            translateY: flicker.interpolate({
              inputRange: [0, 1],
              outputRange: [height * scale * 0.1, 0],
            }),
          },
          {
            scaleX: flicker.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1.1],
            }),
          },
          {
            scaleY: flicker.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1.15],
            }),
          },
        ],
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 40 100"
      >
        <Path
          d="M20 100 C-7 92 0 66 10 48 C18 32 17 17 23 0 C23 29 40 44 37 67 C45 88 31 100 20 100 Z"
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

function Ember({
  index,
  scale,
  run,
}: {
  index: number;
  scale: number;
  run: boolean;
}) {
  const rise = useCycle(
    2100 + index * 310,
    run,
    false,
    index * 240
  );

  const size = 2 + (index % 3);
  const x = 126 + ((index * 19) % 108);
  const drift = index % 2 === 0 ? -18 : 18;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x * scale,
        top: 190 * scale,
        width: size * scale,
        height: size * scale,
        borderRadius: size * scale,
        backgroundColor:
          index % 3 === 0 ? '#FFE4A1' : '#FF9B50',
        opacity: run
          ? rise.interpolate({
              inputRange: [0, 0.12, 0.6, 1],
              outputRange: [0, 1, 0.65, 0],
            })
          : 0,
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -105 * scale],
            }),
          },
          {
            translateX: rise.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [
                0,
                drift * scale,
                drift * scale * 0.5,
              ],
            }),
          },
          {
            scale: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.3],
            }),
          },
        ],
      }}
    />
  );
}

function Smoke({
  index,
  scale,
  run,
}: {
  index: number;
  scale: number;
  run: boolean;
}) {
  const rise = useCycle(
    4400 + index * 800,
    run,
    false,
    index * 900
  );

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: (148 + index * 19) * scale,
        top: 129 * scale,
        width: 32 * scale,
        height: 34 * scale,
        opacity: run
          ? rise.interpolate({
              inputRange: [0, 0.25, 0.6, 1],
              outputRange: [0, 0.14, 0.08, 0],
            })
          : 0,
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -55 * scale],
            }),
          },
          {
            translateX: rise.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [
                0,
                (index % 2 ? 10 : -10) * scale,
                6 * scale,
              ],
            }),
          },
          {
            scale: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 1.8],
            }),
          },
        ],
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 40 44">
        <Defs>
          <RadialGradient id={`smoke${index}`}>
            <Stop
              offset="0%"
              stopColor="#C6A9B7"
              stopOpacity={0.8}
            />
            <Stop
              offset="100%"
              stopColor="#C6A9B7"
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>

        <Ellipse
          cx={20}
          cy={22}
          rx={20}
          ry={22}
          fill={`url(#smoke${index})`}
        />
      </Svg>
    </Animated.View>
  );
}

export function Fireplace({ width, run }: FireplaceProps) {
  const scale = width / 360;
  const flicker = useCycle(740, run, true);
  const neon = useCycle(3600, run, true);

  return (
    <View
      pointerEvents="none"
      style={{
        width,
        height: 280 * scale,
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: flicker.interpolate({
              inputRange: [0, 1],
              outputRange: [0.65, 1],
            }),
          },
        ]}
      >
        <Svg width={width} height={280 * scale} viewBox="0 0 360 280">
          <Defs>
            <RadialGradient id="fireWallGlow">
              <Stop
                offset="0%"
                stopColor="#FF9C52"
                stopOpacity={0.35}
              />
              <Stop
                offset="50%"
                stopColor="#D86B43"
                stopOpacity={0.12}
              />
              <Stop
                offset="100%"
                stopColor="#D86B43"
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>

          <Ellipse
            cx={180}
            cy={185}
            rx={180}
            ry={175}
            fill="url(#fireWallGlow)"
          />
        </Svg>
      </Animated.View>

      <Svg width={width} height={280 * scale} viewBox="0 0 360 280">
        <Rect
          x={47}
          y={36}
          width={266}
          height={215}
          rx={5}
          fill="#1B1422"
        />

        <Path
          d="M63 50 H297 L311 68 V239 H49 V68 Z"
          fill="#352332"
          stroke="#644052"
          strokeWidth={2}
        />

        <Path
          d="M92 75 H268 L284 92 V224 H76 V92 Z"
          fill="#100D16"
          stroke="#725044"
          strokeWidth={2}
        />

        <Path
          d="M103 88 H257 L271 102 V211 H89 V102 Z"
          fill="#1D111A"
        />

        <Path
          d="M103 88 L89 102 V211 L106 199 V102 Z"
          fill="#291820"
        />

        <Path
          d="M257 88 L271 102 V211 L254 199 V102 Z"
          fill="#291820"
        />

        {[116, 142, 168].map((y) => (
          <Path
            key={y}
            d={`M106 ${y} H254`}
            stroke="#49302D"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}

        <Rect
          x={38}
          y={31}
          width={284}
          height={12}
          rx={3}
          fill="#6B4647"
        />

        <Rect
          x={43}
          y={31}
          width={274}
          height={3}
          rx={1}
          fill="#A06D61"
        />

        <Rect
          x={58}
          y={57}
          width={3}
          height={165}
          rx={1}
          fill="#955C86"
          opacity={0.6}
        />

        <Rect
          x={299}
          y={57}
          width={3}
          height={165}
          rx={1}
          fill="#955C86"
          opacity={0.6}
        />

        <Rect
          x={32}
          y={238}
          width={296}
          height={15}
          rx={3}
          fill="#56343D"
        />

        <Rect
          x={25}
          y={253}
          width={310}
          height={8}
          rx={2}
          fill="#241925"
        />

        <Ellipse
          cx={180}
          cy={214}
          rx={76}
          ry={12}
          fill="#A93C24"
          opacity={0.35}
        />

        {Array.from({ length: 13 }, (_, i) => (
          <Ellipse
            key={i}
            cx={114 + i * 11}
            cy={212 + (i % 3) * 3}
            rx={4 + (i % 2) * 3}
            ry={2}
            fill={
              i % 3 === 0
                ? '#F18A43'
                : '#873A29'
            }
          />
        ))}

        <G>
          <Path
            d="M112 199 L211 181 L218 196 L119 216 Z"
            fill="#694033"
          />

          <Path
            d="M121 205 L208 189"
            stroke="#B65C37"
            strokeWidth={2}
          />

          <Ellipse
            cx={115}
            cy={207}
            rx={8}
            ry={9}
            fill="#9B6244"
          />

          <Ellipse
            cx={115}
            cy={207}
            rx={4}
            ry={5}
            fill="#58332D"
          />

          <Path
            d="M148 181 L247 201 L242 216 L143 196 Z"
            fill="#78503B"
          />

          <Path
            d="M151 189 L239 208"
            stroke="#BE6A42"
            strokeWidth={2}
          />

          <Ellipse
            cx={244}
            cy={209}
            rx={8}
            ry={9}
            fill="#AC7750"
          />

          <Ellipse
            cx={244}
            cy={209}
            rx={4}
            ry={5}
            fill="#654038"
          />
        </G>

        <Rect
          x={85}
          y={224}
          width={190}
          height={6}
          rx={2}
          fill="#51313A"
        />

        <Circle cx={281} cy={61} r={2} fill="#D67BB0" />
        <Circle cx={289} cy={61} r={2} fill="#FFB45E" />
      </Svg>

      {[0, 1, 2].map((i) => (
        <Smoke key={i} index={i} scale={scale} run={run} />
      ))}

      <Flame
        x={119}
        y={126}
        width={46}
        height={73}
        duration={510}
        color="#C94B32"
        scale={scale}
        run={run}
      />

      <Flame
        x={154}
        y={103}
        width={53}
        height={99}
        duration={640}
        color="#E86B36"
        scale={scale}
        run={run}
      />

      <Flame
        x={196}
        y={123}
        width={43}
        height={78}
        duration={450}
        color="#D95630"
        scale={scale}
        run={run}
      />

      <Flame
        x={137}
        y={146}
        width={35}
        height={58}
        duration={370}
        color="#FFAA50"
        scale={scale}
        run={run}
      />

      <Flame
        x={170}
        y={129}
        width={37}
        height={75}
        duration={560}
        color="#FFB45E"
        scale={scale}
        run={run}
      />

      <Flame
        x={202}
        y={154}
        width={25}
        height={49}
        duration={420}
        color="#FFB65C"
        scale={scale}
        run={run}
      />

      <Flame
        x={157}
        y={168}
        width={24}
        height={36}
        duration={310}
        color="#FFE2A0"
        scale={scale}
        run={run}
      />

      <Flame
        x={184}
        y={156}
        width={25}
        height={48}
        duration={480}
        color="#FFD38A"
        scale={scale}
        run={run}
      />

      {Array.from({ length: 9 }, (_, i) => (
        <Ember key={i} index={i} scale={scale} run={run} />
      ))}

      <Animated.View
        style={{
          position: 'absolute',
          left: 58 * scale,
          top: 57 * scale,
          width: 2 * scale,
          height: 165 * scale,
          backgroundColor: '#D67BB0',
          opacity: neon.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 0.7],
          }),
        }}
      />

      <Animated.View
        style={{
          position: 'absolute',
          left: 300 * scale,
          top: 57 * scale,
          width: 2 * scale,
          height: 165 * scale,
          backgroundColor: '#D67BB0',
          opacity: neon.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 0.7],
          }),
        }}
      />
    </View>
  );
}