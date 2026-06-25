/**
 * server/config/mongodb.ts
 * Mongoose connection with retry logic and connection event logging.
 */

import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectWithRetry(uri: string, attempt = 1): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log('[MongoDB] Connected successfully to Atlas cluster.');
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      console.error(`[MongoDB] Failed after ${MAX_RETRIES} attempts. Exiting.`);
      process.exit(1);
    }
    console.warn(`[MongoDB] Connection attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return connectWithRetry(uri, attempt + 1);
  }
}

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set.');

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] Reconnected successfully.');
  });

  await connectWithRetry(uri);
}

export default mongoose;
