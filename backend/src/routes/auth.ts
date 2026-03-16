import { createHash } from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { firestore } from '../services/firestore.js';
import { sessionTokenService } from '../services/sessionToken.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const hashPassword = (plainPassword: string) =>
  createHash('sha256').update(`${plainPassword}${env.auth.passwordPepper}`).digest('hex');

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.trim().toLowerCase();

    const usersSnapshot = await firestore
      .collection('ktag_users_db')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data() as Record<string, unknown>;
    const storedPassword = (userData.password as string | undefined) ?? '';

    const hashedPassword = hashPassword(payload.password);
    const plainPasswordMatch = storedPassword === payload.password;
    const hashedPasswordMatch = storedPassword === hashedPassword;

    if (!plainPasswordMatch && !hashedPasswordMatch) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    if (plainPasswordMatch && !hashedPasswordMatch) {
      await userDoc.ref.update({ password: hashedPassword });
    }

    const userStatus = (userData.status as string | undefined) ?? 'pending';
    if (userStatus !== 'approved' && email !== env.auth.adminEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Seu acesso está pendente de aprovação.' });
    }

    const user = {
      id: String(userData.id || userDoc.id),
      name: String(userData.name || ''),
      email,
      role: (userData.role as string | undefined) ?? 'user',
      status: userStatus,
      companySlug: (userData.companySlug as string | undefined) ?? undefined,
      avatarInitial: (userData.avatarInitial as string | undefined) ?? undefined
    };

    const token = sessionTokenService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        name: user.name,
        companySlug: user.companySlug
      },
      env.auth.sessionTokenSecret,
      env.auth.sessionTtlSeconds
    );

    return res.json({ token, user });
  } catch (error) {
    next(error);
  }
});
