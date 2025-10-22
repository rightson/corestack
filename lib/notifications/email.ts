import { QueueManager } from '@/lib/queue';
import type { SSHOperationResult, SSHAccount } from '@/lib/ssh/types';

export interface EmailNotificationConfig {
  emailAddresses: string[];
  projectName?: string;
  accountName?: string;
}

export class SSHErrorNotifier {
  static async notifyError(
    operation: string,
    error: SSHOperationResult,
    account: SSHAccount,
    config: EmailNotificationConfig
  ): Promise<void> {
    const emailContent = this.formatErrorEmail(operation, error, account, config);

    await QueueManager.addJob('EMAIL', 'ssh-error-notification', {
      to: config.emailAddresses,
      subject: `SSH Operation Failed: ${operation}`,
      body: emailContent,
      priority: 'high',
    });
  }

  private static formatErrorEmail(
    operation: string,
    error: SSHOperationResult,
    account: SSHAccount,
    config: EmailNotificationConfig
  ): string {
    return `
SSH Operation Failed

Project: ${config.projectName || 'N/A'}
Account: ${config.accountName || account.username}
Host: ${account.host}:${account.port || 22}
Operation: ${operation}

Error Details:
${error.message || 'Unknown error'}

STDERR:
${error.stderr || 'N/A'}

Execution Time: ${error.executionTime || 0}ms
Timestamp: ${new Date().toISOString()}
    `.trim();
  }
}
