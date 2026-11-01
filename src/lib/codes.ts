import 'server-only';
import { Counter } from '@/models';

async function next(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return doc!.seq;
}

/** PRP CHN 0042: running number per city, never reused. */
export async function nextPropertyCode(cityCode: string): Promise<string> {
  const n = await next(`PRP-${cityCode}`);
  return `PRP ${cityCode} ${String(n).padStart(4, '0')}`;
}

/** REQ CHN 0012: one code per micro market requirement. */
export async function nextRequirementCode(cityCode: string): Promise<string> {
  const n = await next(`REQ-${cityCode}`);
  return `REQ ${cityCode} ${String(n).padStart(4, '0')}`;
}

/** BRD 0007: one brand ask grouping all its micro market requirements. */
export async function nextBrandAskCode(): Promise<string> {
  const n = await next('BRD');
  return `BRD ${String(n).padStart(4, '0')}`;
}
