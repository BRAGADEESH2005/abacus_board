import 'server-only';
import { Notification } from '@/models';

/** Live activity item for the admin bell. Never throws: notifications must not break the action. */
export async function activity(title: string, body = '', link = '', data: Record<string, unknown> = {}) {
  try {
    await Notification.create({ kind: 'activity', title, body, link, data });
  } catch (err) {
    console.error('[notify] failed', err);
  }
}
