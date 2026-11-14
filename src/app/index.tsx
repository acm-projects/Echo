import { Redirect } from 'expo-router';

// The app opens on the welcome screen; this route only exists because expo-router needs an index.
export default function Index() {
  return <Redirect href="/Test/welcome" />;
}
