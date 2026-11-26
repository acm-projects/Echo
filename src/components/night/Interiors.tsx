import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import { fonts, night } from '../../../theme';
import { useMotion } from './NightSky';
import { Fireplace } from './Fireplace';

export type InteriorKind =
  | 'bookshop'
  | 'harbor'
  | 'cafe'
  | 'radioroom'
  | 'studio';

export const INTERIOR_COLORS: Record<InteriorKind, string> = {
  bookshop: '#2B1A12',
  harbor: '#0B2A33',
  cafe: '#241722',
  radioroom: '#0A1430',
  studio: '#1A0B26',
};

type InteriorProps = {
  width: number;
  height: number;
  run: boolean;
};

const smoothEase = Easing.inOut(Easing.sin);

function useLoop(
  duration: number,
  run: boolean,
  easing = smoothEase,
  yoyo = true
) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) return;

    const step = Animated.timing(t, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: true,
      isInteraction: false,
    });

    const loop = Animated.loop(
      yoyo
        ? Animated.sequence([
            step,
            Animated.timing(t, {
              toValue: 0,
              duration,
              easing,
              useNativeDriver: true,
              isInteraction: false,
            }),
          ])
        : step
    );

    loop.start();

    return () => loop.stop();
  }, [duration, easing, run, t, yoyo]);

  return t;
}

function seeded(seed: number) {
  let n = seed;

  return () => {
    n = (n * 16807) % 2147483647;
    return n / 2147483647;
  };
}

function Bookshop({ width, height, run }: InteriorProps) {
  const sway = useLoop(3200, run);
  const drift = useLoop(9000, run, Easing.linear, false);

  const spines = useMemo(() => {
    const rand = seeded(11);

    const rows: {
      x: number;
      y: number;
      w: number;
      h: number;
      c: string;
    }[] = [];

    const palette = [
      '#6B2E2E',
      '#2E4A5C',
      '#5A4A1F',
      '#3E5A2E',
      '#5C2D4A',
      '#7A5A3A',
    ];

    for (const shelfY of [70, 150]) {
      let x = 0;

      while (x < width) {
        const w = 8 + rand() * 10;
        const h = 44 + rand() * 22;

        rows.push({
          x,
          y: shelfY - h,
          w,
          h,
          c: palette[Math.floor(rand() * palette.length)],
        });

        x += w + (rand() < 0.1 ? 14 : 1);
      }
    }

    return rows;
  }, [width]);

  return (
    <>
      <LinearGradient
        colors={['#1E120C', INTERIOR_COLORS.bookshop, '#3A2418']}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={170}
        style={{ position: 'absolute', top: 0, opacity: 0.55 }}
      >
        {spines.map((b, i) => (
          <Rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={b.c}
          />
        ))}

        <Rect x={0} y={70} width={width} height={6} fill="#4A2E1E" />
        <Rect x={0} y={150} width={width} height={6} fill="#4A2E1E" />
      </Svg>

      <Animated.View
        style={{
          position: 'absolute',
          right: width * 0.18,
          top: 0,
          alignItems: 'center',
          transform: [
            {
              rotate: sway.interpolate({
                inputRange: [0, 1],
                outputRange: ['-3deg', '3deg'],
              }),
            },
          ],
          transformOrigin: 'top',
        }}
      >
        <View
          style={{
            width: 1.5,
            height: 120,
            backgroundColor: '#1A0F0A',
          }}
        />

        <Svg width={220} height={height * 0.6}>
          <Path
            d={`M110 0 L0 ${height * 0.6} H220 Z`}
            fill="#FFD9A0"
            opacity={0.06}
          />

          <Path d="M92 0 H128 L120 16 H100 Z" fill="#1A0F0A" />
          <Circle cx={110} cy={18} r={4} fill="#FFD9A0" />
        </Svg>
      </Animated.View>

      {[0.15, 0.4, 0.7].map((f, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            right: width * (0.12 + f * 0.15),
            top: height * (0.25 + f * 0.25),
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: '#FFE2B0',
            opacity: 0.5,
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -40 - i * 12],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 6, -3],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  );
}

function Harbor({ width, height, run }: InteriorProps) {
  const waves = useLoop(4200, run, Easing.linear, false);
  const r = 46;

  return (
    <>
      <LinearGradient
        colors={['#071E25', INTERIOR_COLORS.harbor, '#123B44']}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        style={{ position: 'absolute', opacity: 0.35 }}
      >
        {Array.from({ length: Math.ceil(width / 34) }, (_, i) => (
          <Rect
            key={i}
            x={i * 34}
            y={height * 0.62}
            width={1.5}
            height={height * 0.38}
            fill="#05161B"
          />
        ))}

        <Rect
          x={0}
          y={height * 0.62}
          width={width}
          height={4}
          fill="#05161B"
        />
      </Svg>

      <View
        style={{
          position: 'absolute',
          right: 26,
          top: height * 0.08,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          overflow: 'hidden',
          backgroundColor: '#0E3A55',
          borderWidth: 6,
          borderColor: '#8A6A3A',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: -r * 2,
            top: r * 0.95,
            transform: [
              {
                translateX: waves.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, r * 2],
                }),
              },
            ],
          }}
        >
          <Svg width={r * 6} height={r}>
            <Path
              d={
                Array.from(
                  { length: 6 },
                  (_, i) =>
                    `${i ? '' : 'M0 10 '}Q${i * r + r / 2} 0 ${
                      (i + 1) * r
                    } 10`
                ).join(' ') + ` V${r} H0 Z`
              }
              fill="#1E7279"
            />
          </Svg>
        </Animated.View>

        <View
          style={{
            position: 'absolute',
            left: r * 0.3,
            top: r * 0.35,
            width: 3,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: night.window,
          }}
        />
      </View>
    </>
  );
}

const BOOK_PALETTE = [
  '#79505D',
  '#89684C',
  '#56536E',
  '#676752',
  '#8A4D51',
  '#564360',
  '#947456',
  '#49616B',
  '#704450',
  '#665A46',
  '#59486C',
  '#A16D58',
];

type BookSpine = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  decoration: number;
};

function LibraryWall({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const rows = 3;
  const rowHeight = height / rows;
  const shelfThickness = Math.max(3, Math.min(7, rowHeight * 0.12));
  const sectionWidth = 112;

  const books = useMemo(() => {
    const rand = seeded(46);
    const result: BookSpine[] = [];
    const sections = Math.ceil(width / sectionWidth);

    for (let row = 0; row < rows; row++) {
      const shelfY = (row + 1) * rowHeight - shelfThickness;

      for (let section = 0; section < sections; section++) {
        const start = section * sectionWidth + 7;
        const end = Math.min(
          (section + 1) * sectionWidth - 5,
          width - 5
        );

        let x = start;

        while (x < end - 5) {
          const w = Math.min(6 + rand() * 7, end - x);
          const h =
            (rowHeight - shelfThickness - 5) *
            (0.6 + rand() * 0.38);

          result.push({
            x,
            y: shelfY - h,
            w,
            h,
            color: BOOK_PALETTE[
              Math.floor(rand() * BOOK_PALETTE.length)
            ],
            decoration: Math.floor(rand() * 3),
          });

          x += w + 1 + rand() * 1.5;
        }
      }
    }

    return result;
  }, [width, rowHeight, shelfThickness]);

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#3C2731"
      />

      {Array.from({ length: rows }, (_, row) => (
        <Rect
          key={row}
          x={0}
          y={row * rowHeight + 4}
          width={width}
          height={Math.max(1, rowHeight - shelfThickness - 4)}
          fill="#19131C"
        />
      ))}

      {books.map((book, i) => (
        <G key={i}>
          <Rect
            x={book.x}
            y={book.y}
            width={book.w}
            height={book.h}
            rx={0.8}
            fill={book.color}
          />

          <Rect
            x={book.x}
            y={book.y + 1}
            width={1}
            height={Math.max(1, book.h - 2)}
            fill="#FFFFFF"
            opacity={0.08}
          />

          {book.decoration !== 0 && (
            <Rect
              x={book.x + 2}
              y={book.y + book.h * 0.18}
              width={Math.max(1, book.w - 4)}
              height={1.5}
              fill="#D6AF82"
              opacity={0.55}
            />
          )}

          {book.decoration === 2 && (
            <Rect
              x={book.x + 2}
              y={book.y + book.h * 0.28}
              width={Math.max(1, book.w - 4)}
              height={1}
              fill="#D6AF82"
              opacity={0.35}
            />
          )}

          <Rect
            x={book.x + 2}
            y={book.y + book.h - 4}
            width={Math.max(1, book.w - 4)}
            height={1}
            fill="#D6AF82"
            opacity={0.3}
          />
        </G>
      ))}

      {Array.from({ length: rows }, (_, row) => {
        const y = (row + 1) * rowHeight - shelfThickness;

        return (
          <G key={row}>
            <Rect
              x={0}
              y={y}
              width={width}
              height={shelfThickness}
              fill="#76504C"
            />

            <Rect
              x={0}
              y={y}
              width={width}
              height={1}
              fill="#A57865"
            />

            <Rect
              x={0}
              y={y + shelfThickness - 1}
              width={width}
              height={1}
              fill="#D67BB0"
              opacity={0.35}
            />
          </G>
        );
      })}

      {Array.from(
        { length: Math.ceil(width / sectionWidth) + 1 },
        (_, i) => (
          <G key={i}>
            <Rect
              x={i * sectionWidth}
              y={0}
              width={5}
              height={height}
              fill="#503541"
            />

            <Rect
              x={i * sectionWidth}
              y={0}
              width={1}
              height={height}
              fill="#926271"
              opacity={0.4}
            />
          </G>
        )
      )}

      <Rect
        x={0}
        y={0}
        width={width}
        height={4}
        fill="#78505C"
      />

      <Rect
        x={0}
        y={height - 3}
        width={width}
        height={3}
        fill="#583944"
      />
    </Svg>
  );
}

type CityBuilding = {
  x: number;
  w: number;
  h: number;
  color: string;
  roof: number;
  windows: {
    x: number;
    y: number;
    lit: boolean;
  }[];
};

function createBuildings(
  width: number,
  height: number,
  seed: number,
  foreground: boolean
): CityBuilding[] {
  const rand = seeded(seed);
  const result: CityBuilding[] = [];

  let x = -8;

  while (x < width) {
    const w = 22 + rand() * 34;
    const h = height * (0.23 + rand() * 0.42);
    const windows: CityBuilding['windows'] = [];

    for (let wy = 12; wy < h - 6; wy += 13) {
      for (let wx = 7; wx < w - 6; wx += 11) {
        windows.push({
          x: wx,
          y: wy,
          lit: rand() > 0.68,
        });
      }
    }

    result.push({
      x,
      w,
      h,
      color: foreground
        ? ['#1B121D', '#211520', '#241722'][
            Math.floor(rand() * 3)
          ]
        : ['#492630', '#532A38', '#422332'][
            Math.floor(rand() * 3)
          ],
      roof: Math.floor(rand() * 5),
      windows,
    });

    x += w + 1 + rand() * 3;
  }

  return result;
}

function CityWindow({
  width,
  height,
  run,
}: {
  width: number;
  height: number;
  run: boolean;
}) {
  const beacon = useLoop(1800, run);

  const frame = 5;
  const innerWidth = Math.max(1, width - frame * 2);
  const innerHeight = Math.max(1, height - frame * 2);

  const back = useMemo(
    () => createBuildings(innerWidth, innerHeight, 28, false),
    [innerWidth, innerHeight]
  );

  const front = useMemo(
    () => createBuildings(innerWidth, innerHeight * 0.68, 56, true),
    [innerWidth, innerHeight]
  );

  const stars = useMemo(() => {
    const rand = seeded(83);

    return Array.from({ length: 18 }, () => ({
      x: rand() * innerWidth,
      y: rand() * innerHeight * 0.48,
      r: 0.5 + rand() * 0.8,
    }));
  }, [innerWidth, innerHeight]);

  const renderBuilding = (
    b: CityBuilding,
    i: number,
    foreground: boolean
  ) => {
    const y = innerHeight - b.h;
    const roofHeight = Math.min(14, b.w * 0.32);

    return (
      <G key={i}>
        <Rect
          x={b.x}
          y={y}
          width={b.w}
          height={b.h}
          fill={b.color}
        />

        {b.roof === 0 && (
          <Path
            d={`M${b.x} ${y}
                L${b.x + b.w / 2} ${y - roofHeight}
                L${b.x + b.w} ${y} Z`}
            fill={b.color}
          />
        )}

        {b.roof === 1 && (
          <Path
            d={`M${b.x} ${y}
                Q${b.x + b.w / 2} ${y - roofHeight * 2}
                ${b.x + b.w} ${y} Z`}
            fill={b.color}
          />
        )}

        {b.roof === 2 && (
          <>
            <Rect
              x={b.x + b.w * 0.25}
              y={y - 7}
              width={b.w * 0.5}
              height={8}
              fill={b.color}
            />

            <Rect
              x={b.x + b.w * 0.38}
              y={y - 12}
              width={b.w * 0.24}
              height={6}
              fill={b.color}
            />
          </>
        )}

        {b.roof === 3 && (
          <>
            <Rect
              x={b.x + b.w * 0.5}
              y={y - 18}
              width={1.5}
              height={18}
              fill={b.color}
            />

            <Rect
              x={b.x + b.w * 0.5 - 5}
              y={y - 13}
              width={11}
              height={1.5}
              fill={b.color}
            />

            <Circle
              cx={b.x + b.w * 0.5 + 0.75}
              cy={y - 19}
              r={1.8}
              fill="#D67BB0"
              opacity={0.85}
            />
          </>
        )}

        {b.roof === 4 && (
          <>
            <Rect
              x={b.x + b.w * 0.28}
              y={y - 12}
              width={b.w * 0.44}
              height={9}
              rx={3}
              fill={b.color}
            />

            <Rect
              x={b.x + b.w * 0.34}
              y={y - 3}
              width={1.5}
              height={4}
              fill={b.color}
            />

            <Rect
              x={b.x + b.w * 0.65}
              y={y - 3}
              width={1.5}
              height={4}
              fill={b.color}
            />
          </>
        )}

        {b.windows.map((window, j) => (
          <Rect
            key={j}
            x={b.x + window.x}
            y={y + window.y}
            width={foreground ? 3 : 2.5}
            height={foreground ? 6 : 5}
            fill={j % 7 === 0 ? '#D67BB0' : '#FFB45E'}
            opacity={
              window.lit
                ? foreground
                  ? 0.95
                  : 0.5
                : 0.035
            }
          />
        ))}
      </G>
    );
  };

  return (
    <View
      style={{
        width,
        height,
        borderRadius: 5,
        backgroundColor: '#50313F',
        padding: frame,
      }}
    >
      <View
        style={{
          width: innerWidth,
          height: innerHeight,
          overflow: 'hidden',
          backgroundColor: '#98523E',
        }}
      >
        <LinearGradient
          colors={['#482638', '#98523E', '#CB7947']}
          locations={[0, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />

        <Svg
          width={innerWidth}
          height={innerHeight}
          viewBox={`0 0 ${innerWidth} ${innerHeight}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          {stars.map((star, i) => (
            <Circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#F2D1A7"
              opacity={0.65}
            />
          ))}

          <Circle
            cx={innerWidth * 0.76}
            cy={innerHeight * 0.23}
            r={Math.min(19, innerHeight * 0.11)}
            fill="#FFD297"
            opacity={0.9}
          />

          {back.map((b, i) => renderBuilding(b, i, false))}

          {front.map((b, i) => renderBuilding(b, i, true))}

          <Rect
            x={0}
            y={innerHeight - 7}
            width={innerWidth}
            height={7}
            fill="#18121D"
          />

          <Path
            d={`M10 0 H45 L0 ${innerHeight * 0.64} V${innerHeight * 0.3} Z`}
            fill="#F5B2A5"
            opacity={0.04}
          />

          <Path
            d={`M${innerWidth * 0.65} 0
                H${innerWidth * 0.72}
                L${innerWidth * 0.36} ${innerHeight}
                H${innerWidth * 0.29} Z`}
            fill="#F5B2A5"
            opacity={0.035}
          />

          <Rect
            x={innerWidth / 2 - 2}
            y={0}
            width={4}
            height={innerHeight}
            fill="#50313F"
          />
        </Svg>

        <Animated.View
          style={{
            position: 'absolute',
            top: innerHeight * 0.24,
            left: innerWidth * 0.13,
            width: 3,
            height: 3,
            borderRadius: 2,
            backgroundColor: '#FF9CBD',
            opacity: run
              ? beacon.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.85],
                })
              : 0.4,
          }}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          left: -6,
          right: -6,
          bottom: -5,
          height: 6,
          borderRadius: 2,
          backgroundColor: '#78505C',
        }}
      />
    </View>
  );
}

function Cafe({ width, height, run }: InteriorProps) {
  const windowWidth = Math.min(width * 0.86, 740);
  const windowHeight = Math.min(height * 0.24, 220);
  const windowTop = height * 0.055;

  const shelfTop = windowTop + windowHeight + height * 0.035;
  const shelfHeight = Math.min(height * 0.25, 205);
  const shelfBottom = shelfTop + shelfHeight;

  const floorY = height * 0.93;
  const fireplaceTop = shelfBottom + height * 0.035;
  const fireplaceSpace = Math.max(1, floorY - fireplaceTop);

  const fireplaceWidth = Math.min(
    width * 0.9,
    440,
    fireplaceSpace * (360 / 280)
  );

  const fireplaceHeight = fireplaceWidth * (280 / 360);
  const fireplaceY = floorY - fireplaceHeight;

  const glow = useLoop(2400, run);

  return (
    <>
      <LinearGradient
        colors={['#201421', '#30202B', '#241720']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      >
        {Array.from(
          { length: Math.ceil(width / 100) },
          (_, i) => (
            <Rect
              key={i}
              x={i * 100}
              y={0}
              width={1}
              height={height}
              fill="#A47784"
              opacity={0.08}
            />
          )
        )}

        <Rect
          x={0}
          y={shelfBottom}
          width={width}
          height={Math.max(0, floorY - shelfBottom)}
          fill="#211720"
        />

        {Array.from(
          { length: Math.ceil(width / 90) },
          (_, i) => (
            <Rect
              key={i}
              x={i * 90 + 7}
              y={shelfBottom + 10}
              width={76}
              height={Math.max(1, floorY - shelfBottom - 20)}
              rx={2}
              fill="#2B1D27"
              stroke="#49303B"
              strokeWidth={1}
            />
          )
        )}

        <Rect
          x={0}
          y={shelfBottom + 3}
          width={width}
          height={3}
          fill="#68404D"
        />

        <Rect
          x={0}
          y={floorY}
          width={width}
          height={height - floorY}
          fill="#19121C"
        />

        <Rect
          x={0}
          y={floorY}
          width={width}
          height={3}
          fill="#57353E"
        />

        {Array.from(
          { length: Math.ceil(width / 55) + 4 },
          (_, i) => (
            <Path
              key={i}
              d={`M${i * 55 - 100} ${height}
                  L${
                    width / 2 +
                    (i * 55 - 100 - width / 2) * 0.72
                  } ${floorY}`}
              stroke="#49313A"
              strokeWidth={1}
              opacity={0.6}
            />
          )
        )}
      </Svg>

      <View
        style={{
          position: 'absolute',
          top: windowTop,
          left: (width - windowWidth) / 2,
          width: windowWidth,
          height: windowHeight,
        }}
      >
        <CityWindow
          width={windowWidth}
          height={windowHeight}
          run={run}
        />
      </View>

      <View
        style={{
          position: 'absolute',
          top: shelfTop,
          left: 0,
          width,
          height: shelfHeight,
        }}
      >
        <LibraryWall
          width={width}
          height={shelfHeight}
        />
      </View>

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: shelfBottom,
          height: 2,
          backgroundColor: '#D67BB0',
          opacity: run
            ? glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.4],
              })
            : 0.25,
        }}
      />

      <View
        style={{
          position: 'absolute',
          top: fireplaceY,
          left: (width - fireplaceWidth) / 2,
          width: fireplaceWidth,
          height: fireplaceHeight,
        }}
      >
        <Fireplace
          width={fireplaceWidth}
          run={run}
        />
      </View>

      <LinearGradient
        colors={[
          'rgba(18,11,24,0.22)',
          'rgba(18,11,24,0.24)',
          'rgba(18,11,24,0.08)',
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

function RadioRoom({ width, height, run }: InteriorProps) {
  const needle = useLoop(4000, run);
  const onAir = useLoop(1400, run);

  return (
    <>
      <LinearGradient
        colors={['#050B1E', INTERIOR_COLORS.radioroom, '#13224A']}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        style={{ position: 'absolute', opacity: 0.18 }}
      >
        {Array.from({ length: Math.ceil(width / 40) }, (_, i) => (
          <Rect
            key={`v${i}`}
            x={i * 40}
            y={0}
            width={0.8}
            height={height}
            fill="#9CC2FF"
          />
        ))}

        {Array.from({ length: Math.ceil(height / 40) }, (_, i) => (
          <Rect
            key={`h${i}`}
            x={0}
            y={i * 40}
            width={width}
            height={0.8}
            fill="#9CC2FF"
          />
        ))}

        <Path
          d={`M${width * 0.2} ${height * 0.3}
              L${width * 0.35} ${height * 0.22}
              L${width * 0.5} ${height * 0.34}
              L${width * 0.62} ${height * 0.26}`}
          stroke="#FFE9A8"
          strokeWidth={1}
          fill="none"
        />
      </Svg>

      <View
        style={{
          position: 'absolute',
          right: -40,
          bottom: 60,
          width: 180,
          height: 180,
          borderRadius: 90,
          borderWidth: 2,
          borderColor: 'rgba(156,194,255,0.25)',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: 89,
            top: 20,
            width: 2,
            height: 70,
            backgroundColor: '#FF8A6A',
            transformOrigin: 'bottom',
            transform: [
              {
                rotate: needle.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-38deg', '-12deg'],
                }),
              },
            ],
          }}
        />
      </View>

      <Animated.View
        style={{
          position: 'absolute',
          right: 20,
          top: height * 0.12,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderWidth: 1.2,
          borderColor: '#FF5A5A',
          borderRadius: 3,
          opacity: onAir.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 0.9],
          }),
        }}
      >
        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: 10,
            letterSpacing: 2,
            color: '#FF5A5A',
          }}
        >
          ON AIR
        </Text>
      </Animated.View>
    </>
  );
}

function Studio({ width, height, run }: InteriorProps) {
  const rec = useLoop(1100, run);

  return (
    <>
      <LinearGradient
        colors={['#0E0618', INTERIOR_COLORS.studio, '#2A0F3A']}
        style={StyleSheet.absoluteFill}
      />

      <Svg
        width={width}
        height={height}
        style={{ position: 'absolute', opacity: 0.2 }}
      >
        {Array.from(
          {
            length:
              Math.ceil(width / 28) *
              Math.ceil(height / 28),
          },
          (_, i) => {
            const cols = Math.ceil(width / 28);
            const x = (i % cols) * 28;
            const y = Math.floor(i / cols) * 28;

            return (
              <Path
                key={i}
                d={
                  (Math.floor(i / cols) + (i % cols)) % 2
                    ? `M${x} ${y}
                       L${x + 28} ${y}
                       L${x + 14} ${y + 28} Z`
                    : `M${x} ${y + 28}
                       L${x + 28} ${y + 28}
                       L${x + 14} ${y} Z`
                }
                fill="#5B2A7A"
              />
            );
          }
        )}
      </Svg>

      <Animated.View
        style={{
          position: 'absolute',
          right: 22,
          top: height * 0.11,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: rec.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FF3B5C',
          }}
        />

        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: 10,
            letterSpacing: 2,
            color: '#FF3B5C',
          }}
        >
          REC
        </Text>
      </Animated.View>

      <Svg
        width={60}
        height={140}
        style={{
          position: 'absolute',
          left: 16,
          bottom: 0,
          opacity: 0.5,
        }}
      >
        <Rect
          x={18}
          y={6}
          width={24}
          height={40}
          rx={12}
          fill="#0A0412"
        />

        <Path
          d="M12 30 Q12 58 30 58 Q48 58 48 30"
          stroke="#0A0412"
          strokeWidth={3}
          fill="none"
        />

        <Rect
          x={28}
          y={58}
          width={4}
          height={82}
          fill="#0A0412"
        />
      </Svg>
    </>
  );
}

export function Interior({ kind }: { kind: InteriorKind }) {
  const window = useWindowDimensions();
  const run = useMotion('background');

  const props = {
    width: Math.max(1, window.width),
    height: Math.max(1, window.height),
    run,
  };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      {kind === 'bookshop' && <Bookshop {...props} />}
      {kind === 'harbor' && <Harbor {...props} />}
      {kind === 'cafe' && <Cafe {...props} />}
      {kind === 'radioroom' && <RadioRoom {...props} />}
      {kind === 'studio' && <Studio {...props} />}
    </View>
  );
}