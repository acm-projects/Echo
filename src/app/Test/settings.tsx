import { ComponentRef, ReactNode, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { colors, fonts, type } from '../../../theme';
import { useSettings, type Settings } from '../../data/settings';

type Section = 'playback' | 'voice' | 'notifications';

export default function SettingsScreen() {
  const { section } = useLocalSearchParams<{ section?: Section }>();
  const [settings, update] = useSettings();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Partial<Record<Section, number>>>({});

  // Profile rows deep-link to one section; jump there once it has been laid out.
  const mark = (name: Section) => (y: number) => {
    offsets.current[name] = y;
    if (name === section) scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
  };

  return (
    <Screen city={false}>
      <PageHeader title="Settings" eyebrow="LISTENING" fallback="/Test/profile" />
      <ScrollView ref={scroll} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Group title="Playback" icon="options-outline" onY={mark('playback')} highlight={section === 'playback'}>
          <Choice label="Default speed" value={settings.playbackSpeed} options={[0.8, 1, 1.25, 1.5, 2]} format={(v) => `${v}×`} onChange={(v) => update('playbackSpeed', v)} />
          <Choice label="Skip buttons jump" value={settings.skipSeconds} options={[10, 15, 30] as Settings['skipSeconds'][]} format={(v) => `${v}s`} onChange={(v) => update('skipSeconds', v)} />
          <Choice label="Sleep timer" value={settings.sleepTimerMinutes} options={[0, 15, 30, 45, 60] as Settings['sleepTimerMinutes'][]} format={(v) => (v ? `${v}m` : 'Off')} onChange={(v) => update('sleepTimerMinutes', v)} />
          <Toggle label="Play the next chapter automatically" value={settings.autoplayNextChapter} onChange={(v) => update('autoplayNextChapter', v)} last />
        </Group>

        <Group title="Voices" icon="pulse-outline" onY={mark('voice')} highlight={section === 'voice'}>
          <Toggle label="A different voice for each character" hint="Turn off to hear the whole book in your narrator's voice." value={settings.characterVoices} onChange={(v) => update('characterVoices', v)} />
          <Pressable style={s.link} onPress={() => router.push('/narrator-voices')} accessibilityRole="button">
            <Text style={s.label}>Narrator voice</Text>
            <Text style={s.linkHint}>Choose or design</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        </Group>

        <Group title="Notifications" icon="notifications-outline" onY={mark('notifications')} highlight={section === 'notifications'}>
          <Toggle label="Bedtime story reminder" hint="A gentle nudge to keep your streak going." value={settings.dailyReminder} onChange={(v) => update('dailyReminder', v)} />
          <Toggle label="Friends' listening activity" value={settings.friendActivity} onChange={(v) => update('friendActivity', v)} />
          <Toggle label="A new book finishes processing" value={settings.newChapters} onChange={(v) => update('newChapters', v)} last />
        </Group>
      </ScrollView>
    </Screen>
  );
}

function Group({ title, icon, children, onY, highlight }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode; onY: (y: number) => void; highlight?: boolean }) {
  return (
    <View onLayout={(e) => onY(e.nativeEvent.layout.y)} style={{ marginBottom: 26 }}>
      <View style={s.groupHead}>
        <Ionicons name={icon} size={16} color={colors.pink} />
        <Text style={s.groupTitle}>{title.toUpperCase()}</Text>
      </View>
      <View style={[s.card, highlight && { borderColor: 'rgba(214,123,176,0.55)' }]}>{children}</View>
    </View>
  );
}

function Toggle({ label, hint, value, onChange, last }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.line]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.label}>{label}</Text>
        {hint && <Text style={type.meta}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.pink }} thumbColor="#fff" />
    </View>
  );
}

function Choice<T extends number>({ label, value, options, format, onChange }: { label: string; value: T; options: T[]; format: (value: T) => string; onChange: (value: T) => void }) {
  return (
    <View style={[s.row, s.line, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((option) => {
          const on = option === value;
          return (
            <Pressable key={option} onPress={() => onChange(option)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && { color: '#29123C' }]}>{format(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 60 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 4 },
  groupTitle: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2.2, color: colors.dim },
  card: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontFamily: fonts.sansMd, fontSize: 15, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 15 },
  linkHint: { flex: 1, textAlign: 'right', fontFamily: fonts.sans, fontSize: 13, color: colors.dim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { backgroundColor: colors.pink, borderColor: colors.pink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
});
