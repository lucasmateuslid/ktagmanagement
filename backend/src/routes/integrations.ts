import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requestJson } from '../services/http.js';
import { createTraccarApi } from '../services/traccar.js';
import { traccarInstancesService } from '../services/traccarInstances.js';

const searchVehicleSchema = z.object({
  query: z.string().min(7)
});

const plateLookupSchema = z.object({
  plate: z.string().min(7).max(8)
});

const traccarInstanceSchema = z.object({
  name: z.string().min(1),
  companySlug: z.string().min(1),
  url: z.string().url(),
  user: z.string().min(1),
  pass: z.string().min(1).optional(),
  active: z.boolean().optional()
});

const traccarInstanceUpdateSchema = traccarInstanceSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Nenhum campo enviado para atualização.'
});

let cachedHinovaUserToken: string | null = null;
let authPromise: Promise<string> | null = null;

const formatBearerToken = (token: string) => {
  if (!token) return '';
  const raw = token.trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
  return `Bearer ${raw}`;
};

const normalizeVehicleType = (rawType: string) => {
  const normalized = rawType.toUpperCase();
  if (normalized.includes('MOTO') || normalized.includes('CICL')) return 'motos';
  if (normalized.includes('CAMIN') || normalized.includes('TRUCK')) return 'caminhoes';
  return 'carros';
};

const adminRoles = new Set(['admin', 'moderator']);

const ensureAdmin = (req: Request, res: Response) => {
  if (!adminRoles.has(req.authSession?.role ?? '')) {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
};

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value || '');

const authenticateHinova = async (): Promise<string> => {
  if (!env.hinova.token || !env.hinova.user || !env.hinova.pass) {
    throw new Error('Hinova provider not configured in backend environment.');
  }

  const baseUrl = env.hinova.baseUrl.replace(/\/$/, '');
  const authUrl = `${baseUrl}/usuario/autenticar`;

  const data = await requestJson<{ token_usuario?: string; mensagem?: string }>(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: formatBearerToken(env.hinova.token)
    },
    json: {
      usuario: env.hinova.user.trim(),
      senha: env.hinova.pass.trim()
    }
  });

  if (!data.token_usuario) {
    throw new Error(data.mensagem || 'Hinova token not returned by provider.');
  }

  return data.token_usuario;
};

const getHinovaUserToken = async () => {
  if (cachedHinovaUserToken) return cachedHinovaUserToken;
  if (!authPromise) {
    authPromise = authenticateHinova()
      .then((token) => {
        cachedHinovaUserToken = token;
        authPromise = null;
        return token;
      })
      .catch((error) => {
        authPromise = null;
        cachedHinovaUserToken = null;
        throw error;
      });
  }
  return authPromise;
};

export const integrationsRouter = Router();

integrationsRouter.get('/traccar/instances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const data = await traccarInstancesService.listSafe();
    return res.json(data);
  } catch (error) {
    next(error);
  }
});

integrationsRouter.post('/traccar/instances', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const payload = traccarInstanceSchema.parse(req.body);
    const created = await traccarInstancesService.upsert(null, payload);
    return res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

integrationsRouter.patch('/traccar/instances/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = firstParam(req.params.id);
    const payload = traccarInstanceUpdateSchema.parse(req.body);

    const existing = await traccarInstancesService.getSafeById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Instância não encontrada.' });
    }

    const updated = await traccarInstancesService.upsert(id, {
      name: payload.name ?? existing.name,
      companySlug: payload.companySlug ?? existing.companySlug,
      url: payload.url ?? existing.url,
      user: payload.user ?? existing.user,
      pass: payload.pass,
      active: payload.active ?? existing.active,
    });

    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

integrationsRouter.delete('/traccar/instances/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = firstParam(req.params.id);
    await traccarInstancesService.delete(id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

integrationsRouter.post('/traccar/instances/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const id = firstParam(req.params.id);

    const instance = await traccarInstancesService.getSafeById(id);
    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada.' });
    }

    const config = await traccarInstancesService.resolveConnectionConfigById(id);
    const api = createTraccarApi(config);
    const info = await api.getServerInfo();

    return res.json({ ok: true, server: info });
  } catch (error: any) {
    return res.status(502).json({ ok: false, error: error?.message ?? 'Falha ao testar instância.' });
  }
});

integrationsRouter.post('/hinova/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = searchVehicleSchema.parse(req.body);
    const normalizedQuery = query.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const searchType = normalizedQuery.length === 7 ? 'placa' : 'chassi';
    const baseUrl = env.hinova.baseUrl.replace(/\/$/, '');

    let userToken = await getHinovaUserToken();

    const executeSearch = async (token: string) => requestJson<any[]>(`${baseUrl}/veiculo/buscar/${normalizedQuery}/${searchType}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: formatBearerToken(token)
      }
    });

    let data: any[];
    try {
      data = await executeSearch(userToken);
    } catch (error: any) {
      if ((error?.message || '').includes('401')) {
        cachedHinovaUserToken = null;
        userToken = await authenticateHinova();
        cachedHinovaUserToken = userToken;
        data = await executeSearch(userToken);
      } else {
        throw error;
      }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.json(null);
    }

    const item = data[0] || {};
    return res.json({
      client: {
        name: item.nome,
        cpf: item.cpf,
        phone: item.telefone_celular ? `(${item.ddd_celular}) ${item.telefone_celular}` : (item.telefone ? `(${item.ddd}) ${item.telefone}` : ''),
        email: item.email,
        address: [item.logradouro, item.numero, item.bairro].filter(Boolean).join(', '),
        city: item.cidade,
        state: item.estado,
        createdAt: Date.now()
      },
      vehicle: {
        plate: item.placa,
        chassis: item.chassi,
        model: [item.marca, item.modelo].filter(Boolean).join(' '),
        year: item.ano_modelo,
        fipeCode: item.codigo_fipe,
        hinovaId: item.codigo_veiculo,
        typeHint: normalizeVehicleType(String(item.tipo || '')),
        status: 'active'
      },
      price: item.valor_fipe
    });
  } catch (error) {
    next(error);
  }
});

integrationsRouter.get('/plate/:plate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { plate } = plateLookupSchema.parse(req.params);
    const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (!env.plateApi.url) {
      return res.status(503).json({ error: 'Plate lookup provider not configured in backend environment.' });
    }

    const targetUrl = env.plateApi.url.replace('{plate}', cleanPlate);
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (env.plateApi.token) {
      headers.Authorization = `Bearer ${env.plateApi.token}`;
    }

    const data = await requestJson<any>(targetUrl, {
      method: 'GET',
      headers
    });

    const brand = data.marca || data.brand || 'Unknown';
    const model = data.modelo || data.model || 'Unknown';
    const rawType = (data.tipo_veiculo || data.extra?.tipo_veiculo || data.segmento || '').toString().toLowerCase();

    return res.json({
      plate: cleanPlate,
      brand,
      model: `${brand} ${model}`,
      year: String(data.ano || data.anoModelo || data.year || ''),
      color: data.cor || data.color || '',
      chassis: data.chassi || data.chassis,
      fipeCode: data.fipe_codigo || data.codigoFipe || '',
      found: true,
      typeHint: rawType
    });
  } catch (error: any) {
    if ((error?.message || '').includes('404')) {
      return res.json({ plate: req.params.plate, brand: '', model: '', year: '', color: '', found: false, typeHint: '' });
    }

    next(error);
  }
});
