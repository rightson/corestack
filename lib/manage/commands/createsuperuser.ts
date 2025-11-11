import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';
import { validateUsername, validateEmail, validatePassword } from '../utils/validators.js';

interface CreateSuperuserOptions {
  username?: string;
  email?: string;
  password?: string;
  nonInteractive?: boolean;
}

export async function createSuperuserCommand(options: CreateSuperuserOptions = {}) {
  logger.section('Create Superuser');

  // Load .env file
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    logger.error('.env file not found');
    logger.dimmed('Run ./manage.ts setup first to initialize the environment');
    process.exit(1);
  }

  config({ path: envPath });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL not found in .env file');
    process.exit(1);
  }

  // Connect to database
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Check if users table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `;

    if (!tableCheck[0]?.exists) {
      logger.error('Database not initialized. Users table not found.');
      logger.dimmed('\nRun ./manage.ts db-setup first to initialize the database');
      await sql.end();
      process.exit(1);
    }
  } catch (error: unknown) {
    logger.error(`Database connection failed: ${(error as Error).message}`);
    await sql.end();
    process.exit(1);
  }

  let username = options.username;
  let email = options.email;
  let password = options.password;

  if (options.nonInteractive) {
    // Get from environment if not provided as options
    username = username || process.env.SUPERUSER_USERNAME;
    email = email || process.env.SUPERUSER_EMAIL;
    password = password || process.env.SUPERUSER_PASSWORD;

    if (!username || !email || !password) {
      logger.error('Non-interactive mode requires --username, --email, and --password options');
      logger.dimmed('Or set SUPERUSER_USERNAME, SUPERUSER_EMAIL, and SUPERUSER_PASSWORD environment variables');
      await sql.end();
      process.exit(1);
    }
  } else {
    const inquirer = (await import('inquirer')).default;

    logger.dimmed('Create an administrative user with full system access.\n');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Username:',
        default: username || 'admin',
        validate: (input: string) => {
          const validation = validateUsername(input);
          return validation.valid || validation.error || false;
        },
      },
      {
        type: 'input',
        name: 'email',
        message: 'Email address:',
        default: email,
        validate: (input: string) => {
          return validateEmail(input) || 'Please enter a valid email address';
        },
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '•',
        validate: (input: string) => {
          const validation = validatePassword(input);
          if (!validation.valid) {
            return `Password requirements not met:\n  ${validation.errors.join('\n  ')}`;
          }
          return true;
        },
      },
      {
        type: 'password',
        name: 'passwordConfirm',
        message: 'Password (again):',
        mask: '•',
        validate: (input: string, answers?: { password?: string }) => {
          return input === answers?.password || 'Passwords do not match';
        },
      },
    ]);

    username = answers.username;
    email = answers.email;
    password = answers.password;
  }

  // Validate inputs
  const usernameValidation = validateUsername(username!);
  if (!usernameValidation.valid) {
    logger.error(usernameValidation.error || 'Invalid username');
    await sql.end();
    process.exit(1);
  }

  if (!validateEmail(email!)) {
    logger.error('Invalid email address');
    await sql.end();
    process.exit(1);
  }

  const passwordValidation = validatePassword(password!);
  if (!passwordValidation.valid) {
    logger.error('Password does not meet requirements:');
    passwordValidation.errors.forEach((err) => logger.dimmed(`  - ${err}`));
    await sql.end();
    process.exit(1);
  }

  // Assert that username, email, and password are defined at this point
  if (!username || !email || !password) {
    logger.error('Username, email, or password is missing');
    await sql.end();
    process.exit(1);
  }

  const spinner = ora('Creating superuser account...').start();

  try {
    // Check if username already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${username})
    `;

    if (existingUser.length > 0) {
      spinner.fail(chalk.red(`Username '${username}' already exists`));
      await sql.end();
      process.exit(1);
    }

    // Check if email already exists
    const existingEmail = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${email})
    `;

    if (existingEmail.length > 0) {
      spinner.fail(chalk.red(`Email '${email}' is already registered`));
      await sql.end();
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    await sql`
      INSERT INTO users (username, name, email, password_hash, auth_type, role, created_at, updated_at)
      VALUES (
        ${username.toLowerCase()},
        ${username},
        ${email.toLowerCase()},
        ${passwordHash},
        'email',
        'admin',
        NOW(),
        NOW()
      )
    `;

    spinner.succeed(chalk.green('Superuser created successfully!'));

    console.log();
    logger.success(chalk.bold('Account Details:'));
    logger.plain(`  Username:     ${username}`);
    logger.plain(`  Email:        ${email}`);
    logger.plain(`  Role:         Administrator`);
    logger.plain(`  Auth Type:    email`);

    console.log();
    logger.warn('Security Recommendations:');
    logger.dimmed('  ✓ Store credentials securely (e.g., password manager)');
    logger.dimmed('  ⚠ Do not share your admin credentials');

    console.log();
    logger.dimmed('You can now log in to the application with these credentials.');
    logger.dimmed('\nNext steps:');
    logger.dimmed('  ./manage.ts dev    # Start development servers');
  } catch (error: unknown) {
    spinner.fail(chalk.red(`Failed to create superuser: ${(error as Error).message}`));
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}
