import { ApiError, handler, ok } from '@/lib/http';
import { getSession } from '@/lib/auth';
import { coordsFromMapsUrl } from '@/lib/domain';

const ALLOWED = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+)$/i;

/**
 * Reads latitude and longitude from a Google Maps link. Short links (maps.app.goo.gl)
 * are followed hop by hop, only ever to Google hosts.
 */
export const GET = handler(async (req) => {
  const s = await getSession();
  if (!s) throw new ApiError(401, 'Please log in again.');
  const raw = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  const direct = coordsFromMapsUrl(raw);
  if (direct) return ok(direct);
  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    throw new ApiError(422, 'Paste a Google Maps link, for example https://maps.app.goo.gl/...');
  }
  for (let hop = 0; hop < 6; hop++) {
    if (current.protocol !== 'https:' || !ALLOWED.test(current.hostname)) throw new ApiError(422, 'Only Google Maps links are accepted.');
    const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 AbacusBoard' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res) throw new ApiError(502, 'Could not open that link. Drop the pin on the map instead.');
    const loc = res.headers.get('location');
    if (loc) {
      const next = new URL(loc, current);
      const c = coordsFromMapsUrl(next.toString());
      if (c) return ok(c);
      current = next;
      continue;
    }
    const text = await res.text().catch(() => '');
    const c = coordsFromMapsUrl(text.slice(0, 200000));
    if (c) return ok(c);
    break;
  }
  throw new ApiError(422, 'No coordinates found in that link. Open the place in Google Maps, tap Share, copy the link, or drop the pin on the map.');
});
