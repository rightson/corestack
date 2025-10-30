# LDAP Setup Guide

## Overview

This guide explains how to configure LDAP authentication for the application.

## Supported LDAP Servers

- OpenLDAP
- Active Directory
- FreeIPA
- Other RFC 4511 compatible LDAP servers

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
LDAP_URL=ldap://ldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=uid
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `LDAP_URL` | LDAP server URL | `ldap://ldap.company.com:389` or `ldaps://ldap.company.com:636` (secure) |
| `LDAP_BIND_DN` | Admin user DN for searching | `cn=admin,dc=company,dc=com` |
| `LDAP_BIND_PASSWORD` | Admin user password | `admin_password` |
| `LDAP_SEARCH_BASE` | Base DN for user search | `ou=users,dc=company,dc=com` |
| `LDAP_USERNAME_ATTRIBUTE` | Attribute for username | `uid` (OpenLDAP) or `sAMAccountName` (AD) |

## OpenLDAP Configuration

### Example Configuration

```env
LDAP_URL=ldap://openldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=ou=people,dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=uid
```

### User Entry Example

```ldif
dn: uid=jdoe,ou=people,dc=company,dc=com
objectClass: inetOrgPerson
uid: jdoe
cn: John Doe
sn: Doe
givenName: John
mail: jdoe@company.com
```

## Active Directory Configuration

### Example Configuration

```env
LDAP_URL=ldap://ad.company.com:389
LDAP_BIND_DN=cn=LDAP Admin,cn=Users,dc=company,dc=com
LDAP_BIND_PASSWORD=admin_password
LDAP_SEARCH_BASE=cn=Users,dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=sAMAccountName
```

### User Entry Example

```
dn: CN=John Doe,CN=Users,DC=company,DC=com
objectClass: user
sAMAccountName: jdoe
cn: John Doe
sn: Doe
givenName: John
mail: jdoe@company.com
userPrincipalName: jdoe@company.com
```

## Secure LDAP (LDAPS)

For production, use LDAPS (LDAP over SSL/TLS):

```env
LDAP_URL=ldaps://ldap.company.com:636
```

Ensure your LDAP server has a valid SSL certificate.

## Testing LDAP Connection

### Using ldapsearch (Linux/Mac)

```bash
ldapsearch -x \
  -H ldap://ldap.company.com:389 \
  -D "cn=admin,dc=company,dc=com" \
  -w "admin_password" \
  -b "ou=users,dc=company,dc=com" \
  "(uid=jdoe)"
```

### Using ldp.exe (Windows)

1. Open ldp.exe
2. Connection → Connect
3. Connection → Bind
4. View → Tree
5. Enter search base and verify users are visible

## Auto-Provisioning

When a user logs in via LDAP for the first time:

1. LDAP server authenticates credentials
2. User information is retrieved from LDAP
3. New user account created in local database
4. User information synchronized:
   - Username
   - Full name
   - Email address
   - First name / Last name

### User Record Created

```typescript
{
  username: ldapUser.uid,  // or sAMAccountName for AD
  name: ldapUser.cn,       // Common name
  email: ldapUser.mail,    // Email address
  authType: 'ldap',        // Authentication method
  mustChangePassword: false,
}
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to LDAP server

**Solutions:**
- Verify LDAP_URL is correct
- Check firewall allows port 389 (LDAP) or 636 (LDAPS)
- Verify server is running: `telnet ldap.company.com 389`

### Authentication Failures

**Problem:** Bind fails with invalid credentials

**Solutions:**
- Verify LDAP_BIND_DN format is correct
- Check LDAP_BIND_PASSWORD is correct
- Ensure admin user has search permissions

### User Not Found

**Problem:** User exists in LDAP but login fails

**Solutions:**
- Verify LDAP_SEARCH_BASE includes user's OU
- Check LDAP_USERNAME_ATTRIBUTE matches your LDAP schema
- Use ldapsearch to verify user is findable

### Attribute Mapping

**Problem:** User created but information is incorrect

**Solutions:**
The application extracts these LDAP attributes:
- `uid` or `sAMAccountName` → username
- `cn` or `displayName` → name
- `mail` or `userPrincipalName` → email
- `givenName` → firstName
- `sn` → lastName

Ensure your LDAP entries have these attributes populated.

## Security Recommendations

### Production Checklist

- [ ] Use LDAPS (port 636) instead of LDAP (port 389)
- [ ] Use a dedicated service account for LDAP_BIND_DN
- [ ] Grant minimal permissions to service account (read-only)
- [ ] Rotate LDAP_BIND_PASSWORD regularly
- [ ] Implement IP whitelisting on LDAP server
- [ ] Enable LDAP server audit logging
- [ ] Use strong SSL/TLS ciphers

### Service Account Permissions

The LDAP service account needs:
- ✅ Search/read access to user directory
- ✅ Read access to user attributes
- ❌ Write access (not needed)
- ❌ Admin privileges (not needed)

## Example LDAP Configurations

### Docker OpenLDAP for Testing

```yaml
# docker-compose.yml
services:
  openldap:
    image: osixia/openldap:latest
    environment:
      LDAP_ORGANISATION: "My Company"
      LDAP_DOMAIN: "company.com"
      LDAP_ADMIN_PASSWORD: "admin"
    ports:
      - "389:389"
      - "636:636"
```

Then configure:

```env
LDAP_URL=ldap://localhost:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=admin
LDAP_SEARCH_BASE=dc=company,dc=com
LDAP_USERNAME_ATTRIBUTE=uid
```

## Implementation Details

The LDAP authentication is implemented in `lib/auth/ldap.ts` using the `ldapts` library:

```typescript
import { Client } from 'ldapts';

export async function authenticateLDAP(
  username: string,
  password: string
): Promise<{ success: boolean; userInfo?: any; error?: string }> {
  const client = new Client({
    url: LDAP_URL,
    timeout: 5000,
    connectTimeout: 5000,
  });

  // 1. Bind with admin credentials
  await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

  // 2. Search for user
  const searchResult = await client.search(LDAP_SEARCH_BASE, {
    scope: 'sub',
    filter: `(${LDAP_USERNAME_ATTRIBUTE}=${username})`,
  });

  // 3. Authenticate user with their credentials
  const userDN = searchResult.searchEntries[0].dn;
  await userClient.bind(userDN, password);

  // Extract user info and return
}
```

### Why ldapts?

`ldapts` is a modern TypeScript-native LDAP client that provides:
- Full TypeScript support with native type definitions
- Promise-based API with async/await
- Better performance and maintainability
- Active development and community support
- Improved error handling and security
- **Advanced LDAP queries**: Support for querying mail groups and other directory objects
- Full control over LDAP operations for future extensibility

## Future Enhancements

The `ldapts` library enables advanced LDAP directory queries beyond authentication:

### Mail Group Queries

Query mail groups and distribution lists:

```typescript
import { Client } from 'ldapts';

const client = new Client({ url: LDAP_URL });
await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

// Search for mail groups
const result = await client.search('ou=groups,dc=company,dc=com', {
  scope: 'sub',
  filter: '(objectClass=groupOfNames)',
  attributes: ['cn', 'mail', 'member'],
});

// Get group members
for (const group of result.searchEntries) {
  console.log(`Group: ${group.cn}`);
  console.log(`Email: ${group.mail}`);
  console.log(`Members: ${group.member}`);
}
```

### Group Membership Verification

Check if a user belongs to specific groups:

```typescript
// Search for user's group memberships
const result = await client.search(userDN, {
  scope: 'base',
  filter: '(objectClass=*)',
  attributes: ['memberOf'],
});

const userGroups = result.searchEntries[0].memberOf;
```

### Advanced Directory Queries

The full-featured `ldapts` client enables:
- Organizational unit queries
- Distribution list management
- Directory attribute searches
- Complex filter operations
- Batch operations

## Support

For issues with LDAP configuration:
1. Check LDAP server logs
2. Enable debug logging in the application
3. Use ldapsearch to verify connectivity
4. Consult your LDAP administrator
