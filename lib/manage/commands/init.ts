import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import * as crypto from 'crypto';

interface InitCommandOptions {
  nonInteractive?: boolean;
  force?: boolean;
}

export async function initCommand(options: InitCommandOptions = {}) {
  logger.section('Environment Initialization');

  const envExamplePath = join(process.cwd(), '.env.example');
  const envPath = join(process.cwd(), '.env');

  // Check if .env.example exists
  if (!existsSync(envExamplePath)) {
    logger.error('.env.example file not found');
    logger.dimmed('Make sure you are running this command from the project root directory.');
    process.exit(1);
  }

  // Check if .env already exists
  if (existsSync(envPath) && !options.force) {
    if (options.nonInteractive) {
      logger.warn('.env file already exists. Use --force to overwrite.');
      return;
    }

    const inquirer = (await import('inquirer')).default;
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '.env file already exists. What would you like to do?',
        choices: [
          { name: 'Keep existing .env and exit', value: 'exit' },
          { name: 'Backup existing and create new .env', value: 'backup' },
          { name: 'Overwrite existing .env', value: 'overwrite' },
        ],
      },
    ]);

    if (action === 'exit') {
      logger.info('Keeping existing .env file');
      return;
    }

    if (action === 'backup') {
      const backupPath = `${envPath}.backup.${Date.now()}`;
      copyFileSync(envPath, backupPath);
      logger.success(`Backed up existing .env to ${backupPath}`);
    }
  }

  // Read .env.example
  const envExampleContent = readFileSync(envExamplePath, 'utf-8');

  // Generate secure secrets
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const sshEncryptionKey = crypto.randomBytes(32).toString('hex');

  // Parse and generate .env content
  let envContent = envExampleContent;

  // Update JWT_SECRET if it exists
  if (envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
    logger.success('Generated secure JWT_SECRET');
  } else {
    envContent += `\nJWT_SECRET=${jwtSecret}`;
    logger.success('Generated secure JWT_SECRET');
  }

  // Add SSH_ENCRYPTION_KEY if not exists
  if (!envContent.includes('SSH_ENCRYPTION_KEY=')) {
    envContent += `\nSSH_ENCRYPTION_KEY=${sshEncryptionKey}`;
    logger.success('Generated secure SSH_ENCRYPTION_KEY');
  }

  if (options.nonInteractive) {
    // Use defaults for non-interactive mode
    writeFileSync(envPath, envContent);
    logger.success('.env file created with default values');
  } else {
    const inquirer = (await import('inquirer')).default;

    logger.subsection('Configuration');
    logger.dimmed('Press Enter to use default values shown in parentheses\n');

    // Prompt for database configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'dbHost',
        message: 'Database host:',
        default: 'localhost',
      },
      {
        type: 'input',
        name: 'dbPort',
        message: 'Database port:',
        default: '5432',
      },
      {
        type: 'input',
        name: 'dbName',
        message: 'Database name:',
        default: 'mydb',
      },
      {
        type: 'input',
        name: 'dbUser',
        message: 'Database user:',
        default: 'postgres',
      },
      {
        type: 'password',
        name: 'dbPassword',
        message: 'Database password:',
        default: 'postgres',
        mask: '•',
      },
      {
        type: 'input',
        name: 'redisHost',
        message: 'Redis host:',
        default: 'localhost',
      },
      {
        type: 'input',
        name: 'redisPort',
        message: 'Redis port:',
        default: '6379',
      },
      {
        type: 'input',
        name: 'port',
        message: 'Next.js port:',
        default: '3000',
      },
      {
        type: 'input',
        name: 'wsPort',
        message: 'WebSocket port:',
        default: '3001',
      },
    ]);

    // Update env content with user inputs
    const databaseUrl = `postgresql://${answers.dbUser}:${answers.dbPassword}@${answers.dbHost}:${answers.dbPort}/${answers.dbName}`;
    const redisUrl = `redis://${answers.redisHost}:${answers.redisPort}`;

    envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${databaseUrl}`);
    envContent = envContent.replace(/REDIS_URL=.*/, `REDIS_URL=${redisUrl}`);
    envContent = envContent.replace(/PORT=.*/, `PORT=${answers.port}`);
    envContent = envContent.replace(/WS_PORT=.*/, `WS_PORT=${answers.wsPort}`);

    writeFileSync(envPath, envContent);
    logger.success('.env file created successfully');
  }

  console.log();
  logger.info('Configuration saved to .env');
  logger.dimmed('\nNext steps:');
  logger.dimmed('  ./manage.ts db-setup       # Setup databases');
  logger.dimmed('  ./manage.ts createsuperuser # Create admin user');
}
