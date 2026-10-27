
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../../theme';

// Keep our existing star arrangement
const DOT_STARS = [
  { x: 0.10, y: 0.12, size: 3, delay: 0 },
  { x: 0.21, y: 0.19, size: 2, delay: 500 },
  { x: 0.31, y: 0.16, size: 2, delay: 900 },
  { x: 0.43, y: 0.23, size: 3, delay: 1200 },
  { x: 0.55, y: 0.17, size: 2, delay: 300 },
  { x: 0.69, y: 0.24, size: 3, delay: 1300 },
  { x: 0.80, y: 0.18, size: 2, delay: 700 },
  { x: 0.16, y: 0.31, size: 2, delay: 1100 },
  { x: 0.28, y: 0.36, size: 3, delay: 450 },
  { x: 0.62, y: 0.33, size: 2, delay: 1500 },
  { x: 0.77, y: 0.39, size: 3, delay: 850 },
  { x: 0.12, y: 0.46, size: 2, delay: 650 },
  { x: 0.38, y: 0.43, size: 2, delay: 250 },
  { x: 0.54, y: 0.49, size: 3, delay: 1050 },
  { x: 0.71, y: 0.46, size: 2, delay: 350 },
  { x: 0.86, y: 0.52, size: 2, delay: 1400 },
  { x: 0.20, y: 0.57, size: 3, delay: 800 },
  { x: 0.33, y: 0.62, size: 2, delay: 1150 },
  { x: 0.49, y: 0.60, size: 2, delay: 450 },
  { x: 0.65, y: 0.66, size: 3, delay: 1350 },
  { x: 0.82, y: 0.61, size: 2, delay: 650 },
] as const;

const SPARKLE_STARS = [
  { x: 0.13, y: 0.08, size: 14, delay: 200 },
  { x: 0.84, y: 0.14, size: 10, delay: 800 },
  { x: 0.18, y: 0.26, size: 12, delay: 1200 },
  { x: 0.89, y: 0.34, size: 11, delay: 500 },
  { x: 0.12, y: 0.64, size: 10, delay: 1000 },
  { x: 0.86, y: 0.70, size: 13, delay: 300 },
] as const;

type StarProps = {
  x: number;
  y: number;
  size: number;
  delay: number;
  width: number;
  height: number;
};

function DotStar({
  x, y, size, delay, width, height,
}: StarProps) {
  const opacity = useRef(
    new Animated.Value(0.18)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 0.68,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.18,
          duration: 2100,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * width,
        top: y * height,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F7E2BE',
        opacity,
      }}
    />
  );
}

function SparkleStar({
  x, y, size, delay, width, height,
}: StarProps) {
  const opacity = useRef(
    new Animated.Value(0.28)
  ).current;

  const scale = useRef(
    new Animated.Value(0.88)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1300,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 1300,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.28,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.88,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, opacity, scale]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * width,
        top: y * height,
        color: '#F9DEA2',
        fontSize: size,
        opacity,
        transform: [{ scale }],
        textShadowColor: 'rgba(249,222,162,0.35)',
        textShadowRadius: 8,
      }}
    >
      ✦
    </Animated.Text>
  );
}

// Our existing moon and sleeping bat
function MoonBatLogo({ size }: { size: number }) {
  const float = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -10,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const rocking = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: -1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floating.start();
    rocking.start();

    return () => {
      floating.stop();
      rocking.stop();
    };
  }, [float, sway]);

  const rotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-1.3deg', '1.3deg'],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { translateY: float },
          { rotate },
        ],
      }}
    >
      <Image
        source={require('../../../assets/images/echo-logo.png')}
        resizeMode="contain"
        style={{ width: size, height: size }}
        accessibilityLabel="A sleeping bat hanging from a crescent moon"
      />
    </Animated.View>
  );
}

// One transparent cloud frame
function CloudFrame({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const frameHeight = Math.min(height * 0.34, 330);

  return (
    <View
      pointerEvents="none"
      style={[
        styles.cloudLayer,
        { height: frameHeight },
      ]}
    >
      <Image
        source={require('../../../assets/images/echo-cloud-frame.png')}
        resizeMode="stretch"
        style={{
          width,
          height: frameHeight,
        }}
      />
    </View>
  );
}

function DividerMoon() {
  return (
    <View style={styles.ornament}>
      <View style={styles.line} />
      <Text style={styles.smallMoon}>☾</Text>
      <View style={styles.line} />
    </View>
  );
}

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const compact = height < 720;

  const logoSize = Math.min(
    width * 0.74,
    compact ? 220 : 280,
    height * 0.31
  );

  return (
    <View style={styles.screen}>
      {/* Twinkling stars */}
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        {DOT_STARS.map((star, index) => (
          <DotStar
            key={`dot-${index}`}
            {...star}
            width={width}
            height={height}
          />
        ))}

        {SPARKLE_STARS.map((star, index) => (
          <SparkleStar
            key={`sparkle-${index}`}
            {...star}
            width={width}
            height={height}
          />
        ))}
      </View>

      {/* New illustrated cloud frame */}
      <CloudFrame width={width} height={height} />

      {/* Moon and Echo wordmark */}
      <View
        style={[
          styles.content,
          {
            paddingTop:
              insets.top + (compact ? 10 : 26),
          },
        ]}
      >
        <MoonBatLogo size={logoSize} />

        <Text
          style={[
            styles.title,
            { fontSize: compact ? 60 : 74 },
          ]}
        >
          Echo
        </Text>

        <DividerMoon />
      </View>

      {/* Interactive navigation buttons */}
      <View
        style={[
          styles.actions,
          {
            paddingHorizontal: Math.max(
              26,
              width * 0.08
            ),
            paddingBottom: Math.max(
              insets.bottom + 72,
              compact ? 92 : 126
            ),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/Test/login')}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryText}>
            LOG IN
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/Test/signup')}
          style={({ pressed }) => [
            styles.button,
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryText}>
            Create account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#170033',
    overflow: 'hidden',
  },

  cloudLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  title: {
    fontFamily: fonts.serif,
    color: '#F1A8CF',
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: -6,
    textShadowColor: 'rgba(241,168,207,0.42)',
    textShadowOffset: {
      width: 0,
      height: 0,
    },
    textShadowRadius: 18,
  },

  ornament: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  line: {
    width: 54,
    height: 1,
    backgroundColor: 'rgba(245,198,90,0.56)',
  },

  smallMoon: {
    color: colors.gold,
    fontSize: 17,
    marginTop: -1,
  },

  actions: {
    width: '100%',
    gap: 15,
    zIndex: 3,
  },

  button: {
    minHeight: 58,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButton: {
    backgroundColor: '#DF87B6',
    borderWidth: 1.5,
    borderColor: '#EFA2CB',
    shadowColor: '#D67BB0',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  secondaryButton: {
    backgroundColor: 'rgba(214,123,176,0.08)',
    borderWidth: 1.8,
    borderColor: '#E894C5',
  },

  primaryText: {
    fontFamily: fonts.sansBold,
    color: '#29123C',
    fontSize: 16,
    letterSpacing: 3,
  },

  secondaryText: {
    fontFamily: fonts.sansBold,
    color: '#F1A8CF',
    fontSize: 16,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
