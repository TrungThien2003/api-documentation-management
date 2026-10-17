import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.set('trust proxy', 1); // chạy sau reverse proxy (Render/Railway/Nginx...) để rate-limit đúng IP
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '10mb' })); // file OpenAPI có thể khá lớn
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp });
});

app.use(
  '/api/v1',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false }),
  routes,
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
