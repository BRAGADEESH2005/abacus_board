import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { ApiError, handler, ok, requireId } from '@/lib/http';
import { processDocument, readUpload, removeUpload, store } from '@/lib/uploads';
import { Property } from '@/models';

async function own(id: string, brokerId: unknown) {
  const p = await Property.findById(id);
  if (!p || String(p.broker) !== String(brokerId)) throw new ApiError(404, 'That property was not found.');
  return p;
}

/** Landlord's go ahead (Broker Skeleton 10.3): photo of the letter or WhatsApp message, or a PDF. */
export const POST = handler(async (req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const p = await own(requireId((await ctx.params).id, 'property'), s.broker._id);
  const up = await readUpload(req);
  const doc = await processDocument(up.buf);
  const name = `${p.code.replace(/\s+/g, '_')}_landlord_go_ahead.${doc.ext}`;
  const fileId = await store(doc.buf, name, { ownerType: 'broker', ownerId: s.broker._id.toString(), kind: 'goahead', contentType: doc.contentType });
  const old = p.goAheadFileId;
  p.goAheadFileId = fileId;
  p.goAheadFileName = up.name;
  await p.save();
  await removeUpload(old);
  return ok({ fileId: fileId.toString(), name: up.name });
});

export const DELETE = handler(async (_req, ctx) => {
  await connectDB();
  const s = await apiBroker();
  const p = await own(requireId((await ctx.params).id, 'property'), s.broker._id);
  await removeUpload(p.goAheadFileId);
  p.goAheadFileId = null;
  p.goAheadFileName = '';
  await p.save();
  return ok({ ok: true });
});
