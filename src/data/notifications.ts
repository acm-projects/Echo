import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { currentSettings } from './settings';

// Local notifications, scheduled on the device: the bedtime reminder (Notifications > Bedtime story reminder) and a
// note when a new chapter finishes (… > A new book finishes processing). Friends' activity needs pushes sent from a
// server, which Echo doesn't have yet. The web build has no notifications, so everything here is skipped there.

const REMINDER_ID = 'echo-bedtime-reminder';
const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 30;
const ANDROID_CHANNEL = 'echo';

let prepared = false;
// Chapters already announced, so the upload screen and Book Details (which both watch a book) don't both notify.
const announced = new Set<string>();

async function prepare() {
  if (prepared) return;
  prepared = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, { name: 'Echo', importance: Notifications.AndroidImportance.DEFAULT });
  }
}

async function allowed() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Schedules (or cancels) the nightly reminder to match the setting. Called at launch and when the toggle changes. */
export async function syncBedtimeReminder(enabled: boolean) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    if (!enabled || !(await allowed())) return;
    await prepare();
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: 'Time for a story', body: 'A chapter before bed keeps your streak going.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: REMINDER_HOUR, minute: REMINDER_MINUTE, channelId: ANDROID_CHANNEL },
    });
  } catch (error) {
    console.warn(`Could not schedule the bedtime reminder: ${error instanceof Error ? error.message : error}`);
  }
}

/** Tells the reader a chapter they're waiting on is ready, if they have new-chapter notifications on. */
export async function notifyChapterReady(bookId: string, chapterIndex: number, bookTitle: string, chapterTitle: string) {
  const key = `${bookId}:${chapterIndex}`;
  if (Platform.OS === 'web' || announced.has(key) || !currentSettings().newChapters) return;
  announced.add(key);
  try {
    if (!(await allowed())) return;
    await prepare();
    await Notifications.scheduleNotificationAsync({
      content: { title: `${chapterTitle} is ready`, body: `The next part of ${bookTitle} is ready to listen to.` },
      trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
    });
  } catch (error) {
    console.warn(`Could not send the chapter notification: ${error instanceof Error ? error.message : error}`);
  }
}

/** Marks chapters that were already ready when the reader first looked, so only ones finishing later notify. */
export function markChaptersSeen(bookId: string, chapterIndexes: number[]) {
  for (const index of chapterIndexes) announced.add(`${bookId}:${index}`);
}
