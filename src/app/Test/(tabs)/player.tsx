import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../components/Screen';
import { ProgressBar } from '../../../components/ProgressBar';
import { Sheet, SheetItem } from '../../../components/Sheet';
import { FlyingBat, HangingBat } from '../../../components/night/Bat';
import { useReducedMotion } from '../../../components/night/NightSky';
import { colors, fonts, radius, scenes, type } from '../../../../theme';
import { formatTime, playback, useNowPlaying } from '../../../data/playback';
import { useSettings } from '../../../data/settings';

const SPEEDS = [0.8, 1, 1.25, 1.5, 2];
const neon = scenes.neon;

// Five bars that dance while a voice is speaking and rest when paused.
function Equalizer({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active || reduced) {
      bars.forEach((b) => Animated.timing(b, { toValue: 0.3, duration: 200, useNativeDriver: true }).start());
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 260 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.25 + (i % 2) * 0.2, duration: 300 + i * 50, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars, reduced]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 16 }}>
      {bars.map((b, i) => <Animated.View key={i} style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: neon.accent, transform: [{ scaleY: b }] }} />)}
    </View>
  );
}

// The cover as a printed book jacket: flat scene colour, an inset rule, a tiny skyline and the mascot asleep on the
// title. The bat wakes and flaps while a chapter plays.
function Cover({ title, author, playing }: { title: string; author: string; playing: boolean }) {
  return (
    <View style={s.cover}>
      <View style={s.coverRule}>
        <View style={{ alignSelf: 'flex-end' }}>{playing ? <FlyingBat size={54} flapMs={170} /> : <HangingBat size={22} />}</View>
        <View style={{ marginTop: 'auto' }}>
          <Text style={s.coverTitle}>{title}</Text>
          <View style={s.coverLine} />
          <Text style={s.coverAuthor}>{author.toUpperCase()}</Text>
        </View>
      </View>
      <Svg width="100%" height={46} viewBox="0 0 300 46" preserveAspectRatio="none" style={s.coverCity}>
        <Path d="M0 46 V30 H18 V18 H34 V26 H52 V10 H66 V24 H88 V32 H104 V14 H122 V22 H140 V6 H150 V22 H170 V30 H190 V16 H208 V26 H226 V12 H244 V28 H262 V20 H280 V30 H300 V46 Z" fill={neon.near} />
      </Svg>
    </View>
  );
}

export default function Player() {
  const now = useNowPlaying();
  const [settings, update] = useSettings();
  const [menu, setMenu] = useState(false);
  const [barWidth, setBarWidth] = useState(1);
  const remaining = now.durationSec - now.positionSec;

  useEffect(() => {
    // Start each session at the listener's preferred speed.
    playback.setSpeed(settings.playbackSpeed);
  }, [settings.playbackSpeed]);

  const collapse = () => (router.canGoBack() ? router.back() : router.navigate('/Test/library'));
  const nextSpeed = () => playback.setSpeed(SPEEDS[(SPEEDS.indexOf(now.speed) + 1) % SPEEDS.length]);

  return (
    <Screen scene="neon" variant="hero" style={{ paddingHorizontal: 24 }}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable style={s.round} onPress={collapse} accessibilityRole="button" accessibilityLabel="Close player">
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.eyebrow}>NOW PLAYING</Text>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: colors.text }} numberOfLines={1}>Chapter {now.chapterNumber}</Text>
          </View>
          <Pressable style={s.round} onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>

        <Cover title={now.title} author={now.author} playing={now.isPlaying} />

        <View style={{ alignItems: 'center', marginTop: 22, gap: 6 }}>
          <Text style={s.chapter}>{now.chapter}</Text>
          <View style={s.speaking}>
            <Equalizer active={now.isPlaying} />
            <Text style={s.speakingText}>{now.isPlaying ? `${now.speaker} is speaking` : 'Paused'}</Text>
          </View>
        </View>

        <Pressable
          style={{ marginTop: 24, paddingVertical: 8 }}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={(e) => playback.seek(e.nativeEvent.locationX / barWidth)}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
        >
          <ProgressBar value={now.positionSec / now.durationSec} height={5} />
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.meta}>{formatTime(now.positionSec)}</Text>
          <Text style={type.meta}>-{formatTime(remaining)}</Text>
        </View>

        <View style={s.controls}>
          <Pressable style={s.skip} onPress={() => playback.skip(-settings.skipSeconds)} accessibilityLabel={`Back ${settings.skipSeconds} seconds`}>
            <Ionicons name="refresh" size={24} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
            <Text style={s.skipText}>{settings.skipSeconds}</Text>
          </Pressable>
          <Pressable onPress={playback.toggle} accessibilityRole="button" accessibilityLabel={now.isPlaying ? 'Pause' : 'Play'} style={({ pressed }) => pressed && { transform: [{ scale: 0.96 }] }}>
            <View style={s.play}>
              <Ionicons name={now.isPlaying ? 'pause' : 'play'} size={34} color="#16121F" style={!now.isPlaying && { marginLeft: 4 }} />
            </View>
          </Pressable>
          <Pressable style={s.skip} onPress={() => playback.skip(settings.skipSeconds)} accessibilityLabel={`Forward ${settings.skipSeconds} seconds`}>
            <Ionicons name="refresh" size={24} color="#fff" />
            <Text style={s.skipText}>{settings.skipSeconds}</Text>
          </Pressable>
        </View>

        <View style={s.extras}>
          <Pressable onPress={nextSpeed} style={s.pill} accessibilityRole="button" accessibilityLabel="Playback speed">
            <Text style={s.pillText}>{now.speed}×</Text>
          </Pressable>
          <Pressable onPress={() => update('sleepTimerMinutes', settings.sleepTimerMinutes ? 0 : 30)} style={[s.pill, settings.sleepTimerMinutes > 0 && s.pillOn]} accessibilityRole="button" accessibilityLabel="Sleep timer">
            <Ionicons name="moon-outline" size={14} color={settings.sleepTimerMinutes ? '#14102A' : colors.text} />
            <Text style={[s.pillText, settings.sleepTimerMinutes > 0 && { color: '#14102A' }]}>{settings.sleepTimerMinutes ? `${settings.sleepTimerMinutes}m` : 'Sleep'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/Test/book_details', params: { title: now.title, author: now.author } })} style={s.pill} accessibilityRole="button">
            <Ionicons name="people-outline" size={14} color={colors.text} />
            <Text style={s.pillText}>Cast</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Listening options">
        <Text style={s.sheetLabel}>SPEED</Text>
        <View style={s.speeds}>
          {SPEEDS.map((v) => (
            <Pressable key={v} onPress={() => playback.setSpeed(v)} style={[s.speedChip, now.speed === v && s.pillOn]} accessibilityState={{ selected: now.speed === v }}>
              <Text style={[s.pillText, now.speed === v && { color: '#14102A' }]}>{v}×</Text>
            </Pressable>
          ))}
        </View>
        <SheetItem icon="moon-outline" label="Sleep timer" detail={settings.sleepTimerMinutes ? `${settings.sleepTimerMinutes} min` : 'Off'} onPress={() => update('sleepTimerMinutes', ({ 0: 15, 15: 30, 30: 45, 45: 60, 60: 0 } as const)[settings.sleepTimerMinutes])} />
        <SheetItem icon="book-outline" label="Book details & cast" onPress={() => { setMenu(false); router.push({ pathname: '/Test/book_details', params: { title: now.title, author: now.author } }); }} />
        <SheetItem icon="pulse-outline" label="Voice settings" onPress={() => { setMenu(false); router.push({ pathname: '/Test/settings', params: { section: 'voice' } }); }} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 260 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 3, color: neon.accent },
  cover: { marginTop: 22, alignSelf: 'center', width: '100%', maxWidth: 340, aspectRatio: 0.82, borderRadius: radius.md, backgroundColor: '#5B1A4E', overflow: 'hidden' },
  coverRule: { flex: 1, margin: 12, marginBottom: 52, padding: 16, borderWidth: 1, borderColor: 'rgba(255,233,200,0.45)', borderRadius: radius.sm },
  coverTitle: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, letterSpacing: -0.5, color: '#FFE9C8' },
  coverLine: { width: 36, height: 2, backgroundColor: '#FF9A7A', marginVertical: 10 },
  coverAuthor: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: 'rgba(255,233,200,0.8)' },
  coverCity: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  chapter: { fontFamily: fonts.serifItalic, fontSize: 20, color: colors.text, textAlign: 'center' },
  speaking: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,111,208,0.12)', borderWidth: 1, borderColor: 'rgba(255,111,208,0.35)' },
  speakingText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginTop: 18 },
  skip: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(98,230,240,0.14)', borderWidth: 1, borderColor: 'rgba(98,230,240,0.4)', alignItems: 'center', justifyContent: 'center' },
  skipText: { position: 'absolute', fontFamily: fonts.sansBold, fontSize: 9, color: '#fff' },
  play: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: neon.accent },
  extras: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 22 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: neon.accent, borderColor: neon.accent },
  pillText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  sheetLabel: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2, color: colors.dim, marginBottom: 10 },
  speeds: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  speedChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
});
