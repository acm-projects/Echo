import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';

// Offline downloads aren't built yet; this page tells the truth instead of showing a broken list.
export default function Downloads() {
  return (
    <Screen interior="radioroom">
      <PageHeader title="Downloads" fallback="/Test/profile" />
      <EmptyState
        title="Nothing saved for offline yet"
        body="Soon you'll be able to keep books on this device for flights, road trips and nights without Wi-Fi."
        action="Back to your library"
        onAction={() => router.navigate('/Test/library')}
      />
    </Screen>
  );
}
