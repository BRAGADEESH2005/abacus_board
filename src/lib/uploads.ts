import 'server-only';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { gridBucket } from './db';
import { ApiError } from './http';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type Meta = { ownerType: 'broker' | 'admin'; ownerId: string; kind: 'avatar' | 'goahead'; contentType: string };

export async function readUpload(req: Request, field = 'file', maxBytes = MAX_UPLOAD_BYTES): Promise<{ buf: Buffer; name: string; type: string }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, 'Upload a file.');
  }
  const f = form.get(field);
  if (!f || typeof f === 'string') throw new ApiError(400, 'Upload a file.');
  if (f.size > maxBytes) throw new ApiError(413, `The file is too large. Keep it under ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await f.arrayBuffer());
  return { buf, name: (f.name || 'upload').replace(/[^\w.\- ]+/g, '_').slice(0, 100), type: f.type };
}

export function sniff(buf: Buffer): 'jpeg' | 'png' | 'webp' | 'pdf' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  return null;
}

export async function store(buf: Buffer, filename: string, meta: Meta): Promise<mongoose.Types.ObjectId> {
  const bucket = gridBucket();
  return await new Promise((resolve, reject) => {
    const w = bucket.openUploadStream(filename, { metadata: meta });
    w.on('error', reject);
    w.on('finish', () => resolve(w.id as mongoose.Types.ObjectId));
    w.end(buf);
  });
}

export async function removeUpload(id: mongoose.Types.ObjectId | string | null | undefined) {
  if (!id) return;
  try {
    await gridBucket().delete(new mongoose.Types.ObjectId(String(id)));
  } catch {
    /* already gone */
  }
}

/** Profile picture: JPG or PNG up to 5 MB, cropped on screen, compressed here to about 200 KB. */
export async function processAvatar(buf: Buffer): Promise<Buffer> {
  const kind = sniff(buf);
  if (kind !== 'jpeg' && kind !== 'png') throw new ApiError(415, 'Upload a JPG or PNG image.');
  let size = 400;
  let quality = 82;
  let out = await sharp(buf).rotate().resize(size, size, { fit: 'cover' }).jpeg({ quality, mozjpeg: true }).toBuffer();
  while (out.length > 200 * 1024 && quality > 40) {
    quality -= 10;
    if (quality < 60) size = 320;
    out = await sharp(buf).rotate().resize(size, size, { fit: 'cover' }).jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  return out;
}

/** Landlord go ahead: a photo of the letter or WhatsApp message, or a PDF. Images are re-encoded (strips metadata). */
export async function processDocument(buf: Buffer): Promise<{ buf: Buffer; contentType: string; ext: string }> {
  const kind = sniff(buf);
  if (kind === 'pdf') return { buf, contentType: 'application/pdf', ext: 'pdf' };
  if (kind === 'jpeg' || kind === 'png' || kind === 'webp') {
    const out = await sharp(buf).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { buf: out, contentType: 'image/jpeg', ext: 'jpg' };
  }
  throw new ApiError(415, 'Upload a JPG, PNG, WEBP image or a PDF.');
}
