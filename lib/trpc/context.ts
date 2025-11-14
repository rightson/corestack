import { db } from '@/lib/db';
import { verifyToken, type JWTPayload } from '@/lib/auth/jwt';
import { getImpersonationSession } from '@/lib/rbac';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface ContextUser extends JWTPayload {
  // Extend with additional fields if needed
}

export interface ImpersonationInfo {
  isImpersonating: boolean;
  adminUserId?: number; // The original admin user ID
  sessionToken?: string; // The impersonation session token
}

export async function createContext(opts?: {
  headers?: Headers;
  req?: Request;
}) {
  let user: ContextUser | null = null;
  let impersonation: ImpersonationInfo = { isImpersonating: false };

  // Extract token from headers
  const headers = opts?.headers;
  if (headers) {
    const authHeader = headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyToken(token);
      if (payload) {
        user = payload;

        // Check for impersonation token
        const impersonationToken = headers.get('x-impersonation-token');
        if (impersonationToken) {
          const session = await getImpersonationSession(impersonationToken);
          if (session && session.adminUserId === payload.userId) {
            // Valid impersonation session - switch to impersonated user
            const [impersonatedUser] = await db
              .select({
                id: users.id,
                username: users.username,
                email: users.email,
                authType: users.authType,
              })
              .from(users)
              .where(eq(users.id, session.impersonatedUserId))
              .limit(1);

            if (impersonatedUser) {
              user = {
                userId: impersonatedUser.id,
                username: impersonatedUser.username,
                email: impersonatedUser.email,
                authType: impersonatedUser.authType,
              };

              impersonation = {
                isImpersonating: true,
                adminUserId: session.adminUserId,
                sessionToken: impersonationToken,
              };
            }
          }
        }
      }
    }
  }

  return {
    db,
    user,
    impersonation,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
