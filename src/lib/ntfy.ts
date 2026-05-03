/**
 * NTFY SERVICE — Push Notification Engine
 * Hardcoded for reliability.
 */

const NTFY_TOPIC = 'BASE_PERFORMANCE_AUDIT'; // Hardcoded as requested

export async function sendPushNotification(title: string, message: string, priority: 1 | 2 | 3 | 4 | 5 = 3) {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body: message,
      headers: {
        'Title': title,
        'Priority': priority.toString(),
        'Tags': 'warning,skull'
      }
    });
  } catch (err) {
    console.error('Failed to send push notification:', err);
  }
}
