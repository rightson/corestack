import { z } from 'zod';
import { publicProcedure, router } from '@/lib/trpc/trpc';
import { verifyToken } from '@/lib/auth/jwt';
import { resolveSSHAccount } from '@/server/lib/ssh-resolver';
import { SSHFileOperations } from '@/lib/ssh/operations';
import { SSHErrorNotifier } from '@/lib/notifications/email';
import { sshOperationLogs, sshErrorNotifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { SSHOperationResult } from '@/lib/ssh/types';

// Base schema for account resolution (used in all operations)
const accountResolutionSchema = z.object({
  // Method 1: Direct account name
  accountName: z.string().optional(),

  // Method 2 & 3: Project-based resolution
  projectId: z.number().int().positive().optional(),
  configAlias: z.string().optional(),
}).refine(
  (data) => data.accountName || data.projectId,
  {
    message: 'Either accountName or projectId must be provided',
  }
);

// Helper to execute operations with retry and error handling
async function executeWithRetry(
  ctx: any,
  token: string,
  operation: () => Promise<SSHOperationResult>,
  operationName: string,
  parameters: any
): Promise<SSHOperationResult> {
  const payload = await verifyToken(token);
  if (!payload) {
    throw new Error('Unauthorized');
  }

  // Get error notification config if available
  let notificationConfig = null;
  if (parameters.projectId) {
    const account = await resolveSSHAccount({
      accountName: parameters.accountName,
      projectId: parameters.projectId,
      configAlias: parameters.configAlias,
    });

    if (account.id) {
      const [config] = await ctx.db
        .select()
        .from(sshErrorNotifications)
        .where(
          and(
            eq(sshErrorNotifications.projectId, parameters.projectId),
            eq(sshErrorNotifications.sshAccountId, account.id)
          )
        )
        .limit(1);

      notificationConfig = config;
    }
  }

  const maxRetries = notificationConfig?.maxRetries ?? 3;
  const retryDelay = notificationConfig?.retryDelay ?? 1000;

  let lastError: SSHOperationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await operation();

    // Log operation
    const account = await resolveSSHAccount({
      accountName: parameters.accountName,
      projectId: parameters.projectId,
      configAlias: parameters.configAlias,
    });

    await ctx.db.insert(sshOperationLogs).values({
      projectId: parameters.projectId || null,
      sshAccountId: account.id || null,
      operation: operationName,
      parameters,
      success: result.success,
      stdout: result.stdout || null,
      stderr: result.stderr || null,
      errorMessage: result.message || null,
      executionTime: result.executionTime || null,
    });

    if (result.success) {
      return result;
    }

    lastError = result;

    // If not last attempt, wait before retry
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  // All retries failed, send notification if configured
  if (notificationConfig?.notifyOnError && lastError) {
    const account = await resolveSSHAccount({
      accountName: parameters.accountName,
      projectId: parameters.projectId,
      configAlias: parameters.configAlias,
    });

    await SSHErrorNotifier.notifyError(
      operationName,
      lastError,
      account,
      {
        emailAddresses: notificationConfig.emailAddresses.split(',').map((e: string) => e.trim()),
        projectName: `Project ${parameters.projectId}`,
        accountName: account.accountName,
      }
    );
  }

  return lastError!;
}

export const sshRouter = router({
  // Copy file/directory
  copy: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        source: z.string().min(1),
        dest: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.copy(input.source, input.dest, account),
        'copy',
        input
      );
    }),

  // Move file/directory
  move: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        source: z.string().min(1),
        dest: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.move(input.source, input.dest, account),
        'move',
        input
      );
    }),

  // Remove file/directory
  remove: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        recursive: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.remove(input.path, input.recursive, account),
        'remove',
        input
      );
    }),

  // Create directory
  mkdir: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        recursive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.mkdir(input.path, input.recursive, account),
        'mkdir',
        input
      );
    }),

  // Create symlink
  symlink: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        target: z.string().min(1),
        linkPath: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.symlink(input.target, input.linkPath, account),
        'symlink',
        input
      );
    }),

  // Create hardlink
  hardlink: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        target: z.string().min(1),
        linkPath: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.hardlink(input.target, input.linkPath, account),
        'hardlink',
        input
      );
    }),

  // Touch file
  touch: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.touch(input.path, account),
        'touch',
        input
      );
    }),

  // Change file permissions
  chmod: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        mode: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.chmod(input.path, input.mode, account),
        'chmod',
        input
      );
    }),

  // Change file owner
  chown: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        owner: z.string().min(1),
        group: z.string().default(''),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.chown(input.path, input.owner, input.group, account),
        'chown',
        input
      );
    }),

  // Read file
  readFile: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await operations.readFile(input.path, account);
    }),

  // Write file
  writeFile: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.writeFile(input.path, input.content, account),
        'writeFile',
        input
      );
    }),

  // Append to file
  appendFile: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await executeWithRetry(
        ctx,
        input.token,
        () => operations.appendFile(input.path, input.content, account),
        'appendFile',
        input
      );
    }),

  // Check if file/directory exists
  exists: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await operations.exists(input.path, account);
    }),

  // List directory contents
  listDir: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await operations.listDir(input.path, account);
    }),

  // Get file statistics
  stat: publicProcedure
    .input(
      accountResolutionSchema.extend({
        token: z.string(),
        path: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const payload = await verifyToken(input.token);
      if (!payload) {
        throw new Error('Unauthorized');
      }

      const account = await resolveSSHAccount({
        accountName: input.accountName,
        projectId: input.projectId,
        configAlias: input.configAlias,
      });

      const operations = new SSHFileOperations();
      return await operations.stat(input.path, account);
    }),
});
