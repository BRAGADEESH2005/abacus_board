import 'server-only';
import mongoose from 'mongoose';
import { getEnv } from './env';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; booted: Promise<void> | null };
const g = globalThis as unknown as { __abacusMongo?: Cache };
const cache: Cache = g.__abacusMongo ?? { conn: null, promise: null, booted: null };
g.__abacusMongo = cache;

mongoose.set('strictQuery', true);

/** Connects once per server process and runs the bootstrap (admin sync, settings seed, indexes). */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && cache.booted) {
    await cache.booted;
    return cache.conn;
  }
  const env = getEnv();
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env.MONGODB_URI, { dbName: env.MONGODB_DB, serverSelectionTimeoutMS: 10000, maxPoolSize: 10 })
      .catch((err) => {
        cache.promise = null;
        throw new Error(`Could not connect to MongoDB: ${err instanceof Error ? err.message : String(err)}`);
      });
  }
  cache.conn = await cache.promise;
  if (!cache.booted) {
    cache.booted = (async () => {
      const { bootstrap } = await import('./bootstrap');
      await bootstrap();
    })().catch((err) => {
      cache.booted = null;
      throw err;
    });
  }
  await cache.booted;
  return cache.conn;
}

export function gridBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
}
