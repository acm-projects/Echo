import { ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Choice, Group, Toggle, settingsPage } from '../../components/SettingsRows';
import { useSettings, type Settings } from '../../data/settings';

// Opened from the player's options menu.
export default function PlaybackSettings() {
  const [settings, update] = useSettings();
  return (
    <Screen scene="neon" city={false}>
      <PageHeader title="Playback" eyebrow="SETTINGS" fallback="/Test/player" />
      <ScrollView contentContainerStyle={settingsPage} showsVerticalScrollIndicator={false}>
        <Group title="Listening" icon="options-outline">
          <Choice label="Default speed" value={settings.playbackSpeed} options={[0.8, 1, 1.25, 1.5, 2]} format={(v) => `${v}×`} onChange={(v) => update('playbackSpeed', v)} />
          <Choice label="Skip buttons jump" value={settings.skipSeconds} options={[10, 15, 30] as Settings['skipSeconds'][]} format={(v) => `${v}s`} onChange={(v) => update('skipSeconds', v)} />
          <Choice label="Sleep timer" value={settings.sleepTimerMinutes} options={[0, 15, 30, 45, 60] as Settings['sleepTimerMinutes'][]} format={(v) => (v ? `${v}m` : 'Off')} onChange={(v) => update('sleepTimerMinutes', v)} />
          <Toggle label="Play the next chapter automatically" value={settings.autoplayNextChapter} onChange={(v) => update('autoplayNextChapter', v)} last />
        </Group>
      </ScrollView>
    </Screen>
  );
}
