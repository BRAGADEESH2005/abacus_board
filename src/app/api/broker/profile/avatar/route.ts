import { connectDB } from '@/lib/db';
import { apiBroker } from '@/lib/auth';
import { handler, ok } from '@/lib/http';
import { MAX_AVATAR_BYTES, processAvatar, readUpload, removeUpload, store } from '@/lib/uploads';
import { Broker } from '@/models';

export const POST = handler(async (req) => {
  await connectDB();
  const s = await apiBroker();
  const up = await readUpload(req, 'file', MAX_AVATAR_BYTES);
  const img = await processAvatar(up.buf);
  const id = await store(img, `${s.broker.username}.jpg`, { ownerType: 'broker', ownerId: s.broker._id.toString(), kind: 'avatar', contentType: 'image/jpeg' });
  await Broker.updateOne({ _id: s.broker._id }, { $set: { avatarFileId: id } });
  await removeUpload(s.broker.avatarFileId);
  return ok({ avatarFileId: id.toString(), bytes: img.length });
});

export const DELETE = handler(async () => {
  await connectDB();
  const s = await apiBroker();
  await removeUpload(s.broker.avatarFileId);
  await Broker.updateOne({ _id: s.broker._id }, { $set: { avatarFileId: null } });
  return ok({ ok: true });
});
