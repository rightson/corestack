import { db } from '@/lib/db';
import { verifyToken, type JWTPayload } from '@/lib/auth/jwt';

export interface ContextUser extends JWTPayload {
  // Extend with additional fields if needed
}

export async function createContext(opts?: {
  headers?: Headers;
  req?: Request;
}) {
  let user: ContextUser | null = null;

  // Extract token from headers
  const headers = opts?.headers;
  if (headers) {
    const authHeader = headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyToken(token);
      if (payload) {
        user = payload;
      }
    }
  }

  return {
    db,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
