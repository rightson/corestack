import { authenticate } from 'ldap-authentication';

interface LDAPConfig {
  url: string;
  bindDN: string;
  bindPassword: string;
  searchBase: string;
  usernameAttribute: string;
  username: string;
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
): Promise<{ success: boolean; userInfo?: any; error?: string }> {
  const config = getLDAPConfig(username);

  // If LDAP is not configured, return error
  if (!config.url || !config.bindDN || !config.searchBase) {
    return {
      success: false,
      error: 'LDAP is not configured',
    };
  }

  try {
    // Authenticate using ldap-authentication
    const ldapUser = await authenticate({
      ldapOpts: {
        url: config.url,
      },
      adminDn: config.bindDN,
      adminPassword: config.bindPassword,
      userSearchBase: config.searchBase,
      usernameAttribute: config.usernameAttribute,
      username: username,
      userPassword: password,
    });

    if (!ldapUser) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Extract user information from LDAP response
    const userInfo = {
      username: ldapUser.uid || ldapUser.sAMAccountName || username,
      name: ldapUser.cn || ldapUser.displayName || username,
      email: ldapUser.mail || ldapUser.userPrincipalName || `${username}@example.com`,
      firstName: ldapUser.givenName,
      lastName: ldapUser.sn,
    };

    return {
      success: true,
      userInfo,
    };
  } catch (error: any) {
    console.error('LDAP authentication error:', error);
    return {
      success: false,
      error: error.message || 'LDAP authentication failed',
    };
  }
}
