import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requestJson } from '../services/http.js';

const ktagRequestSchema = z.object({
  accessoryId: z.string().min(1),
  hashedKeys: z.array(z.string().min(1)).min(1),
  privateKeys: z.array(z.string().min(1)).min(1)
});

const reverseGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180)
});

const xadtagHistorySchema = z.object({
  id: z.string().min(1),
  timeFrom: z.string().min(1),
  timeTo: z.string().min(1)
});

const xadtagIdSchema = z.object({
  id: z.string().min(1)
});

const xadtagActivateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

export const trackingRouter = Router();

trackingRouter.post('/ktag/location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = ktagRequestSchema.parse(req.body);

    if (!env.ktag.url || !env.ktag.user || !env.ktag.pass) {
      return res.status(503).json({ error: 'K-Tag provider not configured in backend environment.' });
    }

    const authHeader = `Basic ${Buffer.from(`${env.ktag.user}:${env.ktag.pass}`).toString('base64')}`;

    const data = await requestJson<unknown>(env.ktag.url, {
      method: 'POST',
      headers: {
        Authorization: authHeader
      },
      json: {
        accessoryId: payload.accessoryId,
        hashed_keys: payload.hashedKeys,
        priv_keys: payload.privateKeys
      }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

trackingRouter.get('/xadtag/tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = xadtagIdSchema.parse(req.query);

    if (!env.xadtag.apiToken) {
      return res.status(503).json({ error: 'Xadtag provider not configured in backend environment.' });
    }

    const targetUrl = new URL('/tag', env.xadtag.baseUrl);
    targetUrl.searchParams.set('ids', id);

    const data = await requestJson<unknown>(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        api_token: env.xadtag.apiToken,
        timestamp: Math.floor(Date.now() / 1000).toString()
      }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

trackingRouter.patch('/xadtag/tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = xadtagActivateSchema.parse(req.body);

    if (!env.xadtag.apiToken) {
      return res.status(503).json({ error: 'Xadtag provider not configured in backend environment.' });
    }

    const targetUrl = new URL('/tag', env.xadtag.baseUrl);

    const data = await requestJson<unknown>(targetUrl.toString(), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        api_token: env.xadtag.apiToken,
        timestamp: Math.floor(Date.now() / 1000).toString()
      },
      json: body.ids
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

trackingRouter.get('/xadtag/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = xadtagHistorySchema.parse(req.query);

    if (!env.xadtag.apiToken) {
      return res.status(503).json({ error: 'Xadtag provider not configured in backend environment.' });
    }

    const targetUrl = new URL('/tag/history', env.xadtag.baseUrl);
    targetUrl.searchParams.set('Id', query.id);
    targetUrl.searchParams.set('TimeFrom', query.timeFrom);
    targetUrl.searchParams.set('TimeTo', query.timeTo);

    const data = await requestJson<unknown>(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        api_token: env.xadtag.apiToken,
        timestamp: Math.floor(Date.now() / 1000).toString()
      }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

trackingRouter.post('/geocode/reverse', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon } = reverseGeocodeSchema.parse(req.body);

    if (!env.googleMapsServerKey) {
      return res.status(503).json({ error: 'Google Maps server key not configured in backend environment.' });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lon}`);
    url.searchParams.set('key', env.googleMapsServerKey);

    const data = await requestJson<{ status?: string; results?: Array<{ formatted_address?: string }> }>(url.toString(), {
      method: 'GET'
    });

    res.json({
      address: data.results?.[0]?.formatted_address ?? `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      provider: 'google-maps'
    });
  } catch (error) {
    next(error);
  }
});
