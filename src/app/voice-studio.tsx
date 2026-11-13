import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';

import { Screen } from '../components/Screen';
import { Sheet, SheetItem } from '../components/Sheet';
import { ClientOnly } from '../../lib/ClientOnly';
import { CityLoader } from '../components/CityLoader';
import { colors, fonts, type } from '../../theme';
import { createNarrator, deleteNarrator, getNarrators, narratorPreviewUrl, selectNarrator, uploadNarrator, type NarratorState, type NarratorVoice } from '../data/narrators';

const PROMPT_IDEAS = [
  { label: 'Warm storyteller', description: 'A warm, unhurried adult female narrator in her forties with a soft, rounded timbre, gentle smile in the voice, and a neutral American accent.' },
  { label: 'Deep & gravelly', description: 'A deep, gravelly adult male narrator in his sixties with a slow, deliberate pace, rich low resonance, and a slight British accent.' },
  { label: 'Bright & lively', description: 'A bright, energetic young adult narrator in their twenties with a clear mid-high pitch, quick pacing, and an expressive, playful delivery.' },
];

// Uploaded voices are checked every few seconds until the model has read the sample line with them.
const PREVIEW_POLL_MS = 5000;

export default function VoiceStudioRoute() {
  return <ClientOnly><VoiceStudio /></ClientOnly>;
}

// Where a voice is used, in words: "Narrator in The Night Ferry · Ada in Signal".
function usageLine(voice: NarratorVoice) {
  if (!voice.usedIn.length) return 'Not used in any book yet';
  return voice.usedIn.map((book) => `${book.as.join(', ')} in ${book.title}`).join(' · ');
}

function VoiceStudio() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [state, setState] = useState<NarratorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'describe' | 'upload'>('describe');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [recording, setRecording] = useState<DocumentPickerAsset | null>(null);
  const [consent, setConsent] = useState(false);
  const [removing, setRemoving] = useState<NarratorVoice | null>(null);

  const refresh = useCallback(async () => {
    const next = await getNarrators();
    setState(next);
    setError(null);
    return next;
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const next = await getNarrators();
        if (!active) return;
        setState(next);
        setError(null);
        if (next.voices.some((voice) => voice.previewPending)) timer = setTimeout(poll, PREVIEW_POLL_MS);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not reach the voice server.');
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      // On unmount the player may already be released; pausing it then throws on native.
      try { player.pause(); } catch {}
    };
  }, [player]));

  const play = async (voice: NarratorVoice) => {
    if (playingId === voice.id && status.playing) {
      player.pause();
      return;
    }
    if (playingId !== voice.id || status.didJustFinish) {
      try {
        const uri = await narratorPreviewUrl(voice);
        if (!uri) return;
        player.replace({ uri });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not play that voice.');
        return;
      }
    }
    player.play();
    setPlayingId(voice.id);
  };

  const design = async () => {
    if (working) return;
    setWorking('design');
    setError(null);
    try {
      const next = await createNarrator({ name: name.trim() || 'Narrator', description, sampleText: sampleText.trim() || undefined });
      setState(next);
      setName('');
      setDescription('');
      setSampleText('');
      void play(next.voice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The voice could not be designed.');
    } finally {
      setWorking(null);
    }
  };

  const pickRecording = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/octet-stream'], copyToCacheDirectory: true });
    if (!result.canceled) setRecording(result.assets[0]);
  };

  const upload = async () => {
    if (working || !recording) return;
    setWorking('upload');
    setError(null);
    try {
      const next = await uploadNarrator({ name: name.trim() || 'My voice', file: recording, consent });
      setState(next);
      setName('');
      setRecording(null);
      setConsent(false);
      void play(next.voice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The recording could not be used.');
    } finally {
      setWorking(null);
    }
  };

  // Selecting is shown at once and saved in the background, so switching voices never waits on the server. Only the
  // newest tap's reply is kept, and a failed save puts the previous selection back.
  const selectionRef = useRef(0);
  const choose = (voice: NarratorVoice) => {
    if (!state || state.selectedId === voice.id) return;
    const previous = state.selectedId;
    const attempt = ++selectionRef.current;
    setError(null);
    setState((current) => current && { ...current, selectedId: voice.id });
    selectNarrator(voice.id)
      .then((next) => { if (selectionRef.current === attempt) setState(next); })
      .catch((err) => {
        if (selectionRef.current !== attempt) return;
        setState((current) => current && { ...current, selectedId: previous });
        setError(err instanceof Error ? err.message : 'Could not select this voice.');
      });
  };

  const remove = async (voice: NarratorVoice) => {
    setRemoving(null);
    setError(null);
    try {
      if (playingId === voice.id) player.pause();
      setState(await deleteNarrator(voice.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this voice.');
    }
  };

  const remaining = state?.remainingToday ?? 0;
  const designLimit = state !== null && remaining === 0;
  const uploadLimit = state !== null && state.uploadsRemainingToday === 0;
  const canDesign = !working && !designLimit && description.trim().length >= 20;
  const canUpload = !working && !uploadLimit && recording !== null && consent;

  return (
    <Screen interior="studio">
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable testID="narrator-back" style={s.iconButton} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/Test/upload'))} hitSlop={8} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          {state && tab === 'describe' && (
            <View style={s.quota}>
              <View style={s.quotaDots}>
                {Array.from({ length: state.dailyLimit }, (_, i) => (
                  <View key={i} style={[s.quotaDot, i < state.usedToday && s.quotaDotUsed]} />
                ))}
              </View>
              <Text style={s.quotaText}>{remaining} left today</Text>
            </View>
          )}
          {state && tab === 'upload' && <Text style={s.quotaText}>{state.uploadsRemainingToday} uploads left today</Text>}
        </View>

        <Text style={type.h1}>Voice Studio</Text>
        <Text style={s.subtitle}>Make voices from a description or from a recording. Choose who narrates your books, and give any character a voice from here.</Text>

        <View style={s.tabs}>
          {([['describe', 'Describe a voice', 'sparkles-outline'], ['upload', 'Upload a recording', 'cloud-upload-outline']] as const).map(([id, label, icon]) => (
            <Pressable key={id} style={[s.tab, tab === id && s.tabOn]} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
              <Ionicons name={icon} size={15} color={tab === id ? colors.text : colors.dim} />
              <Text style={[s.tabText, tab === id && { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.label}>NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder={tab === 'describe' ? 'e.g. Evening Storyteller' : 'e.g. Dad reading'} placeholderTextColor={colors.faint} style={s.input} maxLength={40} />

          {tab === 'describe' ? (
            <>
              <Text style={s.label}>DESCRIBE THE VOICE</Text>
              <TextInput
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Gender, adult age, pitch, texture, pace, accent..."
                placeholderTextColor={colors.faint}
                style={[s.input, s.textArea]}
                maxLength={400}
              />
              <View style={s.chips}>
                {PROMPT_IDEAS.map((idea) => (
                  <Pressable key={idea.label} style={s.chip} onPress={() => setDescription(idea.description)}>
                    <Ionicons name="sparkles-outline" size={13} color={colors.lilac} />
                    <Text style={s.chipText}>{idea.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.label}>PREVIEW LINE (OPTIONAL)</Text>
              <TextInput
                multiline
                value={sampleText}
                onChangeText={setSampleText}
                placeholder="The room beneath the stars was silent..."
                placeholderTextColor={colors.faint}
                style={[s.input, s.textAreaShort]}
                maxLength={500}
              />

              <Pressable style={[s.button, !canDesign && s.disabled]} onPress={design} disabled={!canDesign} accessibilityRole="button">
                {working === 'design' ? <ActivityIndicator color="#18131E" /> : <Ionicons name="mic-outline" size={18} color="#18131E" />}
                <Text style={s.buttonText}>{working === 'design' ? 'Designing the voice' : designLimit ? 'Daily limit reached' : 'Design voice'}</Text>
              </Pressable>
              {working === 'design' && <Text style={s.hint}>Gemini is designing the voice. This takes about 20–40 seconds.</Text>}
              {designLimit && <Text style={s.hint}>You've designed {state.dailyLimit} voices today. New ones unlock at midnight.</Text>}
            </>
          ) : (
            <>
              <Text style={s.label}>RECORDING</Text>
              <Pressable style={s.filePick} onPress={pickRecording} accessibilityRole="button">
                <Ionicons name={recording ? 'musical-notes-outline' : 'folder-open-outline'} size={20} color={colors.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={s.fileName} numberOfLines={1}>{recording?.name ?? 'Choose an audio file'}</Text>
                  <Text style={type.meta}>WAV, MP3, M4A or OGG · a clear voice, 10 seconds or more, no music</Text>
                </View>
              </Pressable>
              <Text style={s.hint}>The first 20 seconds are kept. The voice reads your books exactly as it sounds in the recording, so a calm, steady read works best.</Text>

              <Pressable style={s.consent} onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={consent ? colors.gold : colors.dim} />
                <Text style={s.consentText}>This is my own voice, or the person speaking has agreed to it being cloned for my audiobooks.</Text>
              </Pressable>

              <Pressable style={[s.button, !canUpload && s.disabled]} onPress={upload} disabled={!canUpload} accessibilityRole="button">
                {working === 'upload' ? <ActivityIndicator color="#18131E" /> : <Ionicons name="cloud-upload-outline" size={18} color="#18131E" />}
                <Text style={s.buttonText}>{working === 'upload' ? 'Uploading' : uploadLimit ? 'Daily limit reached' : 'Clone voice'}</Text>
              </Pressable>
              {working === 'upload' && <Text style={s.hint}>Preparing the recording. The preview reads a sample line in the new voice a minute or so later.</Text>}
            </>
          )}
        </View>

        {error && (
          <View style={s.error}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Your voices</Text>
          {state && <Text style={type.meta}>{state.voices.length} saved</Text>}
        </View>

        {loading && !state ? (
          <CityLoader scene="neon" label="Warming up the voices…" />
        ) : state?.voices.length ? (
          <View style={s.voices}>
            {state.voices.map((voice) => {
              const selected = state.selectedId === voice.id;
              const playing = playingId === voice.id && status.playing;
              const unused = voice.usedIn.length === 0;
              return (
                // Play, choose and remove are sibling buttons; nesting them would put a <button> inside a <button> on web.
                <View key={voice.id} style={[s.voiceRow, selected && s.voiceRowSelected]}>
                  <View style={s.voiceTop}>
                    <Pressable testID={`narrator-play-${voice.id}`} style={[s.playButton, playing && s.playButtonActive]} onPress={() => play(voice)} hitSlop={6} accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${voice.name}`}>
                      <Ionicons name={playing ? 'pause' : 'play'} size={20} color={colors.text} style={playing ? undefined : s.playIcon} />
                    </Pressable>
                    <Pressable testID={`narrator-row-${voice.id}`} style={s.voiceChoose} onPress={() => choose(voice)} accessibilityRole="button" accessibilityLabel={selected ? `${voice.name} narrates your books` : `Narrate with ${voice.name}`}>
                      <View style={s.voiceInfo}>
                        <View style={s.nameRow}>
                          <Text style={s.voiceName} numberOfLines={1}>{voice.name}</Text>
                          <View style={[s.kind, voice.kind === 'uploaded' && s.kindUploaded]}>
                            <Text style={s.kindText}>{voice.previewPending ? 'Preparing' : voice.kind === 'uploaded' ? 'Recording' : 'Designed'}</Text>
                          </View>
                        </View>
                        <Text style={s.voiceDescription} numberOfLines={2}>{voice.description}</Text>
                      </View>
                      {selected ? (
                        <View style={s.selectedBadge}>
                          <Ionicons name="checkmark" size={14} color={colors.bg} />
                          <Text style={s.selectedText}>Narrator</Text>
                        </View>
                      ) : (
                        <Text style={s.useText}>Use</Text>
                      )}
                    </Pressable>
                  </View>
                  <View style={s.voiceBottom}>
                    <Ionicons name={unused ? 'ellipse-outline' : 'book-outline'} size={13} color={unused ? colors.faint : colors.blue} />
                    <Text style={[s.usage, !unused && { color: colors.text }]} numberOfLines={2}>{usageLine(voice)}</Text>
                    {unused && !voice.previewPending && (
                      <Pressable onPress={() => setRemoving(voice)} hitSlop={8} accessibilityLabel={`Remove ${voice.name}`}>
                        <Ionicons name="trash-outline" size={16} color={colors.dim} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.empty}>
            <Ionicons name="mic-circle-outline" size={40} color={colors.faint} />
            <Text style={s.emptyText}>No voices yet. Design one or upload a recording, and it will narrate your next book.</Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={removing !== null} onClose={() => setRemoving(null)} title={removing ? `Remove ${removing.name}?` : undefined}>
        <Text style={[type.body, { marginBottom: 8 }]}>No book uses this voice. Its recording and preview are deleted for good.</Text>
        <SheetItem icon="trash-outline" label="Remove the voice" danger onPress={() => removing && remove(removing)} />
        <SheetItem icon="close-outline" label="Keep it" onPress={() => setRemoving(null)} />
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  quota: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  quotaDots: { flexDirection: 'row', gap: 4 },
  quotaDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.gold },
  quotaDotUsed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  quotaText: { ...type.meta, color: colors.dim },
  subtitle: { ...type.body, marginTop: 5, marginBottom: 18, lineHeight: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.18)' },
  tabOn: { backgroundColor: colors.card, borderColor: 'rgba(245,198,90,0.5)' },
  tabText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.dim },
  card: { padding: 18, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { ...type.meta, letterSpacing: 1.2, marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.18)', color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.sans, fontSize: 15 },
  textArea: { minHeight: 104, textAlignVertical: 'top' },
  textAreaShort: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, borderRadius: 15, backgroundColor: 'rgba(155,107,214,0.14)', borderWidth: 1, borderColor: 'rgba(155,107,214,0.35)' },
  chipText: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.text },
  filePick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(127,168,230,0.45)', backgroundColor: 'rgba(0,0,0,0.18)' },
  fileName: { fontFamily: fonts.sansMd, fontSize: 15, color: colors.text, marginBottom: 2 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  consentText: { ...type.body, flex: 1, lineHeight: 20 },
  button: { marginTop: 20, height: 50, borderRadius: 25, backgroundColor: colors.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#18131E' },
  disabled: { opacity: 0.45 },
  hint: { ...type.meta, color: colors.dim, marginTop: 12, lineHeight: 17 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: 'rgba(224,102,122,0.12)', borderWidth: 1, borderColor: 'rgba(224,102,122,0.35)' },
  errorText: { ...type.body, flex: 1, color: colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 21, color: colors.text },
  voices: { gap: 10 },
  voiceRow: { padding: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  voiceRowSelected: { borderColor: colors.gold, backgroundColor: 'rgba(245,198,90,0.08)' },
  voiceTop: { flexDirection: 'row', alignItems: 'center' },
  voiceBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  usage: { ...type.meta, flex: 1, color: colors.dim },
  playButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(214,123,176,0.2)', borderWidth: 1, borderColor: 'rgba(214,123,176,0.45)' },
  playButtonActive: { backgroundColor: colors.pink },
  playIcon: { marginLeft: 3 },
  voiceChoose: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  voiceInfo: { flex: 1, marginHorizontal: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text, flexShrink: 1 },
  kind: { paddingHorizontal: 7, height: 18, borderRadius: 4, backgroundColor: 'rgba(155,107,214,0.2)', justifyContent: 'center' },
  kindUploaded: { backgroundColor: 'rgba(127,168,230,0.2)' },
  kindText: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 0.4, color: colors.text },
  voiceDescription: { ...type.meta, color: colors.dim, marginTop: 3, lineHeight: 16 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: colors.gold },
  selectedText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.bg },
  useText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.blue, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyText: { ...type.body, textAlign: 'center' },
});
