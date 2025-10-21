import ldap from 'ldapjs';

interface LDAPConfig {
  url: string;
  bindDN: string;
  bindPassword: string;
  searchBase: string;
}

function getLDAPConfig(): LDAPConfig {
  return {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    bindDN: process.env.LDAP_BIND_DN || '',
    bindPassword: process.env.LDAP_BIND_PASSWORD || '',
    searchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=example,dc=com',
  };
}

export async function authenticateLDAP(
  username: string,
  password: string
): Promise<{ success: boolean; userInfo?: any; error?: string }> {
  const config = getLDAPConfig();

  // If LDAP is not configured, return error
  if (!config.url || !config.bindDN || !config.searchBase) {
    return {
      success: false,
      error: 'LDAP is not configured',
    };
  }

  return new Promise((resolve) => {
    const client = ldap.createClient({
      url: config.url,
    });

    // First, bind with admin credentials to search for the user
    client.bind(config.bindDN, config.bindPassword, (err) => {
      if (err) {
        client.unbind();
        return resolve({
          success: false,
          error: 'LDAP bind failed',
        });
      }

      // Search for the user
      const searchOptions = {
        filter: `(uid=${username})`,
        scope: 'sub' as const,
        attributes: ['uid', 'cn', 'mail', 'sn', 'givenName'],
      };

      client.search(config.searchBase, searchOptions, (err, res) => {
        if (err) {
          client.unbind();
          return resolve({
            success: false,
            error: 'LDAP search failed',
          });
        }

        let userDN: string | null = null;
        let userInfo: any = null;

        res.on('searchEntry', (entry) => {
          userDN = entry.objectName;
          userInfo = {
            username: entry.object.uid,
            name: entry.object.cn,
            email: entry.object.mail,
            firstName: entry.object.givenName,
            lastName: entry.object.sn,
          };
        });

        res.on('error', () => {
          client.unbind();
          resolve({
            success: false,
            error: 'LDAP search error',
          });
        });

        res.on('end', () => {
          if (!userDN) {
            client.unbind();
            return resolve({
              success: false,
              error: 'User not found',
            });
          }

          // Try to bind as the user to verify password
          const userClient = ldap.createClient({
            url: config.url,
          });

          userClient.bind(userDN, password, (err) => {
            userClient.unbind();
            client.unbind();

            if (err) {
              return resolve({
                success: false,
                error: 'Invalid credentials',
              });
            }

            resolve({
              success: true,
              userInfo,
            });
          });
        });
      });
    });
  });
}
