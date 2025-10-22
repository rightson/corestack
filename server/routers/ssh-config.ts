import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { sshAccounts, projectSshConfigs, sshErrorNotifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth/jwt';
import { AESCrypto } from '@/lib/crypto/aes';

export const sshConfigRouter = router({
  // Create new SSH account
  createAccount: publicProcedure
    .input(
      z.object({
        token: z.string(),
        accountName: z.string().min(1),
        host: z.string().min(1),
        port: z.number().int().positive().default(22),
        username: z.string().min(1),
        password: z.string().optional(),
        privateKey: z.string().optional(),
        passphrase: z.string().optional(),
        authMethod: z.enum(['password', 'key']),
        basePath: z.string().optional(),
        timeout: z.number().int().positive().default(30000),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // Validate auth method
      if (input.authMethod === 'password' && !input.password) {
        throw new Error('Password is required for password authentication');
      }
      if (input.authMethod === 'key' && !input.privateKey) {
        throw new Error('Private key is required for key authentication');
      }

      const [account] = await ctx.db
        .insert(sshAccounts)
        .values({
          accountName: input.accountName,
          host: input.host,
          port: input.port,
          username: input.username,
          encryptedPassword: input.password ? AESCrypto.encrypt(input.password) : null,
          encryptedPrivateKey: input.privateKey ? AESCrypto.encrypt(input.privateKey) : null,
          encryptedPassphrase: input.passphrase ? AESCrypto.encrypt(input.passphrase) : null,
          authMethod: input.authMethod,
          basePath: input.basePath || null,
          timeout: input.timeout,
          description: input.description || null,
          createdBy: payload.userId,
        })
        .returning();

      return { success: true, account: { id: account.id, accountName: account.accountName } };
    }),

  // Update SSH account
  updateAccount: publicProcedure
    .input(
      z.object({
        token: z.string(),
        accountId: z.number().int().positive(),
        host: z.string().min(1).optional(),
        port: z.number().int().positive().optional(),
        username: z.string().min(1).optional(),
        password: z.string().optional(),
        privateKey: z.string().optional(),
        passphrase: z.string().optional(),
        basePath: z.string().optional(),
        timeout: z.number().int().positive().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const updates: any = {};
      if (input.host) updates.host = input.host;
      if (input.port) updates.port = input.port;
      if (input.username) updates.username = input.username;
      if (input.password) updates.encryptedPassword = AESCrypto.encrypt(input.password);
      if (input.privateKey) updates.encryptedPrivateKey = AESCrypto.encrypt(input.privateKey);
      if (input.passphrase) updates.encryptedPassphrase = AESCrypto.encrypt(input.passphrase);
      if (input.basePath !== undefined) updates.basePath = input.basePath || null;
      if (input.timeout) updates.timeout = input.timeout;
      if (input.description !== undefined) updates.description = input.description || null;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await ctx.db
        .update(sshAccounts)
        .set(updates)
        .where(eq(sshAccounts.id, input.accountId));

      return { success: true };
    }),

  // Delete SSH account
  deleteAccount: publicProcedure
    .input(
      z.object({
        token: z.string(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      await ctx.db.delete(sshAccounts).where(eq(sshAccounts.id, input.accountId));

      return { success: true };
    }),

  // List all SSH accounts
  listAccounts: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const accounts = await ctx.db
        .select({
          id: sshAccounts.id,
          accountName: sshAccounts.accountName,
          host: sshAccounts.host,
          port: sshAccounts.port,
          username: sshAccounts.username,
          authMethod: sshAccounts.authMethod,
          basePath: sshAccounts.basePath,
          timeout: sshAccounts.timeout,
          description: sshAccounts.description,
          isActive: sshAccounts.isActive,
          createdAt: sshAccounts.createdAt,
        })
        .from(sshAccounts)
        .orderBy(desc(sshAccounts.createdAt));

      return accounts;
    }),

  // Link SSH account to project
  linkToProject: publicProcedure
    .input(
      z.object({
        token: z.string(),
        projectId: z.number().int().positive(),
        sshAccountId: z.number().int().positive(),
        configAlias: z.string().min(1),
        overrideBasePath: z.string().optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await ctx.db
          .update(projectSshConfigs)
          .set({ isDefault: false })
          .where(eq(projectSshConfigs.projectId, input.projectId));
      }

      const [config] = await ctx.db
        .insert(projectSshConfigs)
        .values({
          projectId: input.projectId,
          sshAccountId: input.sshAccountId,
          configAlias: input.configAlias,
          overrideBasePath: input.overrideBasePath || null,
          isDefault: input.isDefault,
        })
        .returning();

      return { success: true, config: { id: config.id } };
    }),

  // Unlink SSH account from project
  unlinkFromProject: publicProcedure
    .input(
      z.object({
        token: z.string(),
        configId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      await ctx.db.delete(projectSshConfigs).where(eq(projectSshConfigs.id, input.configId));

      return { success: true };
    }),

  // Get project SSH configurations
  getProjectConfigs: publicProcedure
    .input(
      z.object({
        token: z.string(),
        projectId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const configs = await ctx.db
        .select({
          id: projectSshConfigs.id,
          configAlias: projectSshConfigs.configAlias,
          overrideBasePath: projectSshConfigs.overrideBasePath,
          isDefault: projectSshConfigs.isDefault,
          createdAt: projectSshConfigs.createdAt,
          account: {
            id: sshAccounts.id,
            accountName: sshAccounts.accountName,
            host: sshAccounts.host,
            port: sshAccounts.port,
            username: sshAccounts.username,
          },
        })
        .from(projectSshConfigs)
        .innerJoin(sshAccounts, eq(projectSshConfigs.sshAccountId, sshAccounts.id))
        .where(eq(projectSshConfigs.projectId, input.projectId));

      return configs;
    }),

  // Set error notification configuration
  setErrorNotification: publicProcedure
    .input(
      z.object({
        token: z.string(),
        projectId: z.number().int().positive(),
        sshAccountId: z.number().int().positive(),
        notifyOnError: z.boolean(),
        emailAddresses: z.string(),
        maxRetries: z.number().int().min(0).default(3),
        retryDelay: z.number().int().min(0).default(1000),
        customHandler: z.string().optional(),
        customHandlerConfig: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      // Check if notification config exists
      const [existing] = await ctx.db
        .select()
        .from(sshErrorNotifications)
        .where(
          and(
            eq(sshErrorNotifications.projectId, input.projectId),
            eq(sshErrorNotifications.sshAccountId, input.sshAccountId)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing
        await ctx.db
          .update(sshErrorNotifications)
          .set({
            notifyOnError: input.notifyOnError,
            emailAddresses: input.emailAddresses,
            maxRetries: input.maxRetries,
            retryDelay: input.retryDelay,
            customHandler: input.customHandler || null,
            customHandlerConfig: input.customHandlerConfig || null,
            updatedAt: new Date(),
          })
          .where(eq(sshErrorNotifications.id, existing.id));
      } else {
        // Create new
        await ctx.db.insert(sshErrorNotifications).values({
          projectId: input.projectId,
          sshAccountId: input.sshAccountId,
          notifyOnError: input.notifyOnError,
          emailAddresses: input.emailAddresses,
          maxRetries: input.maxRetries,
          retryDelay: input.retryDelay,
          customHandler: input.customHandler || null,
          customHandlerConfig: input.customHandlerConfig || null,
        });
      }

      return { success: true };
    }),
});
