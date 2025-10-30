# Authentication

## Overview

The application supports two authentication methods for maximum flexibility:

1. **Email/Password** - Traditional username/password authentication with bcrypt hashing
2. **LDAP** - Enterprise directory authentication with auto-provisioning

## Quick Start

### Default Credentials

```
Username: root
Password: Must-Changed
```

**Note:** You will be prompted to change the password on first login.

## Authentication Methods

### Email/Password

Local database authentication:
- Passwords hashed with bcrypt
- Stored in PostgreSQL users table
- Supports password change flow

### LDAP

Enterprise directory authentication:
- Supports OpenLDAP and Active Directory
- Auto-creates user accounts on first login
- Syncs user information from LDAP

### Configuration

Set in `.env`:

```env
# JWT Secret (required)
JWT_SECRET=your-secret-key-change-in-production

# LDAP (optional)
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=uid  # or sAMAccountName for AD
```

## Token Management

### JWT Tokens

- Generated on successful login
- Stored in localStorage
- Default expiration: 7 days
- Included in all authenticated requests

### Usage

```typescript
// Login returns token
const { token } = await trpc.auth.login.mutate({
  username: 'user',
  password: 'pass',
  authType: 'email',
});

// Store token
localStorage.setItem('authToken', token);

// Token automatically included in subsequent requests
```

## Protected Routes

### Client-Side Protection

Pages check for authentication token:

```typescript
useEffect(() => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    router.push('/login');
  }
}, [router]);
```

### Server-Side Protection

tRPC procedures use `protectedProcedure`:

```typescript
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});
```

## First Login

Users with `mustChangePassword: true`:
1. Log in with initial password
2. See password change form
3. Set new password (min 8 characters)
4. Access application

## Detailed Documentation

For more details, see:
- [Login Verification](./authentication/login-verification.md) - Complete login flow verification
- [Authentication Flow](../architecture/auth-flow.md) - Detailed authentication diagrams
- [LDAP Setup](./authentication/ldap-setup.md) - LDAP configuration guide

## Security Best Practices

### Production Checklist

✅ Change `JWT_SECRET` to a strong random value
✅ Use HTTPS in production
✅ Implement rate limiting on login attempts
✅ Add CSRF protection
✅ Use LDAPS (secure LDAP) if using LDAP
✅ Implement session timeout
✅ Add audit logging for authentication events
✅ Consider implementing MFA

### Password Requirements

- Minimum 8 characters for password changes
- Consider adding complexity requirements in production

## API Reference

### Login

```typescript
trpc.auth.login.mutate({
  username: string,
  password: string,
  authType: 'email' | 'ldap',
})
```

### Change Password

```typescript
trpc.auth.changePassword.mutate({
  token: string,
  newPassword: string,
})
```

### Verify Token

```typescript
trpc.auth.verifyToken.query({
  token: string,
})
```
