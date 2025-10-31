#!/usr/bin/env node

import { Command } from 'commander';
import { trpcClient } from '@/lib/trpc/client';
import WebSocket from 'ws';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';

dotenv.config();

const program = new Command();

program
  .name('web-seed-cli')
  .description('CLI client for the lightweight web seed stack')
  .version('1.0.0');

// User commands
const userCmd = program.command('user').description('User management commands');

userCmd
  .command('list')
  .description('List all users')
  .action(async () => {
    try {
      const users = await trpcClient.user.list.query();
      console.log('Users:', JSON.stringify(users, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

userCmd
  .command('get <id>')
  .description('Get user by ID')
  .action(async (id: string) => {
    try {
      const user = await trpcClient.user.getById.query({ id: parseInt(id) });
      console.log('User:', JSON.stringify(user, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

userCmd
  .command('create <username> <name> <email>')
  .description('Create a new user')
  .action(async (username: string, name: string, email: string) => {
    try {
      const user = await trpcClient.user.create.mutate({ username, name, email });
      console.log('Created user:', JSON.stringify(user, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

userCmd
  .command('delete <id>')
  .description('Delete a user')
  .action(async (id: string) => {
    try {
      await trpcClient.user.delete.mutate({ id: parseInt(id) });
      console.log('User deleted successfully');
    } catch (error) {
      console.error('Error:', error);
    }
  });

// Post commands
const postCmd = program.command('post').description('Post management commands');

postCmd
  .command('list')
  .description('List all posts')
  .action(async () => {
    try {
      const posts = await trpcClient.post.list.query();
      console.log('Posts:', JSON.stringify(posts, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

postCmd
  .command('create <title> [content]')
  .description('Create a new post')
  .option('-a, --author <id>', 'Author ID')
  .action(async (title: string, content: string | undefined, options: { author?: string }) => {
    try {
      const post = await trpcClient.post.create.mutate({
        title,
        content,
        authorId: options.author ? parseInt(options.author) : undefined,
      });
      console.log('Created post:', JSON.stringify(post, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

// WebSocket commands
const wsCmd = program.command('ws').description('WebSocket commands');

wsCmd
  .command('listen <channel>')
  .description('Listen to a WebSocket channel')
  .action(async (channel: string) => {
    const wsPort = process.env.WS_PORT || '3001';
    const ws = new WebSocket(`ws://localhost:${wsPort}`);

    ws.on('open', () => {
      console.log('Connected to WebSocket server');
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
      console.log(`Subscribed to channel: ${channel}`);
      console.log('Listening for messages... (Press Ctrl+C to exit)');
    });

    ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      console.log('Received:', JSON.stringify(message, null, 2));
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('Disconnected from WebSocket server');
      process.exit(0);
    });
  });

wsCmd
  .command('send <channel> <message>')
  .description('Send a message to a WebSocket channel')
  .action(async (channel: string, message: string) => {
    const wsPort = process.env.WS_PORT || '3001';
    const ws = new WebSocket(`ws://localhost:${wsPort}`);

    ws.on('open', () => {
      console.log('Connected to WebSocket server');
      ws.send(
        JSON.stringify({
          type: 'broadcast',
          channel,
          data: { message },
        })
      );
      console.log(`Message sent to channel ${channel}`);
      setTimeout(() => {
        ws.close();
      }, 1000);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      process.exit(1);
    });
  });

// Task commands for Temporal workflows
const taskCmd = program.command('task').description('Task and workflow management commands');

taskCmd
  .command('start <type>')
  .description('Start a new workflow')
  .option('-p, --project <projectId>', 'Project ID')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .option('-c, --commit <hash>', 'Commit hash')
  .option('--skip-tests', 'Skip tests')
  .option('--skip-lint', 'Skip lint check')
  .option('-e, --environment <env>', 'Environment (development, staging, production)', 'development')
  .option('-w, --wait', 'Wait for completion')
  .action(async (type: string, options: {
    project?: string;
    branch: string;
    commit?: string;
    skipTests?: boolean;
    skipLint?: boolean;
    environment: 'development' | 'staging' | 'production';
    wait?: boolean;
  }) => {
    if (type !== 'build') {
      console.error(chalk.red(`Error: Unknown workflow type "${type}". Supported types: build`));
      process.exit(1);
    }

    if (!options.project) {
      console.error(chalk.red('Error: --project is required'));
      process.exit(1);
    }

    const spinner = ora('Starting workflow...').start();

    try {
      const result = await trpcClient.temporal.startBuild.mutate({
        projectId: options.project,
        branch: options.branch,
        commitHash: options.commit,
        config: {
          skipTests: options.skipTests,
          skipLint: options.skipLint,
          environment: options.environment,
        },
      });

      spinner.succeed(chalk.green(`Workflow started: ${result.workflowId}`));
      console.log(`Run ID: ${result.runId}`);

      if (options.wait) {
        spinner.start('Waiting for workflow to complete...');

        // Poll for workflow status
        let completed = false;
        while (!completed) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const status = await trpcClient.temporal.getWorkflowStatus.query({
            workflowId: result.workflowId,
          });

          if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'CANCELLED') {
            completed = true;
            if (status.status === 'COMPLETED') {
              spinner.succeed(chalk.green('Workflow completed'));
              const workflowResult = await trpcClient.temporal.getWorkflowResult.query({
                workflowId: result.workflowId,
              });
              console.log(JSON.stringify(workflowResult.result, null, 2));
            } else {
              spinner.fail(chalk.red(`Workflow ${status.status.toLowerCase()}`));
            }
          } else {
            spinner.text = `Progress: ${status.progress}% - ${status.currentStep}`;
          }
        }
      } else {
        console.log(chalk.blue(`\nMonitor with: task status ${result.workflowId}`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to start workflow'));
      console.error(error);
      process.exit(1);
    }
  });

taskCmd
  .command('status <workflowId>')
  .description('Get workflow status')
  .option('-f, --follow', 'Follow workflow progress')
  .action(async (workflowId: string, options: { follow?: boolean }) => {
    const showStatus = async () => {
      try {
        const status = await trpcClient.temporal.getWorkflowStatus.query({ workflowId });

        console.clear();
        console.log(chalk.bold('\nWorkflow Status\n'));
        console.log(`ID:        ${workflowId}`);
        console.log(`Status:    ${getStatusEmoji(status.status)} ${chalk.yellow(status.status)}`);
        console.log(`Started:   ${status.startTime ? new Date(status.startTime).toISOString() : 'N/A'}`);
        console.log(`Progress:  ${status.progress || 0}%`);
        console.log(`Step:      ${status.currentStep || 'N/A'}`);

        if (status.executionTime) {
          console.log(`Duration:  ${formatDuration(status.executionTime)}`);
        }

        if (status.logs && status.logs.length > 0) {
          console.log(chalk.bold('\nRecent Logs:\n'));
          status.logs.slice(-10).forEach((log) => {
            console.log(`  ${log}`);
          });
        }
      } catch (error) {
        console.error(chalk.red('Error fetching status:'), (error as Error).message);
        if (!options.follow) process.exit(1);
      }
    };

    if (options.follow) {
      console.log(chalk.blue('Following workflow progress... (Press Ctrl+C to exit)\n'));

      const interval = setInterval(showStatus, 2000);
      showStatus();

      // Handle graceful exit
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(chalk.yellow('\n\nStopped following workflow'));
        process.exit(0);
      });
    } else {
      await showStatus();
    }
  });

taskCmd
  .command('cancel <workflowId>')
  .description('Cancel a running workflow')
  .action(async (workflowId: string) => {
    const spinner = ora('Cancelling workflow...').start();

    try {
      await trpcClient.temporal.cancelWorkflow.mutate({ workflowId });
      spinner.succeed(chalk.green('Workflow cancelled'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to cancel workflow'));
      console.error(error);
      process.exit(1);
    }
  });

taskCmd
  .command('terminate <workflowId>')
  .description('Terminate a workflow forcefully')
  .option('-r, --reason <reason>', 'Termination reason')
  .action(async (workflowId: string, options: { reason?: string }) => {
    const spinner = ora('Terminating workflow...').start();

    try {
      await trpcClient.temporal.terminateWorkflow.mutate({
        workflowId,
        reason: options.reason,
      });
      spinner.succeed(chalk.green('Workflow terminated'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to terminate workflow'));
      console.error(error);
      process.exit(1);
    }
  });

taskCmd
  .command('list')
  .description('List workflows')
  .option('-s, --status <status>', 'Filter by status (RUNNING, COMPLETED, FAILED, etc.)')
  .option('-l, --limit <limit>', 'Maximum number of results', '20')
  .action(async (options: { status?: string; limit: string }) => {
    const spinner = ora('Fetching workflows...').start();

    try {
      const result = await trpcClient.temporal.listWorkflows.query({
        status: options.status as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TERMINATED' | 'TIMED_OUT' | undefined,
        limit: parseInt(options.limit),
      });

      spinner.stop();

      if (result.workflows.length === 0) {
        console.log(chalk.yellow('No workflows found'));
        return;
      }

      console.log(chalk.bold(`\nFound ${result.workflows.length} workflow(s):\n`));

      result.workflows.forEach((w) => {
        const statusEmoji = getStatusEmoji(w.status);
        const statusColor = getStatusColor(w.status);

        let statusText: string;
        switch (statusColor) {
          case 'blue':
            statusText = chalk.blue(w.status.padEnd(12));
            break;
          case 'green':
            statusText = chalk.green(w.status.padEnd(12));
            break;
          case 'red':
            statusText = chalk.red(w.status.padEnd(12));
            break;
          case 'yellow':
            statusText = chalk.yellow(w.status.padEnd(12));
            break;
          default:
            statusText = chalk.gray(w.status.padEnd(12));
        }

        console.log(`${statusEmoji} ${statusText} ${w.workflowId}`);
        console.log(`  Type: ${w.type}`);
        console.log(`  Started: ${w.startTime ? new Date(w.startTime).toISOString() : 'N/A'}`);
        console.log();
      });
    } catch (error) {
      spinner.fail(chalk.red('Failed to list workflows'));
      console.error(error);
      process.exit(1);
    }
  });

// Helper functions
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'RUNNING':
      return '🔄';
    case 'COMPLETED':
      return '✅';
    case 'FAILED':
      return '❌';
    case 'CANCELLED':
      return '⚠️';
    case 'TERMINATED':
      return '🛑';
    case 'TIMED_OUT':
      return '⏱️';
    default:
      return '❓';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'CANCELLED':
      return 'yellow';
    case 'TERMINATED':
      return 'red';
    case 'TIMED_OUT':
      return 'red';
    default:
      return 'gray';
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

program.parse();
