import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'noteyou_super_secure_jwt_secret_key_2026';

export interface AuthUserPayload {
  sub: string; // userId
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'user';
  iat?: number;
  exp?: number;
}

export function verifyAuthToken(req: any): AuthUserPayload | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

export function generateJwtToken(user: { id: string; name: string; email: string; role: string }, expiresIn = '7d'): string {
  const payload: AuthUserPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as any
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
