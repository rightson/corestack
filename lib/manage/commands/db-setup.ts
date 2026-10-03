import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import postgres from 'postgres';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { execCommand } from '../utils/shell.js';

interface DbSetupOptions {
  reset?: boolean;
  verifyOnly?: boolean;
}

export async function dbSetupCommand(options: DbSetupOptions = {}) {
  logger.section('Database Setup');

  // Load .env file
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    logger.error('.env file not found');
    logger.dimmed('Run ./manage.ts init first to initialize environment configuration');
    process.exit(1);
  }

  config({ path: envPath });

  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!databaseUrl || !redisUrl) {
    logger.error('DATABASE_URL or REDIS_URL not found in .env file');
    process.exit(1);
  }

  // PostgreSQL setup
  await setupPostgreSQL(databaseUrl, options);

  // Redis setup
  await setupRedis(redisUrl);

  if (!options.verifyOnly) {
    console.log();
    logger.success(chalk.bold('Database setup complete!'));
    logger.dimmed('\nNext steps:');
    logger.dimmed('  ./manage.ts createsuperuser # Create admin user');
    logger.dimmed('  ./manage.ts dev             # Start development servers');
  }
}

async function setupPostgreSQL(connectionString: string, options: DbSetupOptions) {
  logger.subsection('PostgreSQL Setup');

  const spinner = ora('Connecting to PostgreSQL...').start();

  try {
    // Parse connection string to get database info
    const url = new URL(connectionString);
    const dbName = url.pathname.slice(1);

    // Connect to postgres database first to check/create target database
    const adminUrl = new URL(connectionString);
    adminUrl.pathname = '/postgres';

    let sql = postgres(adminUrl.toString(), { max: 1 });

    // Check if database exists
    const dbCheck = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (dbCheck.length === 0) {
      if (options.verifyOnly) {
        spinner.fail(chalk.red(`Database '${dbName}' does not exist`));
        await sql.end();
        process.exit(1);
      }

      spinner.text = `Creating database '${dbName}'...`;
      try {
        await sql.unsafe(`CREATE DATABASE ${dbName}`);
        spinner.succeed(chalk.green(`Database '${dbName}' created`));
      } catch (error: unknown) {
        spinner.fail(chalk.red(`Failed to create database: ${(error as Error).message}`));
        await sql.end();
        process.exit(1);
      }
    } else {
      if (options.reset) {
        spinner.text = `Dropping and recreating database '${dbName}'...`;
        try {
          await sql.unsafe(`DROP DATABASE ${dbName}`);
          await sql.unsafe(`CREATE DATABASE ${dbName}`);
          spinner.succeed(chalk.green(`Database '${dbName}' reset`));
        } catch (error: unknown) {
          spinner.fail(chalk.red(`Failed to reset database: ${(error as Error).message}`));
          await sql.end();
          process.exit(1);
        }
      } else {
        spinner.succeed(chalk.green(`Database '${dbName}' exists`));
      }
    }

    await sql.end();

    // Connect to the target database and verify
    spinner.text = 'Verifying database connection...';
    sql = postgres(connectionString, { max: 1 });

    try {
      const result = await sql`SELECT version()`;
      spinner.succeed(chalk.green('Database connection verified'));
      if (result[0]) {
        logger.dimmed(`  PostgreSQL: ${result[0].version.split(',')[0]}`);
      }
    } catch (error: unknown) {
      spinner.fail(chalk.red(`Database connection failed: ${(error as Error).message}`));
      await sql.end();
      process.exit(1);
    }

    await sql.end();

    // Run migrations if not verifyOnly
    if (!options.verifyOnly) {
      spinner.text = 'Running database migrations...';
      spinner.start();

      const result = execCommand('npm run db:push', { silent: true });

      if (result.success) {
        spinner.succeed(chalk.green('Database schema pushed successfully'));
      } else {
        spinner.warn(chalk.yellow('Database migration completed with warnings'));
        logger.dimmed('  You may need to run migrations manually');
      }
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red(`PostgreSQL setup failed: ${(error as Error).message}`));
    logger.dimmed('\nTroubleshooting:');
    logger.dimmed('  1. Ensure PostgreSQL service is running');
    logger.dimmed('  2. Verify DATABASE_URL in .env file');
    logger.dimmed('  3. Check PostgreSQL logs for errors');
    process.exit(1);
  }
}

async function setupRedis(connectionString: string) {
  logger.subsection('Redis Setup');

  const spinner = ora('Connecting to Redis...').start();

  try {
    const redis = new Redis(connectionString);

    // Test operations
    await redis.set('__test__', 'connection_test');
    const value = await redis.get('__test__');
    await redis.del('__test__');

    if (value === 'connection_test') {
      spinner.succeed(chalk.green('Redis connection verified'));

      const info = await redis.info('server');
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      if (version) {
        logger.dimmed(`  Redis: ${version}`);
      }
    } else {
      spinner.fail(chalk.red('Redis test operation failed'));
    }

    await redis.quit();
  } catch (error: unknown) {
    spinner.fail(chalk.red(`Redis setup failed: ${(error as Error).message}`));
    logger.dimmed('\nTroubleshooting:');
    logger.dimmed('  1. Ensure Redis service is running');
    logger.dimmed('  2. Verify REDIS_URL in .env file');
    logger.dimmed('  3. Check Redis logs for errors');
    process.exit(1);
  }
}
