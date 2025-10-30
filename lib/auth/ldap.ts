import { Client } from 'ldapts';
import type { SearchResult, Entry } from 'ldapts';

interface LDAPConfig {
  url: string;
  bindDN: string;
  bindPassword: string;
  searchBase: string;
  usernameAttribute: string;
  username: string;
}

interface UserInfo {
  username: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

function getLDAPConfig(username: string): LDAPConfig {
  return {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    bindDN: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com',
    usernameAttribute: process.env.LDAP_USERNAME_ATTRIBUTE || 'uid',
    username,
  };
}

export async function authenticateLDAP(
  username: string,
  password: string
): Promise<{ success: boolean; userInfo?: UserInfo; error?: string }> {
  const config = getLDAPConfig(username);

  // If LDAP is not configured, return error
  if (!config.url || !config.bindDN || !config.searchBase) {
    return {
      success: false,
      error: 'LDAP is not configured',
    };
  }

  const client = new Client({
    url: config.url,
    timeout: 5000,
    connectTimeout: 5000,
  });

  try {
    // First, bind with admin credentials to search for the user
    await client.bind(config.bindDN, config.bindPassword);

    // Search for the user
    const searchOptions = {
      scope: 'sub' as const,
      filter: `(${config.usernameAttribute}=${username})`,
      attributes: [
        'uid',
        'sAMAccountName',
        'cn',
        'displayName',
        'mail',
        'userPrincipalName',
        'givenName',
        'sn',
        'dn',
      ],
    };

    const searchResult: SearchResult = await client.search(
      config.searchBase,
      searchOptions
    );

    if (!searchResult.searchEntries || searchResult.searchEntries.length === 0) {
      await client.unbind();
      return {
        success: false,
        error: 'User not found',
      };
    }

    const userEntry: Entry = searchResult.searchEntries[0];
    const userDN = String(userEntry.dn);

    // Unbind admin connection
    await client.unbind();

    // Now try to bind with the user's credentials to verify password
    const userClient = new Client({
      url: config.url,
      timeout: 5000,
      connectTimeout: 5000,
    });

    try {
      await userClient.bind(userDN, password);
      await userClient.unbind();
    } catch {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Extract user information from LDAP response
    // Entry properties are string-indexed and can be string, string[], Buffer, or Buffer[]
    const getStringValue = (value: string | string[] | Buffer | Buffer[]): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        return typeof first === 'string' ? first : first.toString();
      }
      if (Buffer.isBuffer(value)) return value.toString();
      return '';
    };

    const userInfo: UserInfo = {
      username: getStringValue(userEntry.uid || userEntry.sAMAccountName || username),
      name: getStringValue(userEntry.cn || userEntry.displayName || username),
      email: getStringValue(userEntry.mail || userEntry.userPrincipalName || `${username}@example.com`),
      firstName: userEntry.givenName ? getStringValue(userEntry.givenName) : undefined,
      lastName: userEntry.sn ? getStringValue(userEntry.sn) : undefined,
    };

    return {
      success: true,
      userInfo,
    };
  } catch (error: unknown) {
    // Make sure to unbind on error
    try {
      await client.unbind();
    } catch {
      // Ignore unbind errors
    }

    console.error('LDAP authentication error:', error);
    const errorMessage = error instanceof Error ? error.message : 'LDAP authentication failed';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
