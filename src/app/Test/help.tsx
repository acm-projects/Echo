import { useRef, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { GradientButton } from '../../components/GradientButton';
import { colors, fonts, type } from '../../../theme';
import { toggleNarratorTucked, toggleTucked } from '../../data/tucked';
import { supabaseMyBooks } from '../../data/supabaseRows';
import { supabase } from '../../../lib/supabase';

// Set to the team's real support inbox; the contact card stays hidden until then.
const SUPPORT_EMAIL = '';

const FAQ = [
  { q: 'What kinds of books can I upload?', a: 'PDF, EPUB, TXT and Markdown files up to 50 MB. Scanned PDFs without real text can’t be read yet.' },
  { q: 'How long does a book take to narrate?', a: 'A short story takes a few minutes. A full novel can take longer, and you can keep listening to other books while it works. We’ll show each stage on the Upload tab.' },
  { q: 'Why does each character sound different?', a: 'Echo reads the book, works out who is speaking, and gives every character their own voice. You can turn this off in Settings → Voices to hear only your narrator.' },
  { q: 'Can I change the narrator’s voice?', a: 'Yes. Open Settings → Voices → Narrator voice to pick one or describe a new voice in your own words.' },
];

// The question whose taps double as the demo narrator's switch.
const NARRATOR_QUESTION = FAQ[3].q;

// Flips the hidden demo switch for whoever is signed in, against every book on the account (hidden ones included).
async function flipTucked() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await toggleTucked(userId, await supabaseMyBooks({ includeTucked: true }));
}

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  // Five quick taps on the intro line flip the hidden demo switch (see data/tucked.ts). Taps, not a long press, so the
  // phone never offers to look up or select the words.
  // Five quick taps on the "Can I change the narrator's voice?" question flip only the demo narrator (hidden or shown).
  // The question still opens and closes as usual with each tap.
  const taps = useRef<number[]>([]);
  const fiveTaps = (list: { current: number[] }, action: () => Promise<unknown>) => () => {
    const now = Date.now();
    list.current = [...list.current.filter((at) => now - at < 2000), now];
    if (list.current.length < 5) return;
    list.current = [];
    void action().catch(() => {});
  };
  const secretTap = fiveTaps(taps, flipTucked);
  const narratorTaps = useRef<number[]>([]);
  const narratorTap = fiveTaps(narratorTaps, toggleNarratorTucked);
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === i ? null : i);
  };

  return (
    <Screen interior="radioroom">
      <PageHeader title="Help & support" fallback="/Test/profile" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Pressable onPress={secretTap} accessible={false} style={s.noSelect}>
          <Text style={[s.intro, s.noSelect]} selectable={false}>Questions from fellow night listeners.</Text>
        </Pressable>
        <View style={s.card}>
          {FAQ.map((item, i) => (
            <Pressable key={item.q} onPress={() => { toggle(i); if (item.q === NARRATOR_QUESTION) narratorTap(); }} style={[s.item, i < FAQ.length - 1 && s.line]} accessibilityRole="button" accessibilityState={{ expanded: open === i }}>
              <View style={s.qRow}>
                <Text style={s.q}>{item.q}</Text>
                <Ionicons name={open === i ? 'remove' : 'add'} size={20} color={colors.pink} />
              </View>
              {open === i && <Text style={[type.body, { marginTop: 10, lineHeight: 21 }]}>{item.a}</Text>}
            </Pressable>
          ))}
        </View>

        {SUPPORT_EMAIL !== '' && <View style={s.contact}>
          <Text style={s.contactTitle}>Still stuck?</Text>
          <Text style={type.body}>Write to us and a real person will reply, usually within a day.</Text>
          <GradientButton title="Email support" icon="mail-outline" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Echo%20help`)} style={{ marginTop: 16 }} />
        </View>}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 200 },
  // Web: no word selection or iOS callout on repeated taps.
  noSelect: { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object,
  intro: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.dim, marginBottom: 16, marginLeft: 4 },
  card: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18 },
  item: { paddingVertical: 17 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  q: { flex: 1, fontFamily: fonts.sansMd, fontSize: 15, color: colors.text },
  contact: { marginTop: 26, borderRadius: 12, padding: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(214,123,176,0.35)', gap: 6 },
  contactTitle: { fontFamily: fonts.serif, fontSize: 22, color: colors.text },
});
