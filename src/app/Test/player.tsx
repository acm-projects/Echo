import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { ProgressBar } from '../../components/ProgressBar';
import { Sheet, SheetItem } from '../../components/Sheet';
import { FlyingBat, HangingBat } from '../../components/night/Bat';
import { useReducedMotion } from '../../components/night/NightSky';
import { colors, fonts, radius, scenes, type } from '../../../theme';
import { formatCountdown, formatTime, hasTrack, playback, useNowPlaying, useSleepCountdown } from '../../data/playback';
import { useSettings } from '../../data/settings';

const SPEEDS = [0.8, 1, 1.25, 1.5, 2];
const SLEEP_PRESETS = [5, 10, 15, 30, 45, 60, 90];
const SLEEP_MAX_MINUTES = 12 * 60;
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
          <Text style={s.coverAuthor}>{(author || '').toUpperCase()}</Text>
        </View>
      </View>
      <Svg width="100%" height={46} viewBox="0 0 300 46" preserveAspectRatio="none" style={s.coverCity}>
        <Path d="M0 46 V30 H18 V18 H34 V26 H52 V10 H66 V24 H88 V32 H104 V14 H122 V22 H140 V6 H150 V22 H170 V30 H190 V16 H208 V26 H226 V12 H244 V28 H262 V20 H280 V30 H300 V46 Z" fill={neon.near} />
      </Svg>
    </View>
  );
}

// The progress bar, draggable. While a finger (or mouse) is down the bar and times follow it and the audio keeps
// playing where it was; letting go seeks there once, so dragging doesn't fire a seek per pixel. A tap seeks too.
function Scrubber({ positionSec, durationSec }: { positionSec: number; durationSec: number }) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  // The bar's left edge on screen, taken when the touch starts: pageX keeps working when the finger drifts off the
  // bar, where locationX would jump to whatever view is under it.
  const origin = useRef(0);
  const fractionAt = (pageX: number) => Math.max(0, Math.min(1, (pageX - origin.current) / width));
  const playing = durationSec > 0 ? positionSec / durationSec : 0;
  const shown = drag ?? playing;
  const shownSec = drag !== null ? drag * durationSec : positionSec;
  const step = durationSec > 0 ? Math.min(0.05, 15 / durationSec) : 0.05;
  const finish = () => {
    if (drag !== null) playback.seek(drag);
    setDrag(null);
  };
  return (
    <>
      <View
        style={s.scrub}
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => durationSec > 0}
        onMoveShouldSetResponder={() => durationSec > 0}
        // Keeps the ScrollView from taking over a sideways drag.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          origin.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
          setDrag(fractionAt(e.nativeEvent.pageX));
        }}
        onResponderMove={(e) => setDrag(fractionAt(e.nativeEvent.pageX))}
        onResponderRelease={finish}
        onResponderTerminate={finish}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{ min: 0, max: Math.round(durationSec), now: Math.round(shownSec), text: `${formatTime(shownSec)} of ${formatTime(durationSec)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => playback.seek(playing + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      >
        <View pointerEvents="none">
          <ProgressBar value={shown} height={drag !== null ? 7 : 5} />
        </View>
        <View pointerEvents="none" style={[s.thumb, drag !== null && s.thumbActive, { left: `${shown * 100}%` }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.meta, drag !== null && { color: colors.text }]}>{formatTime(shownSec)}</Text>
        <Text style={type.meta}>-{formatTime(Math.max(0, durationSec - shownSec))}</Text>
      </View>
    </>
  );
}

export default function Player() {
  const now = useNowPlaying();
  const [settings, update] = useSettings();
  const [menu, setMenu] = useState(false);
  const [chapterSheet, setChapterSheet] = useState(false);
  const chapters = playback.chapters();
  const index = chapters.findIndex((c) => c.chapterNumber === now.chapterNumber);
  const hasNext = index >= 0 && index < chapters.length - 1;
  const hasPrevious = index > 0;

  useEffect(() => {
    // Start each session at the listener's preferred speed.
    playback.setSpeed(settings.playbackSpeed);
  }, [settings.playbackSpeed]);
  // The sleep timer runs in playback, so it keeps counting with this screen closed.
  const sleepLeft = useSleepCountdown();
  const [sleepSheet, setSleepSheet] = useState(false);
  const [custom, setCustom] = useState('');
  const customMinutes = Math.round(Number(custom));
  const customValid = Number.isFinite(customMinutes) && customMinutes >= 1 && customMinutes <= SLEEP_MAX_MINUTES;
  const startSleep = (minutes: number) => {
    playback.setSleepTimer(minutes);
    update('sleepTimerMinutes', minutes);
    setCustom('');
    setSleepSheet(false);
  };
  // iOS can't present a second modal while the first is still sliding away.
  const openSleepFromMenu = () => {
    setMenu(false);
    setTimeout(() => setSleepSheet(true), Platform.OS === 'ios' ? 400 : 0);
  };
  const lastCustom = settings.sleepTimerMinutes > 0 && !SLEEP_PRESETS.includes(settings.sleepTimerMinutes) ? settings.sleepTimerMinutes : null;

  const collapse = () => (router.canGoBack() ? router.back() : router.navigate('/Test/library'));
  const nextSpeed = () => playback.setSpeed(SPEEDS[(SPEEDS.indexOf(now.speed) + 1) % SPEEDS.length]);

  // Opened before any book was played (from the tab bar, or a deep link).
  if (!hasTrack(now)) {
    return (
      <Screen scene="neon" variant="hero" style={{ paddingHorizontal: 24 }}>
        <View style={s.top}>
          <Pressable style={s.round} onPress={collapse} accessibilityRole="button" accessibilityLabel="Close player">
            <Ionicons name="chevron-down" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 120 }}>
          <HangingBat size={28} />
          <Text style={[s.chapter, { marginTop: 12 }]}>Nothing playing yet</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.dim }]}>Pick a book from your shelf and it will play here.</Text>
          <Pressable style={[s.pill, { marginTop: 10 }]} onPress={() => router.navigate('/Test/shelf')} accessibilityRole="button">
            <Ionicons name="library-outline" size={14} color={colors.text} />
            <Text style={s.pillText}>Your shelf</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

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
            <Text style={s.speakingText}>{now.isPlaying ? (now.speaker ? `${now.speaker} is speaking` : 'Playing') : 'Paused'}</Text>
          </View>
          {now.error && <Text style={[type.meta, { color: colors.danger, textAlign: 'center' }]}>{now.error}</Text>}
        </View>

        <Scrubber positionSec={now.positionSec} durationSec={now.durationSec} />

        <View style={s.controls}>
          <Pressable style={[s.chapterStep, !chapters.length && s.off]} onPress={playback.previousChapter} disabled={!chapters.length} accessibilityRole="button" accessibilityLabel={hasPrevious ? 'Previous chapter' : 'Start of chapter'}>
            <Ionicons name="play-skip-back" size={20} color="#fff" />
          </Pressable>
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
          <Pressable style={[s.chapterStep, !hasNext && s.off]} onPress={playback.nextChapter} disabled={!hasNext} accessibilityRole="button" accessibilityLabel="Next chapter" accessibilityState={{ disabled: !hasNext }}>
            <Ionicons name="play-skip-forward" size={20} color="#fff" />
          </Pressable>
        </View>

          <View style={s.extras}>
            <Pressable onPress={nextSpeed} style={s.pill} accessibilityRole="button" accessibilityLabel="Playback speed">
              <Text style={s.pillText}>{now.speed}×</Text>
            </Pressable>
            <Pressable onPress={() => setSleepSheet(true)} style={[s.pill, sleepLeft !== null && s.pillOn]} accessibilityRole="button" accessibilityLabel={sleepLeft !== null ? `Sleep timer, ${formatCountdown(sleepLeft)} left` : 'Sleep timer'}>
              <Ionicons name={sleepLeft !== null ? 'moon' : 'moon-outline'} size={14} color={sleepLeft !== null ? '#14102A' : colors.text} />
              <Text style={[s.pillText, sleepLeft !== null && s.countdownText]}>{sleepLeft !== null ? formatCountdown(sleepLeft) : 'Sleep'}</Text>
            </Pressable>
            {chapters.length > 1 && (
              <Pressable onPress={() => setChapterSheet(true)} style={s.pill} accessibilityRole="button" accessibilityLabel="Chapters">
                <Ionicons name="list-outline" size={14} color={colors.text} />
                <Text style={s.pillText}>Chapters</Text>
              </Pressable>
            )}
            <Pressable onPress={() => router.push({ pathname: '/Test/book_details', params: { id: now.bookId, title: now.title, author: now.author } })} style={s.pill} accessibilityRole="button">
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
        <SheetItem icon="moon-outline" label="Sleep timer" detail={sleepLeft !== null ? `${formatCountdown(sleepLeft)} left` : 'Off'} onPress={openSleepFromMenu} />
        <SheetItem icon="book-outline" label="Book details & cast" onPress={() => { setMenu(false); router.push({ pathname: '/Test/book_details', params: { id: now.bookId, title: now.title, author: now.author } }); }} />
        <SheetItem icon="options-outline" label="Playback settings" detail="Speed, skip, autoplay" onPress={() => { setMenu(false); router.push('/Test/playback-settings'); }} />
      </Sheet>

      <Sheet visible={chapterSheet} onClose={() => setChapterSheet(false)} title="Chapters">
        {chapters.map((c) => {
          const current = c.chapterNumber === now.chapterNumber;
          return (
            <SheetItem
              key={c.chapterId ?? c.chapterNumber}
              icon={current ? 'volume-high' : 'play-circle-outline'}
              label={`${c.chapterNumber}. ${c.chapter}`}
              detail={current ? 'Playing' : c.durationSec ? formatTime(c.durationSec) : undefined}
              onPress={() => { setChapterSheet(false); playback.playChapter(c.chapterNumber); }}
            />
          );
        })}
      </Sheet>

      <Sheet visible={sleepSheet} onClose={() => setSleepSheet(false)} title="Sleep timer">
        {sleepLeft !== null && (
          <View style={s.sleepNow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetLabel}>PAUSING IN</Text>
              <Text style={s.sleepClock} accessibilityLiveRegion="polite">{formatCountdown(sleepLeft)}</Text>
            </View>
            <Pressable onPress={() => playback.extendSleepTimer(5)} style={s.pill} accessibilityRole="button" accessibilityLabel="Add five minutes">
              <Text style={s.pillText}>+5 min</Text>
            </Pressable>
            <Pressable onPress={() => { playback.setSleepTimer(0); setSleepSheet(false); }} style={s.pill} accessibilityRole="button">
              <Text style={[s.pillText, { color: colors.danger }]}>Turn off</Text>
            </Pressable>
          </View>
        )}
        <Text style={s.sheetLabel}>{sleepLeft !== null ? 'START OVER WITH' : 'PAUSE AFTER'}</Text>
        <View style={s.sleepGrid}>
          {[...SLEEP_PRESETS, ...(lastCustom ? [lastCustom] : [])].map((m) => (
            <Pressable key={m} onPress={() => startSleep(m)} style={[s.sleepChip, settings.sleepTimerMinutes === m && sleepLeft !== null && s.pillOn]} accessibilityRole="button">
              <Text style={[s.pillText, settings.sleepTimerMinutes === m && sleepLeft !== null && { color: '#14102A' }]}>{m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.sheetLabel, { marginTop: 14 }]}>CUSTOM</Text>
        <View style={s.customRow}>
          <TextInput value={custom} onChangeText={(t) => setCustom(t.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="Minutes" placeholderTextColor={colors.faint} keyboardType="number-pad" returnKeyType="done" maxLength={3} style={s.customInput} onSubmitEditing={() => customValid && startSleep(customMinutes)} accessibilityLabel="Custom sleep timer minutes" />
          <Pressable onPress={() => customValid && startSleep(customMinutes)} disabled={!customValid} style={[s.customStart, !customValid && { opacity: 0.4 }]} accessibilityRole="button">
            <Text style={[s.pillText, { color: '#14102A' }]}>Start</Text>
          </Pressable>
        </View>
        <Text style={[type.meta, { marginTop: 8 }]}>Anything from 1 minute to 12 hours. The timer keeps running when you leave the player.</Text>
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
  scrub: { marginTop: 24, height: 32, justifyContent: 'center' },
  thumb: { position: 'absolute', top: 9, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.pink },
  thumbActive: { top: 6, width: 20, height: 20, marginLeft: -10, borderRadius: 10 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 22 },
  chapterStep: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  off: { opacity: 0.35 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: neon.accent, borderColor: neon.accent },
  pillText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  sheetLabel: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2, color: colors.dim, marginBottom: 10 },
  speeds: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  countdownText: { color: '#14102A', fontVariant: ['tabular-nums'], minWidth: 34 },
  sleepNow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, marginBottom: 16, borderRadius: 12, backgroundColor: 'rgba(98,230,240,0.08)', borderWidth: 1, borderColor: 'rgba(98,230,240,0.3)' },
  sleepClock: { fontFamily: fonts.sansBold, fontSize: 30, color: colors.text, fontVariant: ['tabular-nums'], marginTop: -4 },
  sleepGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sleepChip: { width: '23%', flexGrow: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1, height: 44, borderRadius: 10, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.sansBold, fontSize: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, outlineStyle: 'none' } as object,
  customStart: { height: 44, paddingHorizontal: 20, borderRadius: 10, backgroundColor: neon.accent, alignItems: 'center', justifyContent: 'center' },
  speedChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
});
