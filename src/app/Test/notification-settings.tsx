import { ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Group, Toggle, settingsPage } from '../../components/SettingsRows';
import { useSettings } from '../../data/settings';
import { syncBedtimeReminder } from '../../data/notifications';

// Opened from Profile; it's in the radio room, so the bat flies in.
export default function NotificationSettings() {
  const [settings, update] = useSettings();
  return (
    <Screen interior="radioroom" city={false}>
      <PageHeader title="Notifications" eyebrow="SETTINGS" fallback="/Test/profile" />
      <ScrollView contentContainerStyle={settingsPage} showsVerticalScrollIndicator={false}>
        <Group title="Remind me about" icon="notifications-outline">
          <Toggle label="Bedtime story reminder" hint="A gentle nudge at 8:30 pm to keep your streak going." value={settings.dailyReminder} onChange={(v) => { update('dailyReminder', v); void syncBedtimeReminder(v); }} />
          <Toggle label="Friends' listening activity" hint="Saved for when friend updates arrive; Echo can't send them yet." value={settings.friendActivity} onChange={(v) => update('friendActivity', v)} />
          <Toggle label="A new chapter is ready" hint="When a book you're making finishes another chapter." value={settings.newChapters} onChange={(v) => update('newChapters', v)} last />
        </Group>
      </ScrollView>
    </Screen>
  );
}
