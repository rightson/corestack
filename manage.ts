#!/usr/bin/env -S npx tsx

import { Command } from 'commander';
import chalk from 'chalk';
import { checkCommand } from './lib/manage/commands/check.js';
import { initCommand } from './lib/manage/commands/init.js';
import { dbSetupCommand } from './lib/manage/commands/db-setup.js';
import { createSuperuserCommand } from './lib/manage/commands/createsuperuser.js';
import { devCommand } from './lib/manage/commands/dev.js';
import { setupCommand } from './lib/manage/commands/setup.js';

const program = new Command();

program
  .name('manage')
  .description('CoreStack management utility for development workflow orchestration')
  .version('1.0.0');

program
  .command('check')
  .description('Check prerequisites and system requirements')
  .option('--verbose', 'Show detailed version information')
  .option('--platform', 'Show platform information only')
  .action(checkCommand);

program
  .command('init')
  .description('Initialize environment configuration')
  .option('--non-interactive', 'Use all defaults without prompts')
  .option('--force', 'Overwrite existing .env without prompting')
  .action(initCommand);

program
  .command('db-setup')
  .description('Setup PostgreSQL database and verify Redis connection')
  .option('--reset', 'Drop and recreate database')
  .option('--verify-only', 'Only verify connections without making changes')
  .action(dbSetupCommand);

program
  .command('createsuperuser')
  .description('Create an administrative user account')
  .option('--username <username>', 'Admin username')
  .option('--email <email>', 'Admin email address')
  .option('--password <password>', 'Admin password')
  .option('--non-interactive', 'Use provided credentials without prompts')
  .action(createSuperuserCommand);

program
  .command('dev')
  .description('Start all development services in tmux')
  .option('--no-tmux', 'Start services in background without tmux')
  .option('--attach', 'Immediately attach to tmux session')
  .action(devCommand);

program
  .command('dev-stop')
  .description('Stop all development services')
  .action(async () => {
    const { stopDevServices } = await import('./lib/manage/commands/dev.js');
    await stopDevServices();
  });

program
  .command('dev-status')
  .description('Show status of all development services')
  .action(async () => {
    const { showDevStatus } = await import('./lib/manage/commands/dev.js');
    await showDevStatus();
  });

program
  .command('setup')
  .description('Run complete setup wizard (check → init → db-setup → createsuperuser)')
  .option('--non-interactive', 'Skip all prompts, use defaults')
  .action(setupCommand);

// Error handling
program.exitOverride();

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    const err = error as { exitCode?: number; message?: string };
    if (err.exitCode !== 0) {
      console.error(chalk.red('\n✗ Error:'), err.message || 'Unknown error');
      process.exit(1);
    }
  }
})();
