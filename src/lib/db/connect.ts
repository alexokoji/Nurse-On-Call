import mongoose from 'mongoose';

/**
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every reload until MongoDB refuses them. We cache the
 * connection (and the in-flight promise, so concurrent requests share one
 * handshake) on the global object.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  /* Read at call time, not at module load. ES imports are hoisted above any
     dotenv call in a script, so capturing this in a module-level const made
     the connection depend on import order. */
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set('strictQuery', true);

    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
      })
      .then((m) => {
        // Ensure every model module is registered before any populate() runs.
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset so the next request retries instead of reusing a rejected promise.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/**
 * True when an error means "the database could not be reached", as opposed to
 * the query being wrong.
 *
 * Worth distinguishing because the two want opposite handling: a rejected
 * query is a bug to surface, while an unreachable cluster is an outage the
 * visitor should be told about in plain words. The usual cause in production
 * is an IP allowlist that does not include the host — on a serverless platform
 * the outbound addresses are dynamic, so the allowlist has to be open and the
 * database password is what protects the cluster.
 */
export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = String((error as { name?: unknown }).name ?? '');
  return (
    name === 'MongooseServerSelectionError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoTimeoutError' ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/.test(
      String((error as { message?: unknown }).message ?? ''),
    )
  );
}

/** True when a replica set is available, which is what transactions require. */
export async function supportsTransactions(): Promise<boolean> {
  try {
    const conn = await connectDB();
    const admin = conn.connection.db?.admin();
    if (!admin) return false;
    const info = await admin.command({ hello: 1 });
    return Boolean(info.setName || info.msg === 'isdbgrid');
  } catch {
    return false;
  }
}

export default connectDB;
