import { connectDB } from '@/lib/db';
import { apiAdmin } from '@/lib/auth';
import { handler, ok } from '@/lib/http';
import { runDueJobs } from '@/lib/services/jobs';
import { Notification, type NotificationDoc } from '@/models';

export const GET = handler(async (req) => {
  await connectDB();
  const s = await apiAdmin();
  await runDueJobs().catch((e) => console.error('[jobs]', e));
  const url = new URL(req.url);
  const tab = url.searchParams.get('tab') ?? 'all';
  const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 60));
  const q: Record<string, unknown> = {};
  if (tab === 'flags') Object.assign(q, { kind: 'flag', resolvedAt: null });
  else if (tab === 'activity') q.kind = 'activity';
  else if (tab === 'summary') q.kind = 'summary';
  else Object.assign(q, { $or: [{ kind: { $ne: 'flag' } }, { resolvedAt: null }] });
  const list = await Notification.find(q).sort({ createdAt: -1 }).limit(limit).lean<NotificationDoc[]>();
  const me = s.admin._id.toString();
  const unread = await Notification.countDocuments({ readBy: { $ne: s.admin._id }, $or: [{ kind: { $ne: 'flag' } }, { resolvedAt: null }], createdAt: { $gte: new Date(Date.now() - 60 * 86400000) } });
  return ok({
    unread,
    items: list.map((n) => ({
      id: n._id.toString(),
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      data: n.data,
      createdAt: n.createdAt,
      read: (n.readBy ?? []).some((r) => r.toString() === me),
    })),
  });
});
