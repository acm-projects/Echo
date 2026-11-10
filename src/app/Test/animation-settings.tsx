import { ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { Group, Toggle, settingsPage } from '../../components/SettingsRows';
import { useSettings } from '../../data/settings';

// Opened from Profile; it's in the radio room, so the bat flies in. Each kind of animation switches off on its own; Reduce Motion in the OS turns them all off.
export default function AnimationSettings() {
  const [settings, update] = useSettings();
  return (
    <Screen interior="radioroom" city={false}>
      <PageHeader title="Animations" eyebrow="SETTINGS" fallback="/Test/profile" />
      <ScrollView contentContainerStyle={settingsPage} showsVerticalScrollIndicator={false}>
        <Group title="Play these" icon="sparkles-outline">
          <Toggle label="Flying between tabs" hint="The bat crosses the skyline to the next tab." value={settings.motionNavigation} onChange={(v) => update('motionNavigation', v)} />
          <Toggle label="Going into pages" hint="The bat flies into a building when you open a page." value={settings.motionRooms} onChange={(v) => update('motionRooms', v)} />
          <Toggle label="Signing in and out" hint="The swoop through the clouds and the flight home to the moon." value={settings.motionOpening} onChange={(v) => update('motionOpening', v)} />
          <Toggle label="Living backgrounds" hint="Twinkling stars, landmarks, lanterns and the roaming bat." value={settings.motionBackground} onChange={(v) => update('motionBackground', v)} />
          <Toggle label="Little touches" hint="Content easing in and hand-drawn underlines." value={settings.motionDetails} onChange={(v) => update('motionDetails', v)} />
          <Toggle label="Loading bat" hint="The bat flying over the countryside or a little city while something loads." value={settings.motionLoader} onChange={(v) => update('motionLoader', v)} last />
        </Group>
      </ScrollView>
    </Screen>
  );
}
