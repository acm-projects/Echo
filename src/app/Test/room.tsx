import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Reveal } from '../../components/Reveal';
import { Burst } from '../../components/Burst';
import { colors, fonts, type } from '../../../theme';
import { getRoomDiscussion, type RoomPost } from '../../data/rooms';

export default function Room() {
  const params = useLocalSearchParams<{ id?: string; title?: string; accent?: string; readers?: string }>();
  const id = params.id ?? 'room';
  const accent = params.accent ?? '#563B68';
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [pops, setPops] = useState<Record<string, number>>({});
  const [joined, setJoined] = useState(false);
  const [draft, setDraft] = useState('');
  const [spoiler, setSpoiler] = useState(false);

  useEffect(() => {
    getRoomDiscussion(id).then(setPosts);
  }, [id]);

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  // Posting stays on this device until community tables exist on the server.
  const post = () => {
    const body = draft.trim();
    if (!body) return;
    setPosts([{ id: `me-${Date.now()}`, author: 'You', chapter: posts[0]?.chapter ?? 1, body, spoiler, likes: 0, ago: 'now' }, ...posts]);
    setDraft('');
    setSpoiler(false);
    setJoined(true);
  };

  return (
    <Screen interior="cafe">
      <PageHeader title={params.title ?? 'Book room'} eyebrow="BOOK ROOM" fallback="/Test/community" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Reveal>
            <View style={[s.banner, { backgroundColor: accent }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.bannerMeta}>{params.readers ?? 'Readers listening now'}</Text>
                <Text style={s.bannerText}>Talk through the story with people at the same chapter. Spoilers stay hidden until you tap them.</Text>
              </View>
              <Pressable onPress={() => setJoined(!joined)} style={[s.join, joined && s.joined]} accessibilityRole="button" accessibilityState={{ selected: joined }}>
                <Ionicons name={joined ? 'checkmark' : 'add'} size={16} color={joined ? colors.text : '#29123C'} />
                <Text style={[s.joinText, joined && { color: colors.text }]}>{joined ? 'Joined' : 'Join'}</Text>
              </Pressable>
            </View>
          </Reveal>

          <Reveal index={1}>
            <View style={s.composer}>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Share a thought about this chapter…" placeholderTextColor={colors.faint} multiline style={s.input} />
              <View style={s.composerRow}>
                <Pressable onPress={() => setSpoiler(!spoiler)} style={s.spoilerToggle} accessibilityRole="checkbox" accessibilityState={{ checked: spoiler }}>
                  <Ionicons name={spoiler ? 'eye-off' : 'eye-off-outline'} size={16} color={spoiler ? colors.pink : colors.dim} />
                  <Text style={[type.meta, spoiler && { color: colors.pink }]}>Contains spoilers</Text>
                </Pressable>
                <Pressable onPress={post} disabled={!draft.trim()} style={[s.send, !draft.trim() && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Post">
                  <Ionicons name="arrow-up" size={18} color="#29123C" />
                </Pressable>
              </View>
            </View>
          </Reveal>

          {posts.map((p, i) => {
            const hidden = p.spoiler && !revealed.has(p.id);
            const isLiked = liked.has(p.id);
            return (
              <Reveal key={p.id} index={i + 2}>
                <View style={s.post}>
                  <View style={s.postHead}>
                    <View style={s.avatar}><Text style={s.avatarText}>{p.author.charAt(0)}</Text></View>
                    <Text style={s.author}>{p.author}</Text>
                    <Text style={type.meta}>· Ch. {p.chapter} · {p.ago}</Text>
                  </View>
                  {hidden ? (
                    <Pressable onPress={() => setRevealed(toggle(revealed, p.id))} style={s.spoiler} accessibilityRole="button" accessibilityLabel="Reveal spoiler">
                      <Ionicons name="eye-outline" size={18} color={colors.dim} />
                      <Text style={type.meta}>CHAPTER {p.chapter} SPOILER · TAP TO REVEAL</Text>
                    </Pressable>
                  ) : (
                    <Text style={s.body}>{p.body}</Text>
                  )}
                  <Pressable onPress={() => { if (!isLiked) setPops({ ...pops, [p.id]: (pops[p.id] ?? 0) + 1 }); setLiked(toggle(liked, p.id)); }} style={s.like} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: isLiked }}>
                    <Burst trigger={pops[p.id] ?? 0} color={colors.pink} />
                    <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? colors.pink : colors.faint} />
                    <Text style={[type.meta, isLiked && { color: colors.pink }]}>{p.likes + (isLiked ? 1 : 0)}</Text>
                  </Pressable>
                </View>
              </Reveal>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 220, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, padding: 18 },
  bannerMeta: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.8, color: 'rgba(255,255,255,0.75)' },
  bannerText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.text },
  join: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: colors.text },
  joined: { backgroundColor: 'rgba(255,255,255,0.15)' },
  joinText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#29123C' },
  composer: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  input: { minHeight: 44, color: colors.text, fontFamily: fonts.sans, fontSize: 15, outlineStyle: 'none' } as object,
  composerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spoilerToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  post: { gap: 10, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(155,107,214,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  author: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  like: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
});
