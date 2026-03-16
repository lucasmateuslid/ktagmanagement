import { Router } from 'express';

const publicGoogleMapsKey = process.env.VITE_GOOGLE_MAPS_PUBLIC_KEY || process.env.PUBLIC_GOOGLE_MAPS_KEY || '';

export const publicRouter = Router();

publicRouter.get('/config', (_req, res) => {
  res.json({
    maps: {
      googleMapsPublicKey: publicGoogleMapsKey
    }
  });
});
