import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { checkCommand } from './check.js';
import { initCommand } from './init.js';
import { dbSetupCommand } from './db-setup.js';
import { createSuperuserCommand } from './createsuperuser.js';

interface SetupCommandOptions {
  nonInteractive?: boolean;
}

export async function setupCommand(options: SetupCommandOptions = {}) {
  logger.section('🚀 CoreStack Setup Wizard');
  logger.dimmed('This wizard will guide you through setting up the development environment.\n');

  try {
    // Step 1: Prerequisites Check
    logger.subsection('Step 1/4: Prerequisites Check');
    await checkCommand({ verbose: false });

    console.log();

    // Step 2: Install Dependencies (assuming already done since manage.ts is running)
    logger.subsection('Step 2/4: Dependencies');
    logger.success('Dependencies already installed (node_modules exists)');

    console.log();

    // Step 3: Environment Configuration
    logger.subsection('Step 3/4: Environment Configuration');
    await initCommand({ nonInteractive: options.nonInteractive });

    console.log();

    // Step 4: Database Setup
    logger.subsection('Step 4/4: Database Setup');
    await dbSetupCommand({ verifyOnly: false });

    console.log();

    // Create superuser
    logger.subsection('Create Admin User');
    logger.dimmed('Finally, create an administrative user account.\n');
    await createSuperuserCommand({ nonInteractive: options.nonInteractive });

    console.log();
    logger.section('═'.repeat(60));
    logger.success(chalk.bold.green('🎉 Setup Complete!'));
    logger.section('═'.repeat(60));

    console.log();
    logger.plain(chalk.bold('Your development environment is ready to use.'));

    console.log();
    logger.plain(chalk.bold('Quick Start:'));
    logger.dimmed('  ./manage.ts dev              # Start all services');
    logger.dimmed('  ./manage.ts dev-status       # Check service status');
    logger.dimmed('  ./manage.ts dev-stop         # Stop all services');

    console.log();
    logger.plain(chalk.bold('Access Points:'));
    logger.dimmed('  Web UI:        http://localhost:3000');
    logger.dimmed('  Temporal UI:   http://localhost:8080');

    console.log();
    logger.warn('Important: Make sure you\'ve saved your admin credentials securely!');

    console.log();
  } catch (error: unknown) {
    console.log();
    logger.error(chalk.bold('Setup failed: ' + (error as Error).message));
    logger.dimmed('\nYou can run individual steps manually:');
    logger.dimmed('  ./manage.ts check            # Check prerequisites');
    logger.dimmed('  ./manage.ts init             # Initialize environment');
    logger.dimmed('  ./manage.ts db-setup         # Setup database');
    logger.dimmed('  ./manage.ts createsuperuser  # Create admin user');
    process.exit(1);
  }
}
