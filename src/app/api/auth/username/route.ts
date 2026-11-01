import { connectDB } from '@/lib/db';
import { handler, ok } from '@/lib/http';
import { USERNAME_RE } from '@/lib/constants';
import { getSettings } from '@/lib/settings';
import { getSession } from '@/lib/auth';
import { Broker } from '@/models';

function candidates(name: string, cityCode: string): string[] {
  const parts = name.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const first = parts[0] ?? 'broker';
  const last = parts[parts.length - 1] ?? '';
  const n2 = () => String(10 + Math.floor(Math.random() * 89));
  const list = [
    last && last !== first ? `${first}.${last}` : `${first}.${cityCode}`,
    `${first}_${cityCode}`,
    `${first}${last !== first ? last : ''}${n2()}`,
    `${first}${last !== first ? last : ''}`,
    last && last !== first ? `${last}.${first}` : `${first}.${n2()}`,
    `${first}_${cityCode}${n2()}`,
    `${first}.${n2()}${n2()}`,
  ];
  return [...new Set(list.map((u) => u.slice(0, 20)))].filter((u) => USERNAME_RE.test(u));
}

/** Live availability check with three suggestions built from name and city (Broker v2, 3b). */
export const GET = handler(async (req) => {
  await connectDB();
  const url = new URL(req.url);
  const u = (url.searchParams.get('u') ?? '').trim().toLowerCase();
  const name = url.searchParams.get('name') ?? '';
  const city = url.searchParams.get('city') ?? '';
  const s = await getSession();
  const selfId = s?.type === 'broker' ? s.broker._id : null;
  const valid = USERNAME_RE.test(u);
  const taken = valid ? Boolean(await Broker.findOne({ username: u, ...(selfId ? { _id: { $ne: selfId } } : {}) }).select('_id').lean()) : false;
  let suggestions: string[] = [];
  if (!valid || taken) {
    const settings = await getSettings();
    const code = (settings.cities.find((c) => c.name === city)?.code ?? 'in').toLowerCase();
    const cands = candidates(name || u || 'broker', code);
    const used = await Broker.find({ username: { $in: cands } }).select('username').lean<{ username: string }[]>();
    const usedSet = new Set(used.map((x) => x.username));
    suggestions = cands.filter((c) => !usedSet.has(c)).slice(0, 3);
  }
  return ok({ valid, available: valid && !taken, suggestions });
});
