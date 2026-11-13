import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Sheet } from './Sheet';
import { colors, fonts, type } from '../../theme';
import { getNarrators, narratorPreviewUrl, setBookCast, type CastChoice, type CastMember, type NarratorVoice } from '../data/narrators';
import { mediaUrl } from '../data/voiceServer';

// Every character gets their own colour, the same ones Book Details uses, so the cast reads the same everywhere.
const CAST_COLORS = ['#FF9A7A', '#62E6F0', '#FFB45E', '#B79CFF', '#7CF2B8', '#FF6FD0', '#9CC2FF'];

type Props = {
  visible: boolean;
  bookId: string;
  title: string;
  cast: CastMember[];
  // review: the voices are made and narration waits for a go-ahead. edit: the book is narrated; changing a voice
  // narrates the chapters it speaks in again.
  mode: 'review' | 'edit';
  onClose: () => void;
  // The choices were sent and narration (re)started.
  onDone: () => void;
  // Leave for the Voice Studio to make a new voice; the caller closes the sheet first, and reopens it on return.
  onOpenStudio: () => void;
};

/**
 * The cast of a book with the voice each one is read with: hear each voice, give a character one of the reader's
 * studio voices instead (or the voice designed for them), and start or restart narration.
 */
export function CastSheet({ visible, bookId, title, cast, mode, onClose, onDone, onOpenStudio }: Props) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [voices, setVoices] = useState<NarratorVoice[]>([]);
  const [choices, setChoices] = useState<Record<string, CastChoice>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The studio voices are fetched each time the sheet opens, so one made in the Studio a moment ago is listed.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    getNarrators().then((state) => { if (active) setVoices(state.voices); }).catch(() => {});
    return () => { active = false; };
  }, [visible]);

  const stop = useCallback(() => {
    try { player.pause(); } catch {}
    setPlaying(null);
  }, [player]);

  const close = () => {
    stop();
    onClose();
  };

  // What a member will be read with once the pending choices apply.
  const voiceFor = (member: CastMember) => {
    const choice = choices[member.name];
    if (choice && 'narratorId' in choice) {
      const voice = voices.find((item) => item.id === choice.narratorId);
      return { label: voice ? `Read by ${voice.name}` : 'Read by your voice', samplePath: voice?.previewPath, changed: true };
    }
    if (choice && 'designed' in choice) return { label: member.voiceDescription, samplePath: undefined, changed: true, designed: true };
    if (member.source === 'narrator') return { label: member.name === 'Narrator' ? `Read by ${member.narratorName ?? 'your narrator'}` : `Read by ${member.narratorName ?? 'your narrator'} (no voice of their own)`, samplePath: member.samplePath, changed: false };
    return { label: member.voiceDescription, samplePath: member.samplePath, changed: false };
  };

  const play = async (member: CastMember) => {
    const key = member.name;
    if (playing === key && status.playing) return stop();
    const { samplePath, designed } = voiceFor(member);
    // Going back to a designed voice plays the sample made for them (the server keeps it with the book).
    const path = designed ? member.samplePath : samplePath;
    if (!path) return;
    try {
      const uri = await mediaUrl(path);
      if (!uri) return;
      player.replace({ uri });
      player.play();
      setPlaying(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not play that voice.');
    }
  };

  const choose = (member: CastMember, choice: CastChoice | null) => {
    stop();
    setChoices((previous) => {
      const next = { ...previous };
      if (choice) next[member.name] = choice;
      else delete next[member.name];
      return next;
    });
    setOpen(null);
  };

  const changedCount = Object.keys(choices).length;
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      stop();
      await setBookCast(bookId, { voices: choices, start: mode === 'review' });
      setChoices({});
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The voice server didn’t respond.');
    } finally {
      setBusy(false);
    }
  };

  const members = [...cast].sort((a, b) => (a.name === 'Narrator' ? -1 : b.name === 'Narrator' ? 1 : 0));

  return (
    <Sheet visible={visible} onClose={close} title={mode === 'review' ? 'Meet the cast' : 'The voices'}>
      <Text style={s.intro}>
        {mode === 'review'
          ? `The voices for ${title} are ready. Listen to each one, swap any for a voice from your studio, then start narrating.`
          : 'Give any part a different voice. The chapters it speaks in are narrated again.'}
      </Text>

      <View style={s.list}>
        {members.map((member, index) => {
          const color = member.name === 'Narrator' ? colors.gold : CAST_COLORS[index % CAST_COLORS.length];
          const current = voiceFor(member);
          const isPlaying = playing === member.name && status.playing;
          const expanded = open === member.name;
          return (
            <View key={member.name} style={[s.member, current.changed && { borderColor: `${color}88` }]}>
              <View style={s.row}>
                <Pressable style={[s.play, { borderColor: `${color}66` }, isPlaying && { backgroundColor: `${color}33` }]} onPress={() => play(member)} hitSlop={6} accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${member.name}`}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={color} style={isPlaying ? undefined : { marginLeft: 2 }} />
                </Pressable>
                <Pressable style={s.info} onPress={() => setOpen(expanded ? null : member.name)} accessibilityRole="button" accessibilityLabel={`Change the voice for ${member.name}`}>
                  <View style={s.nameRow}>
                    <Text style={s.name} numberOfLines={1}>{member.name}</Text>
                    {current.changed && <Text style={[s.changed, { color }]}>Changed</Text>}
                  </View>
                  <Text style={s.voice} numberOfLines={2}>{current.label}</Text>
                </Pressable>
                <Ionicons name={expanded ? 'chevron-up' : 'swap-horizontal-outline'} size={18} color={colors.dim} />
              </View>

              {expanded && (
                <View style={s.options}>
                  {member.hasDesigned && member.name !== 'Narrator' && (
                    <Option
                      label="The voice designed for them"
                      detail={member.voiceDescription}
                      selected={(choices[member.name] && 'designed' in choices[member.name]) || (!choices[member.name] && member.source === 'designed')}
                      onPress={() => choose(member, member.source === 'designed' ? null : { designed: true })}
                    />
                  )}
                  {voices.map((voice) => {
                    const chosen = choices[member.name];
                    const selected = chosen ? 'narratorId' in chosen && chosen.narratorId === voice.id : member.narratorId === voice.id;
                    return (
                      <Option
                        key={voice.id}
                        label={voice.name}
                        detail={voice.kind === 'uploaded' ? 'Cloned from your recording' : voice.description}
                        selected={selected}
                        onPress={() => choose(member, member.narratorId === voice.id ? null : { narratorId: voice.id })}
                      />
                    );
                  })}
                  <Pressable style={s.studio} onPress={() => { stop(); onOpenStudio(); }} accessibilityRole="button">
                    <Ionicons name="add-circle-outline" size={18} color={colors.blue} />
                    <Text style={s.studioText}>{voices.length ? 'Make a new voice in the Studio' : 'You have no voices yet. Make one in the Studio'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {error && (
        <View style={s.error}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[s.primary, (busy || (mode === 'edit' && !changedCount)) && s.disabled]}
        onPress={submit}
        disabled={busy || (mode === 'edit' && !changedCount)}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#18131E" /> : <Ionicons name={mode === 'review' ? 'mic' : 'sync'} size={18} color="#18131E" />}
        <Text style={s.primaryText}>
          {mode === 'review' ? (changedCount ? `Start narrating with ${changedCount} ${changedCount === 1 ? 'change' : 'changes'}` : 'Start narrating') : changedCount ? `Re-narrate with ${changedCount} ${changedCount === 1 ? 'change' : 'changes'}` : 'Change a voice to re-narrate'}
        </Text>
      </Pressable>
      {mode === 'review' && <Text style={s.note}>You can change voices later from the book’s menu.</Text>}
    </Sheet>
  );
}

function Option({ label, detail, selected, onPress }: { label: string; detail: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.option, selected && s.optionSelected]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? colors.gold : colors.dim} />
      <View style={{ flex: 1 }}>
        <Text style={s.optionLabel}>{label}</Text>
        <Text style={s.optionDetail} numberOfLines={2}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  intro: { ...type.body, lineHeight: 20, marginBottom: 14 },
  list: { gap: 8 },
  member: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text, flexShrink: 1 },
  changed: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.5 },
  voice: { ...type.meta, color: colors.dim, marginTop: 2, lineHeight: 16 },
  options: { marginTop: 10, gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  optionSelected: { borderColor: 'rgba(245,198,90,0.45)', backgroundColor: 'rgba(245,198,90,0.08)' },
  optionLabel: { fontFamily: fonts.sansMd, fontSize: 14, color: colors.text },
  optionDetail: { ...type.meta, color: colors.dim, marginTop: 1 },
  studio: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  studioText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.blue },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(224,102,122,0.12)', borderWidth: 1, borderColor: 'rgba(224,102,122,0.35)' },
  errorText: { ...type.body, flex: 1, color: colors.text },
  primary: { marginTop: 16, height: 50, borderRadius: 25, backgroundColor: colors.gold, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#18131E' },
  disabled: { opacity: 0.5 },
  note: { ...type.meta, textAlign: 'center', marginTop: 10, color: colors.dim },
});
