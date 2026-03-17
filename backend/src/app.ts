import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { env, hasServerAuth } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { dataRouter } from './routes/data.js';
import { healthRouter } from './routes/health.js';
import { integrationsRouter } from './routes/integrations.js';
import { publicRouter } from './routes/public.js';
import { trackingRouter } from './routes/tracking.js';
import { traccarRouter } from './routes/traccar.routes.js';
import { sessionTokenService } from './services/sessionToken.js';

export const createApp = () => {
  const app = express();
  const corsOrigin = env.allowedOrigins.length === 0 ? true : env.allowedOrigins;

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(cors({
    origin: corsOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use('/health', healthRouter);
  app.use('/public', publicRouter);
  app.use('/api/auth', authRouter);

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const auth = req.header('authorization');
    const expectedServiceToken = `Bearer ${env.apiBearerToken}`;

    if (hasServerAuth() && auth === expectedServiceToken) {
      return next();
    }

    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized backend request.' });
    }

    const sessionToken = auth.replace(/^Bearer\s+/i, '').trim();
    const session = sessionTokenService.verify(sessionToken, env.auth.sessionTokenSecret);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }

    next();
  });

  app.use('/api/tracking', trackingRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/traccar', traccarRouter);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Invalid request payload.',
        issues: error.issues
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(500).json({ error: message });
  });

  return app;
};
