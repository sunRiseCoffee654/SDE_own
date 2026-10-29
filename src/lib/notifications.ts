import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const BASE_ID = 7400;
const SNOOZE_ID = BASE_ID - 1;

export async function enableNotifications() {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export async function scheduleNativeReminders(intervalMinutes: number, startTime: string, endTime: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const old = await LocalNotifications.getPending();
    await LocalNotifications.cancel({ notifications: old.notifications.filter((n) => n.id >= SNOOZE_ID && n.id < BASE_ID + 100) });
    const now = new Date();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const dayStart = sh * 60 + sm;
    const dayEnd = eh * 60 + em;
    const notifications = [] as { id: number; title: string; body: string; schedule: { at: Date }; extra: { route: string } }[];
    let id = BASE_ID;
    // Pre-schedule up to 48 reminders. Reschedule on app launch and after each app-side acknowledgement.
    for (let day = 0; day < 3 && notifications.length < 48; day++) {
      const start = new Date(now);
      start.setDate(now.getDate() + day);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() + day);
      end.setHours(eh, em, 0, 0);
      let at = new Date(start);
      while (at <= now) at = new Date(at.getTime() + intervalMinutes * 60_000);
      while (at <= end && notifications.length < 48) {
        notifications.push({ id: id++, title: 'Time for a quick check-in ✨', body: 'What are you working on right now? Open SDE Orbit to log your progress.', schedule: { at: new Date(at) }, extra: { route: 'reminder' } });
        at = new Date(at.getTime() + intervalMinutes * 60_000);
      }
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (error) {
    console.warn('Could not schedule local reminders:', error);
  }
}

export async function cancelNativeReminders() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const old = await LocalNotifications.getPending();
    const orbitNotifications = old.notifications.filter((notification) => notification.id >= SNOOZE_ID && notification.id < BASE_ID + 100);
    if (orbitNotifications.length) await LocalNotifications.cancel({ notifications: orbitNotifications });
  } catch (error) {
    console.warn('Could not cancel local reminders:', error);
  }
}

export async function scheduleNativeSnooze() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: SNOOZE_ID,
        title: 'SDE Orbit check-in ⏰',
        body: 'Your 15-minute snooze is over.',
        schedule: { at: new Date(Date.now() + 15 * 60_000) },
        extra: { route: 'reminder' },
      }],
    });
    return true;
  } catch (error) {
    console.warn('Could not schedule snooze:', error);
    return false;
  }
}

export function showBrowserReminder() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Time for a quick check-in ✨', { body: 'Open SDE Orbit and record what you are working on.' });
  }
}
