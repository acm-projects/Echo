import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so fall back to the browser dialog on web.
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
