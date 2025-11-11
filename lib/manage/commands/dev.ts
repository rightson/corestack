import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { logger } from '../utils/logger.js';
import { execCommand, execCommandQuiet, isPortInUse } from '../utils/shell.js';
import { hasCommand } from '../utils/platform.js';

interface DevCommandOptions {
  tmux?: boolean;
  attach?: boolean;
}

const SESSION_NAME = 'corestack';
const SERVICES = [
  { name: 'temporal', command: 'docker-compose up', pane: 0 },
  { name: 'next', command: 'npm run dev', pane: 1 },
  { name: 'websocket', command: 'npm run ws:server', pane: 2 },
  { name: 'queue', command: 'npm run queue:worker', pane: 3 },
  { name: 'worker', command: 'npm run temporal:worker', pane: 4 },
];

export async function devCommand(options: DevCommandOptions = { tmux: true }) {
  logger.section('Starting Development Environment');

  // Pre-flight checks
  await preflightChecks(options.tmux !== false);

  if (options.tmux === false) {
    await startWithoutTmux();
  } else {
    await startWithTmux(options.attach);
  }
}

async function preflightChecks(useTmux: boolean) {
  const spinner = ora('Running pre-flight checks...').start();

  const checks: Array<{ name: string; check: () => boolean | Promise<boolean> }> = [
    {
      name: '.env file',
      check: () => existsSync(join(process.cwd(), '.env')),
    },
    {
      name: 'node_modules',
      check: () => existsSync(join(process.cwd(), 'node_modules')),
    },
  ];

  if (useTmux) {
    checks.push({
      name: 'tmux',
      check: () => hasCommand('tmux'),
    });
  }

  checks.push({
    name: 'docker',
    check: () => hasCommand('docker'),
  });

  for (const { name, check } of checks) {
    const passed = await check();
    if (!passed) {
      spinner.fail(chalk.red(`Pre-flight check failed: ${name} not found`));

      if (name === '.env file') {
        logger.dimmed('Run ./manage.ts init to initialize environment configuration');
      } else if (name === 'node_modules') {
        logger.dimmed('Run npm install to install dependencies');
      } else if (name === 'tmux') {
        logger.dimmed('Install tmux or use ./manage.ts dev --no-tmux');
      }

      process.exit(1);
    }
  }

  // Check if ports are available
  config({ path: join(process.cwd(), '.env') });
  const port = parseInt(process.env.PORT || '3000');
  const wsPort = parseInt(process.env.WS_PORT || '3001');

  const portsToCheck = [port, wsPort, 7233, 8080];
  const occupiedPorts = portsToCheck.filter((p) => isPortInUse(p));

  if (occupiedPorts.length > 0) {
    spinner.warn(chalk.yellow(`Ports already in use: ${occupiedPorts.join(', ')}`));
    logger.dimmed('Services on these ports may already be running or need to be stopped');
  } else {
    spinner.succeed(chalk.green('Pre-flight checks passed'));
  }
}

async function startWithTmux(attach?: boolean) {
  logger.subsection('Initializing tmux session');

  // Check if session already exists
  const sessionExists = execCommandQuiet(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);

  if (sessionExists.success) {
    logger.warn(`Session '${SESSION_NAME}' already exists`);
    logger.dimmed('\nOptions:');
    logger.dimmed(`  1. Attach to existing: tmux attach -t ${SESSION_NAME}`);
    logger.dimmed(`  2. Stop and restart: ./manage.ts dev-stop && ./manage.ts dev`);
    logger.dimmed(`  3. Kill session: tmux kill-session -t ${SESSION_NAME}`);
    return;
  }

  const spinner = ora('Creating tmux session...').start();

  try {
    // Create new session with first pane (detached)
    execCommand(`tmux new-session -d -s ${SESSION_NAME}`, { silent: true });

    // Create additional panes
    for (let i = 1; i < SERVICES.length; i++) {
      execCommand(`tmux split-window -t ${SESSION_NAME}:0`, { silent: true });
    }

    // Arrange layout
    execCommand(`tmux select-layout -t ${SESSION_NAME}:0 tiled`, { silent: true });

    spinner.succeed(chalk.green('Tmux session created'));

    // Start services in each pane
    logger.subsection('Starting services');

    for (const service of SERVICES) {
      const serviceSpinner = ora(`Starting ${service.name}...`).start();

      // Send command to pane
      execCommand(
        `tmux send-keys -t ${SESSION_NAME}:0.${service.pane} "${service.command}" Enter`,
        { silent: true }
      );

      // Give service a moment to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      serviceSpinner.succeed(chalk.green(`${service.name} started`));
    }

    console.log();
    logger.success(chalk.bold('🚀 Development environment is ready!'));

    console.log();
    logger.plain(chalk.bold('Services:'));
    logger.plain(`  Web UI:        http://localhost:${process.env.PORT || '3000'}`);
    logger.plain(`  Temporal UI:   http://localhost:8080`);
    logger.plain(`  WebSocket:     ws://localhost:${process.env.WS_PORT || '3001'}`);

    console.log();
    logger.plain(chalk.bold('Tmux Controls:'));
    logger.dimmed(`  Attach:        tmux attach -t ${SESSION_NAME}`);
    logger.dimmed(`  Detach:        Ctrl+B, then D`);
    logger.dimmed(`  Switch panes:  Ctrl+B, then arrow keys`);
    logger.dimmed(`  Stop all:      ./manage.ts dev-stop`);

    if (attach) {
      console.log();
      logger.info('Attaching to tmux session...');
      execCommand(`tmux attach -t ${SESSION_NAME}`);
    } else {
      console.log();
      logger.dimmed('Press Ctrl+C to keep services running, or run:');
      logger.dimmed(`  tmux attach -t ${SESSION_NAME}`);
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red(`Failed to start services: ${(error as Error).message}`));
    process.exit(1);
  }
}

async function startWithoutTmux() {
  logger.warn('Starting services without tmux - not fully implemented');
  logger.dimmed('For the best experience, use tmux: ./manage.ts dev');
  logger.dimmed('\nAlternatively, start services manually:');
  SERVICES.forEach((service) => {
    logger.dimmed(`  ${service.command}`);
  });
}

export async function stopDevServices() {
  logger.section('Stopping Development Environment');

  const spinner = ora('Checking for running session...').start();

  const sessionExists = execCommandQuiet(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);

  if (!sessionExists.success) {
    spinner.info(chalk.yellow(`Session '${SESSION_NAME}' not found`));
    logger.dimmed('Services may already be stopped');
    return;
  }

  spinner.text = 'Stopping services...';

  try {
    // Send Ctrl+C to all panes to stop services gracefully
    for (let i = 0; i < SERVICES.length; i++) {
      execCommandQuiet(`tmux send-keys -t ${SESSION_NAME}:0.${i} C-c`);
    }

    // Wait a moment for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Kill the session
    execCommand(`tmux kill-session -t ${SESSION_NAME}`, { silent: true });

    // Stop docker-compose
    const dockerResult = execCommandQuiet('docker-compose down');

    spinner.succeed(chalk.green('All services stopped'));

    if (!dockerResult.success) {
      logger.warn('Docker Compose may need to be stopped manually');
      logger.dimmed('Run: docker-compose down');
    }
  } catch (error: unknown) {
    spinner.fail(chalk.red(`Failed to stop services: ${(error as Error).message}`));
    process.exit(1);
  }
}

export async function showDevStatus() {
  logger.section('Development Environment Status');

  const sessionExists = execCommandQuiet(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);

  if (!sessionExists.success) {
    logger.warn(`Tmux session '${SESSION_NAME}' is not running`);
    logger.dimmed('\nStart services with: ./manage.ts dev');
    return;
  }

  logger.success(`Tmux session '${SESSION_NAME}' is running`);

  // Check Docker containers
  const dockerPs = execCommandQuiet('docker-compose ps --services --filter "status=running"');
  if (dockerPs.success && dockerPs.stdout) {
    const runningContainers = dockerPs.stdout.split('\n').filter((s) => s.trim());
    logger.plain(`\nDocker services: ${runningContainers.length} running`);
    runningContainers.forEach((service) => logger.dimmed(`  - ${service}`));
  }

  console.log();
  logger.dimmed('Attach to session: tmux attach -t ' + SESSION_NAME);
  logger.dimmed('Stop services: ./manage.ts dev-stop');
}
