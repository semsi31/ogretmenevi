import express from 'express';
import cors from 'cors'; // Consider installing @types/cors for TypeScript support
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { ensureSchema } from './db';
import { restaurantsRouter } from './routes/restaurants';
import { transportRoutesRouter } from './routes/transportRoutes';
import { feedbackRouter } from './routes/feedback';
import { exploreRouter } from './routes/explore';
import { slidersRouter } from './routes/sliders';
import { authRouter } from './routes/auth';

async function bootstrap() {
  try {
    await ensureSchema();
    console.log('[DB] Schema ensured');
  } catch (err) {
    console.error('[DB] init error:', err);
    // Dev amaçlı: API ayakta kalsın
  }
  const app = express();
  const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000';
  const allowedOrigins = new Set(rawOrigins.split(',').map((o) => o.trim()).filter(Boolean));
  const corsOptions: cors.CorsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400
  };
  // CORS must be first
  app.use(cors(corsOptions));
  // Explicitly handle preflight for all routes with 204 and headers
  app.options('*', (req, res) => {
    const origin = (req.headers['origin'] as string) || '';
    const reqHeaders = (req.headers['access-control-request-headers'] as string) || 'Content-Type,Authorization,X-CSRF-Token';
    if (!origin || allowedOrigins.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin || Array.from(allowedOrigins)[0] || '*');
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', reqHeaders);
      res.header('Access-Control-Max-Age', '86400');
    }
    return res.status(204).end();
  });
  // Bypass rate limiting for preflights
  app.use(rateLimit({ windowMs: 60_000, max: 300, skip: (req: any) => req.method === 'OPTIONS' }));
  app.use(express.json({ limit: '10mb' }));

  // Simple request logging
  app.use((req, _res, next) => {
    const started = Date.now();
    console.log(`[REQ] ${req.method} ${req.url}`);
    const end = (_: any) => {
      const ms = Date.now() - started;
      console.log(`[RES] ${req.method} ${req.url} - ${ms}ms`);
    };
    _res.on('finish', end);
    _res.on('close', end);
    next();
  });

  // routes go here

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/restaurants', restaurantsRouter);
  app.use('/api/routes', transportRoutesRouter);
  app.use('/api/explore', exploreRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/sliders', slidersRouter);
  app.use('/api/auth', authRouter);

  // Basic error handler with structured output (after routes)
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = typeof err.status === 'number' ? err.status : 500;
    const code = err.code || 'ERR';
    const message = err.message || 'Internal error';
    console.error('[ERROR]', { status, code, message });
    res.status(status).json({ status, code, message });
  });

  app.listen(config.port, () => {
    console.log(`[API] listening on http://localhost:${config.port}`);
  });
}

// Do not crash on bootstrap errors; log and keep process alive for diagnostics
bootstrap().catch((err) => {
  console.error('[BOOTSTRAP ERROR]', err);
});

// Global guards: keep server alive on unexpected errors
process.on('uncaughtException', (err) => {
  try { console.error('[uncaughtException]', err); } catch {}
});
process.on('unhandledRejection', (reason) => {
  try { console.error('[unhandledRejection]', reason); } catch {}
});


