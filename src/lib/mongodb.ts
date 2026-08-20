import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

let _startupDone = false;

async function runStartupTasks() {
  if (_startupDone) return;
  _startupDone = true;

  const { reconcileAllEvents } = await import('./reconcile');
  reconcileAllEvents().catch(err =>
    console.error('[Reconcile] Startup reconciliation failed:', err)
  );

  import('@/lib/ml/modelManager').then(({ trainModel }) => {
    trainModel().catch(err =>
      console.error('[IsolationForest] Startup training failed:', err)
    );
  }).catch(err => console.error(err));

  import('@/lib/ml/reliabilityScoring').then(({ trainReliabilityModel }) => {
    trainReliabilityModel().catch(err =>
      console.error('[Reliability] Startup training failed:', err)
    );
  }).catch(err => console.error(err));
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(async (mongooseInstance) => {
      console.log('✅ Connected to DB:', mongooseInstance.connection.name);

      runStartupTasks().catch(err =>
        console.error('[DB] Startup tasks failed:', err)
      );

      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
