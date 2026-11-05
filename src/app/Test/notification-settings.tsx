import { ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Group, Toggle, settingsPage } from '../../components/SettingsRows';
import { useSettings } from '../../data/settings';

// Opened from Profile; it's in the radio room, so the bat flies in.
export default function NotificationSettings() {
  const [settings, update] = useSettings();
  return (
    <Screen interior="radioroom" city={false}>
      <PageHeader title="Notifications" eyebrow="SETTINGS" fallback="/Test/profile" />
      <ScrollView contentContainerStyle={settingsPage} showsVerticalScrollIndicator={false}>
        <Group title="Remind me about" icon="notifications-outline">
          <Toggle label="Bedtime story reminder" hint="A gentle nudge to keep your streak going." value={settings.dailyReminder} onChange={(v) => update('dailyReminder', v)} />
          <Toggle label="Friends' listening activity" value={settings.friendActivity} onChange={(v) => update('friendActivity', v)} />
          <Toggle label="A new book finishes processing" value={settings.newChapters} onChange={(v) => update('newChapters', v)} last />
        </Group>
      </ScrollView>
    </Screen>
  );
}
