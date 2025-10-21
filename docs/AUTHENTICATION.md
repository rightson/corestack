# Authentication Guide

## Overview

The application supports two authentication methods:
1. **Email/Password** - Traditional email-based authentication
2. **LDAP** - Enterprise LDAP authentication

## Default Credentials

- Username: `root`
- Password: `Must-Changed` (must be changed on first login)

## Email/Password Authentication

### Login Flow
1. User enters email and password
2. Server validates credentials against database
3. JWT token is generated and returned
4. Client stores token for subsequent requests

### Password Hashing
Passwords are hashed using bcrypt before storage.

## LDAP Authentication

### Configuration

Set LDAP environment variables in `.env`:

```env
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
```

### Login Flow
1. User enters username and password
2. Application attempts to bind to LDAP server
3. If successful, user is authenticated
4. User profile is synced with local database
5. JWT token is generated and returned

## JWT Tokens

### Token Generation
```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET!,
  { expiresIn: '7d' }
);
```

### Token Verification
Tokens are verified in tRPC context middleware.

## Protected Routes

### Client-Side Protection
Use Next.js middleware to protect routes:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### Server-Side Protection
Use tRPC protected procedures:

```typescript
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});
```

## Environment Variables

```env
JWT_SECRET=your-secret-key-change-in-production-make-it-long-and-random
```

**Important**: Change `JWT_SECRET` in production to a long, random string.
