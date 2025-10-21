# Authentication Flow

## Login and Token Management

This document details how authentication works in the application.

### Authentication Flow Diagram

```
Login Page (app/login/page.tsx)
    │
    │ User enters Email/Password or LDAP credentials
    │ Form submission
    ▼
Auth Service (lib/auth/*)
    │
    ├─── Email/Password ────► Hash comparison
    │                          │
    │                          ▼
    │                      PostgreSQL (lib/db/schema.ts: users table)
    │                          │
    │                          │ Verify hashed password (bcrypt)
    │                          ▼
    │
    └─── LDAP ──────────────► LDAP Server
                                │
                                │ Bind and authenticate
                                │ Configured via LDAP_* env vars
                                ▼
    │
    ▼
Generate JWT Token (lib/auth/jwt.ts)
    │
    │ jwt.sign({ userId, email }, JWT_SECRET)
    │ Token expires in configured time (default: 7 days)
    ▼
Return Token to Client
    │
    │ Store in localStorage
    │ Include in subsequent requests
    ▼
Subsequent Requests Include Token (Authorization header)
    │
    │ tRPC Context Middleware (lib/trpc/trpc.ts)
    │ Extracts and verifies token
    ▼
Verify Token & Attach User to Context
    │
    │ ctx.user = { userId, email, authType }
    │ Available in all protectedProcedure handlers
    ▼
Protected routes can access ctx.user
```

## Authentication Methods

### 1. Email/Password Authentication

**Login Process:**

1. User enters username and password
2. Server queries database for user by username
3. Compares provided password with stored bcrypt hash
4. If match, generates JWT token
5. Token returned to client

**Password Storage:**

Passwords are hashed using bcrypt before storage:

```typescript
import bcrypt from 'bcryptjs';

// Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. LDAP Authentication

**Login Process:**

1. User enters LDAP credentials
2. Server attempts to bind to LDAP server with admin credentials
3. Searches for user in LDAP directory
4. Attempts to bind as the user with provided password
5. On success, syncs user info to local database
6. Generates JWT token
7. Token returned to client

**Configuration:**

```env
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=uid  # or sAMAccountName for AD
```

**Auto-Provisioning:**

LDAP users are automatically created in the local database on first login with information from LDAP:

```typescript
{
  username: ldapUser.uid,
  name: ldapUser.cn,
  email: ldapUser.mail,
  authType: 'ldap',
  mustChangePassword: false,
}
```

## JWT Token Management

### Token Generation

```typescript
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const token = await new SignJWT({
  userId: user.id,
  username: user.username,
  email: user.email,
  authType: user.authType,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(secret);
```

### Token Verification

```typescript
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

try {
  const { payload } = await jwtVerify(token, secret);
  return payload; // { userId, username, email, authType }
} catch (error) {
  return null; // Invalid or expired token
}
```

### Token Storage

**Client-Side:**

```typescript
// Store token
localStorage.setItem('authToken', token);

// Retrieve token
const token = localStorage.getItem('authToken');

// Clear token on logout
localStorage.removeItem('authToken');
```

### Token Usage

**In tRPC Requests:**

Token is automatically included in context via middleware:

```typescript
// lib/trpc/trpc.ts
export const createContext = async ({ req }) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return { user: null };
  }

  const user = await verifyToken(token);
  return { user };
};
```

## Protected Procedures

### Definition

```typescript
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      user: ctx.user, // Non-null user guaranteed
    },
  });
});
```

### Usage

```typescript
export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // ctx.user is guaranteed to be non-null
    return await db.select()
      .from(users)
      .where(eq(users.id, ctx.user.userId));
  }),
});
```

## First Login Flow

### Must Change Password

Some users (like the default `root` user) have `mustChangePassword: true`:

1. User logs in with initial password
2. Server returns token with `mustChangePassword: true`
3. Client shows password change form
4. User sets new password
5. Server updates password and sets `mustChangePassword: false`
6. User can now access the application

### Password Change Process

```typescript
// Verify old token
const payload = await verifyToken(oldToken);

// Hash new password
const hashedPassword = await hashPassword(newPassword);

// Update in database
await db.update(users)
  .set({
    password: hashedPassword,
    mustChangePassword: false,
  })
  .where(eq(users.id, payload.userId));
```

## Default Credentials

The seed script creates a default user:

```typescript
{
  username: 'root',
  password: 'Must-Changed',  // Hashed with bcrypt
  mustChangePassword: true,
}
```

## Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET` to a long random string
- [ ] Use HTTPS in production
- [ ] Implement rate limiting on login attempts
- [ ] Add CSRF protection
- [ ] Set secure cookie flags
- [ ] Implement session timeout
- [ ] Add audit logging
- [ ] Enable MFA (recommended)
- [ ] Use secure LDAP (LDAPS) if using LDAP

### Token Expiration

Tokens expire after 7 days by default. Adjust in `lib/auth/jwt.ts`:

```typescript
.setExpirationTime('7d') // Change to desired duration
```

### Password Requirements

Current implementation requires:
- Minimum 8 characters for password changes

Consider adding:
- Uppercase/lowercase requirements
- Number requirements
- Special character requirements
- Password history checking
