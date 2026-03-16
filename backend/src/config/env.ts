import 'dotenv/config';

const requiredInProduction = (value: string | undefined, key: string) => {
  if (process.env.NODE_ENV === 'production' && !value) {
    throw new Error(`Missing required env: ${key}`);
  }

  return value ?? '';
};

const parseOrigins = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8080),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  apiBearerToken: process.env.API_BEARER_TOKEN ?? '',
  auth: {
    adminEmail: process.env.ADMIN_EMAIL ?? 'lucasmateus.lima@outlook.com',
    passwordPepper: process.env.AUTH_PASSWORD_PEPPER ?? 'KTAG_SECURE_SALT_V3_2025',
    sessionTokenSecret: process.env.SESSION_TOKEN_SECRET ?? 'dev-session-secret-change-me',
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 43200)
  },
  ktag: {
    url: process.env.K_TAG_API_URL ?? '',
    user: requiredInProduction(process.env.K_TAG_API_USER, 'K_TAG_API_USER'),
    pass: requiredInProduction(process.env.K_TAG_API_PASS, 'K_TAG_API_PASS')
  },
  xadtag: {
    baseUrl: process.env.XADTAG_BASE_URL ?? 'http://www.brgps.com/open',
    apiToken: requiredInProduction(process.env.XADTAG_API_TOKEN, 'XADTAG_API_TOKEN')
  },
  googleMapsServerKey: process.env.GOOGLE_MAPS_SERVER_KEY ?? '',
  plateApi: {
    url: process.env.PLATE_API_URL ?? '',
    token: process.env.PLATE_API_TOKEN ?? ''
  },
  hinova: {
    baseUrl: process.env.HINOVA_BASE_URL ?? 'https://api.hinova.com.br/api/sga/v2',
    token: process.env.HINOVA_TOKEN ?? '',
    user: process.env.HINOVA_USER ?? '',
    pass: process.env.HINOVA_PASS ?? ''
  }
};

export const hasServerAuth = () => Boolean(env.apiBearerToken);
