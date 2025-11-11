import chalk from 'chalk';
import ora from 'ora';
import { detectPlatform } from '../utils/platform.js';
import {
  checkNodeVersion,
  checkNpmVersion,
  checkPostgreSQL,
  checkRedis,
  checkDocker,
  checkDockerCompose,
  checkTmux,
  checkGit,
} from '../utils/validators.js';
import { logger } from '../utils/logger.js';

interface CheckCommandOptions {
  verbose?: boolean;
  platform?: boolean;
}

export async function checkCommand(options: CheckCommandOptions = {}) {
  logger.section('Checking Prerequisites');

  const platformInfo = await detectPlatform();

  if (options.platform) {
    logger.subsection('Platform Information');
    logger.plain(`OS: ${platformInfo.distribution} ${platformInfo.version}`);
    logger.plain(`Architecture: ${platformInfo.architecture}`);
    logger.plain(`Package Manager: ${platformInfo.packageManager}`);
    return;
  }

  const checks = [
    { name: 'Node.js', check: checkNodeVersion, required: true },
    { name: 'npm', check: checkNpmVersion, required: true },
    { name: 'Git', check: checkGit, required: true },
    { name: 'PostgreSQL', check: checkPostgreSQL, required: true },
    { name: 'Redis', check: checkRedis, required: true },
    { name: 'Docker', check: checkDocker, required: true },
    { name: 'Docker Compose', check: checkDockerCompose, required: true },
    { name: 'tmux', check: checkTmux, required: false },
  ];

  let allPassed = true;
  const results: Array<{ name: string; passed: boolean; version?: string; message?: string; required: boolean }> = [];

  for (const { name, check, required } of checks) {
    const spinner = ora(`Checking ${name}...`).start();

    try {
      const result = await check();
      results.push({ name, ...result, required });

      if (result.passed) {
        spinner.succeed(
          chalk.green(`${name}${result.version ? ' ' + chalk.dim(result.version) : ''}`)
        );
        if (options.verbose && result.message) {
          logger.dimmed(`  ${result.message}`);
        }
      } else {
        if (required) {
          allPassed = false;
          spinner.fail(chalk.red(`${name} - ${result.message || 'Not found'}`));
        } else {
          spinner.warn(chalk.yellow(`${name} - ${result.message || 'Not found'} (optional)`));
        }

        if (result.installInstructions) {
          logger.dimmed(`  → ${result.installInstructions}`);
        }
      }
    } catch (error: unknown) {
      if (required) {
        allPassed = false;
        spinner.fail(chalk.red(`${name} - Error: ${(error as Error).message}`));
      } else {
        spinner.warn(chalk.yellow(`${name} - Error: ${(error as Error).message} (optional)`));
      }
    }
  }

  logger.subsection('Platform Information');
  logger.plain(`OS: ${platformInfo.distribution} ${platformInfo.version}`);
  logger.plain(`Architecture: ${platformInfo.architecture}`);

  console.log();

  if (allPassed) {
    logger.success(chalk.bold('All required prerequisites met!'));
    logger.dimmed('\nNext steps:');
    logger.dimmed('  ./manage.ts setup    # Run complete setup wizard');
    logger.dimmed('  ./manage.ts init     # Initialize environment only');
  } else {
    logger.error(chalk.bold('Prerequisites check failed. Please resolve the above issues.'));
    logger.dimmed('\nRun ./manage.ts check --help for more information.');
    process.exit(1);
  }
}
