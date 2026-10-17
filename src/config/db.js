import mongoose from 'mongoose';
import { env } from './env.js';
import dns from 'node:dns';


export async function connectDB() {
  if (env.DNS_SERVERS) {
    dns.setServers(env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean));
  }
  mongoose.connection.on('error', (e) => console.error('[mongo] lỗi:', e.message));
  mongoose.connection.on('disconnected', () => console.warn('[mongo] mất kết nối'));

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });
  console.log(`[mongo] đã kết nối database "${mongoose.connection.name}"`);
}

export const disconnectDB = () => mongoose.disconnect();
