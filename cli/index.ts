#!/usr/bin/env node

import { Command } from 'commander';
import { trpcClient } from '@/lib/trpc/client';
import WebSocket from 'ws';
import * as dotenv from 'dotenv';

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

program.parse();
