import { Platform } from 'react-native';

// Conditional import for expo-notifications (not supported in Expo Go)
let Notifications: any = null;
try {
  // This will only work in development builds, not in Expo Go
  Notifications = require('expo-notifications');
  
  // Configure how notifications appear when app is in foreground
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
  // expo-notifications not available in Expo Go
  console.log('Notifications not available in Expo Go - using fallback');
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) {
    console.log('Notifications not available - using fallback');
    return false;
  }
  
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.log('Permission request failed:', error);
    return false;
  }
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number
): Promise<string | null> {
  if (!Notifications) {
    console.log('Daily reminder scheduling not available in Expo Go');
    return null;
  }
  
  try {
    await cancelDailyReminder();

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 MoneyTracker Reminder',
        body: "Don't forget to log today's expenses! Keeping track helps you stay on budget.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return id;
  } catch (error) {
    console.log('Daily reminder scheduling failed:', error);
    return null;
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Notifications) {
    return;
  }
  
  try {
    const scheduled =
      await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (
        notification.content.title?.includes('MoneyTracker Reminder')
      ) {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        );
      }
    }
  } catch (error) {
    console.log('Cancel daily reminder failed:', error);
  }
}

export async function sendBudgetAlert(
  categoryName: string,
  percentUsed: number
): Promise<void> {
  if (!Notifications) {
    // In Expo Go, show console message as fallback
    const isOver = percentUsed >= 100;
    console.log(`💰 Budget ${isOver ? 'Exceeded' : 'Warning'}: ${categoryName} - ${percentUsed.toFixed(0)}% used`);
    return;
  }
  
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const isOver = percentUsed >= 100;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isOver ? '🚨 Budget Exceeded!' : '⚠️ Budget Warning',
        body: isOver
          ? `You've exceeded your budget for ${categoryName}! (${percentUsed.toFixed(0)}% spent)`
          : `You've used ${percentUsed.toFixed(0)}% of your ${categoryName} budget. Consider slowing down.`,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.log('Budget alert failed:', error);
  }
}

export async function scheduleDebtReminder(
  debtId: number,
  contactName: string,
  dueDate: string,
  type: 'lent' | 'borrowed'
): Promise<void> {
  if (!Notifications) {
    console.log(`Debt reminder not available in Expo Go: ${type} ${contactName} - due ${dueDate}`);
    return;
  }
  
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const due = new Date(dueDate);
    const threeDaysBefore = new Date(due);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

    const verb = type === 'lent' ? 'collect from' : 'pay back';

    // Reminder 3 days before
    if (threeDaysBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Debt Due in 3 Days',
          body: `Reminder to ${verb} ${contactName}. Due on ${dueDate}.`,
          data: { debtId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: threeDaysBefore,
        },
      });
    }

    // Reminder on due date
    if (due > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Debt Due Today',
          body: `Today is the due date to ${verb} ${contactName}.`,
          data: { debtId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: due,
        },
      });
    }
  } catch (error) {
    console.log('Debt reminder scheduling failed:', error);
  }
}
