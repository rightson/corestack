import { db } from '@/lib/db';
import { sshAccounts, projectSshConfigs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { AESCrypto } from '@/lib/crypto/aes';
import type { SSHAccount } from '@/lib/ssh/types';

interface ResolveInput {
  accountName?: string;
  projectId?: number;
  configAlias?: string;
}

/**
 * Resolve SSH account from multiple input methods
 * Priority: accountName > projectId+configAlias > projectId (default)
 */
export async function resolveSSHAccount(input: ResolveInput): Promise<SSHAccount> {
  // Method 1: Direct account name lookup
  if (input.accountName) {
    const [account] = await db
      .select()
      .from(sshAccounts)
      .where(and(
        eq(sshAccounts.accountName, input.accountName),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!account) {
      throw new Error(`SSH account '${input.accountName}' not found or inactive`);
    }

    return decryptSSHAccount(account);
  }

  // Method 2: Project + config alias resolution
  if (input.projectId && input.configAlias) {
    const [result] = await db
      .select({
        account: sshAccounts,
        config: projectSshConfigs,
      })
      .from(projectSshConfigs)
      .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
      .where(and(
        eq(projectSshConfigs.projectId, input.projectId),
        eq(projectSshConfigs.configAlias, input.configAlias),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!result) {
      throw new Error(
        `No SSH config found for project ${input.projectId} with alias '${input.configAlias}'`
      );
    }

    return decryptSSHAccount(result.account, result.config.overrideBasePath);
  }

  // Method 3: Project default account
  if (input.projectId) {
    const [result] = await db
      .select({
        account: sshAccounts,
        config: projectSshConfigs,
      })
      .from(projectSshConfigs)
      .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
      .where(and(
        eq(projectSshConfigs.projectId, input.projectId),
        eq(projectSshConfigs.isDefault, true),
        eq(sshAccounts.isActive, true)
      ))
      .limit(1);

    if (!result) {
      throw new Error(
        `No default SSH account configured for project ${input.projectId}`
      );
    }

    return decryptSSHAccount(result.account, result.config.overrideBasePath);
  }

  // No valid resolution method provided
  throw new Error(
    'Must provide either accountName, or projectId with optional configAlias'
  );
}

/**
 * Decrypt SSH account credentials
 */
function decryptSSHAccount(account: any, overrideBasePath?: string | null): SSHAccount {
  return {
    id: account.id,
    accountName: account.accountName,
    host: account.host,
    port: account.port || 22,
    username: account.username,
    password: account.encryptedPassword
      ? AESCrypto.decrypt(account.encryptedPassword)
      : undefined,
    privateKey: account.encryptedPrivateKey
      ? AESCrypto.decrypt(account.encryptedPrivateKey)
      : undefined,
    passphrase: account.encryptedPassphrase
      ? AESCrypto.decrypt(account.encryptedPassphrase)
      : undefined,
    basePath: overrideBasePath || account.basePath || undefined,
    timeout: account.timeout || 30000,
  };
}
