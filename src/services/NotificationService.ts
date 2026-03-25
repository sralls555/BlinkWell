import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'blinkwell_reminders';

const MESSAGES = [
  { title: '👁️ Blink Reminder', body: 'You\'ve been staring for a while. Blink slowly a few times.' },
  { title: '🛑 Eye Break Time', body: 'Look 20 feet away for 20 seconds to reduce eye strain.' },
  { title: '😌 Rest Your Eyes', body: 'Close your eyes for 5 seconds. You\'ve earned it.' },
  { title: '👁️ 20-20-20 Rule', body: 'Every 20 min: look 20 feet away for 20 seconds. Do it now!' },
];

class NotificationService {
  private scheduledIds: string[] = [];
  private permissionGranted = false;

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'BlinkWell Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    this.permissionGranted = status === 'granted';
    return this.permissionGranted;
  }

  async scheduleBreakReminders(intervalMinutes: number = 20) {
    if (!this.permissionGranted) return;

    await this.cancelAll();

    const ids: string[] = [];

    // Schedule 3 future reminders at 20, 40, 60 min intervals
    for (let i = 1; i <= 3; i++) {
      const msg = MESSAGES[i % MESSAGES.length];
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          data: { type: 'blink_reminder', index: i },
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: intervalMinutes * 60 * i,
          repeats: false,
        },
      });
      ids.push(id);
    }

    this.scheduledIds = ids;
  }

  async rescheduleFromNow(intervalMinutes: number = 20) {
    await this.scheduleBreakReminders(intervalMinutes);
  }

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.scheduledIds = [];
  }

  addNotificationResponseListener(
    handler: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }

  addNotificationReceivedListener(
    handler: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(handler);
  }
}

export const notificationService = new NotificationService();
