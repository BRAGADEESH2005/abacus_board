import mongoose from 'mongoose';
import { connectDB, gridBucket } from '@/lib/db';
import { ApiError, handler } from '@/lib/http';
import { getSession } from '@/lib/auth';

/**
 * Streams an uploaded file. Avatars are visible to the owner and admins; landlord go ahead
 * documents only to the broker who uploaded them and admins.
 */
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError(404, 'File not found.');
  const s = await getSession();
  if (!s) throw new ApiError(401, 'Please log in again.');
  await connectDB();
  const bucket = gridBucket();
  const [file] = await bucket.find({ _id: new mongoose.Types.ObjectId(id) }).toArray();
  if (!file) throw new ApiError(404, 'File not found.');
  const meta = (file.metadata ?? {}) as { ownerId?: string; kind?: string; contentType?: string };
  if (s.type === 'broker' && meta.ownerId !== s.broker._id.toString()) throw new ApiError(403, 'You cannot open this file.');
  const chunks: Buffer[] = [];
  for await (const c of bucket.openDownloadStream(file._id)) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const type = meta.contentType ?? 'application/octet-stream';
  const inline = type.startsWith('image/') || type === 'application/pdf';
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(body.length),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.filename)}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
