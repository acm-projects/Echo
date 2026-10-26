import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Screen } from './components/Screen';
import { GradientButton } from './components/GradientButton';
import { colors, fonts, type } from '../../theme';
import { createNarrator, getNarrators, narratorPreviewUri, selectNarrator, type NarratorState, type NarratorVoice } from '../data/narrators';

const PROMPT_IDEAS = [
  { label: 'Warm storyteller', description: 'A warm, unhurried adult female narrator in her forties with a soft, rounded timbre, gentle smile in the voice, and a neutral American accent.' },
  { label: 'Deep & gravelly', description: 'A deep, gravelly adult male narrator in his sixties with a slow, deliberate pace, rich low resonance, and a slight British accent.' },
  { label: 'Bright & lively', description: 'A bright, energetic young adult narrator in their twenties with a clear mid-high pitch, quick pacing, and an expressive, playful delivery.' },
];

export default function NarratorVoices() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [state, setState] = useState<NarratorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sampleText, setSampleText] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    getNarrators()
      .then((next) => { if (active) { setState(next); setError(null); } })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Could not reach the voice server.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      // On unmount the player may already be released; pausing it then throws on native.
      try { player.pause(); } catch {}
    };
  }, [player]));

  const play = (voice: NarratorVoice) => {
    if (playingId === voice.id && status.playing) {
      player.pause();
      return;
    }
    if (playingId !== voice.id || status.didJustFinish) {
      player.replace({ uri: narratorPreviewUri(voice) });
    }
    player.play();
    setPlayingId(voice.id);
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const next = await createNarrator({ name: name.trim() || 'Narrator', description, sampleText: sampleText.trim() || undefined });
      setState(next);
      setName('');
      setDescription('');
      setSampleText('');
      play(next.voice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Narrator creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const choose = async (voice: NarratorVoice) => {
    if (state?.selectedId === voice.id) return;
    setError(null);
    try {
      setState(await selectNarrator(voice.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not select this voice.');
    }
  };

  const remaining = state?.remainingToday ?? 0;
  const limitReached = state !== null && remaining === 0;
  const canCreate = !creating && !limitReached && description.trim().length >= 20;

  return (
    <Screen>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Pressable testID="narrator-back" style={s.iconButton} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/Test/upload'))} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          {state && (
            <View style={s.quota}>
              <View style={s.quotaDots}>
                {Array.from({ length: state.dailyLimit }, (_, i) => (
                  <View key={i} style={[s.quotaDot, i < state.usedToday && s.quotaDotUsed]} />
                ))}
              </View>
              <Text style={s.quotaText}>{remaining} left today</Text>
            </View>
          )}
        </View>

        <Text style={type.h1}>Narrator Voices</Text>
        <Text style={s.subtitle}>Describe a voice, hear it read a passage, and choose who narrates your books.</Text>

        <View style={s.card}>
          <Text style={s.label}>NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Evening Storyteller" placeholderTextColor={colors.faint} style={s.input} maxLength={40} />

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

          <GradientButton
            title={creating ? 'DESIGNING VOICE...' : limitReached ? 'DAILY LIMIT REACHED' : 'CREATE VOICE'}
            icon={creating ? undefined : 'mic-outline'}
            onPress={canCreate ? create : undefined}
            style={[s.createButton, !canCreate && s.disabled]}
          />
          {creating && (
            <View style={s.status}>
              <ActivityIndicator color={colors.gold} />
              <Text style={type.meta}>Gemini is designing the voice. This takes about 20–40 seconds.</Text>
            </View>
          )}
          {limitReached && <Text style={s.hint}>You've created {state.dailyLimit} voices today. New creations unlock at midnight.</Text>}
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
          <ActivityIndicator color={colors.gold} style={s.loading} />
        ) : state?.voices.length ? (
          <View style={s.voices}>
            {state.voices.map((voice) => {
              const selected = state.selectedId === voice.id;
              const playing = playingId === voice.id && status.playing;
              return (
                <Pressable key={voice.id} testID={`narrator-row-${voice.id}`} style={[s.voiceRow, selected && s.voiceRowSelected]} onPress={() => choose(voice)}>
                  <Pressable testID={`narrator-play-${voice.id}`} style={[s.playButton, playing && s.playButtonActive]} onPress={() => play(voice)} hitSlop={6}>
                    <Ionicons name={playing ? 'pause' : 'play'} size={20} color={colors.text} style={playing ? undefined : s.playIcon} />
                  </Pressable>
                  <View style={s.voiceInfo}>
                    <Text style={s.voiceName} numberOfLines={1}>{voice.name}</Text>
                    <Text style={s.voiceDescription} numberOfLines={2}>{voice.description}</Text>
                    <Text style={s.voiceDate}>{new Date(voice.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
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
              );
            })}
          </View>
        ) : (
          <View style={s.empty}>
            <Ionicons name="mic-circle-outline" size={40} color={colors.faint} />
            <Text style={s.emptyText}>No narrator voices yet. Create one above and it will narrate your next book.</Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle: { ...type.body, marginTop: 5, marginBottom: 22, lineHeight: 20 },
  card: { padding: 18, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { ...type.meta, letterSpacing: 1.2, marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.18)', color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.sans, fontSize: 15 },
  textArea: { minHeight: 104, textAlignVertical: 'top' },
  textAreaShort: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 30, borderRadius: 15, backgroundColor: 'rgba(155,107,214,0.14)', borderWidth: 1, borderColor: 'rgba(155,107,214,0.35)' },
  chipText: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.text },
  createButton: { marginTop: 20 },
  disabled: { opacity: 0.45 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  hint: { ...type.meta, color: colors.dim, marginTop: 12, textAlign: 'center' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(224,102,122,0.12)', borderWidth: 1, borderColor: 'rgba(224,102,122,0.35)' },
  errorText: { ...type.body, flex: 1, color: colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 21, color: colors.text },
  loading: { marginTop: 24 },
  voices: { gap: 10 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  voiceRowSelected: { borderColor: colors.gold, backgroundColor: 'rgba(245,198,90,0.08)' },
  playButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(214,123,176,0.2)', borderWidth: 1, borderColor: 'rgba(214,123,176,0.45)' },
  playButtonActive: { backgroundColor: colors.pink },
  playIcon: { marginLeft: 3 },
  voiceInfo: { flex: 1, marginHorizontal: 12 },
  voiceName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
  voiceDescription: { ...type.meta, color: colors.dim, marginTop: 3, lineHeight: 16 },
  voiceDate: { ...type.meta, fontSize: 10, marginTop: 4 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: colors.gold },
  selectedText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.bg },
  useText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.blue, paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyText: { ...type.body, textAlign: 'center' },
});
