# CLI Guide

## Overview

The CLI client allows you to interact with the API and WebSocket server from the command line.

## Usage

All CLI commands follow this pattern:
```bash
npm run cli -- <command> [options]
```

## User Management

### List all users
```bash
npm run cli user list
```

### Get user by ID
```bash
npm run cli user get <id>
```

Example:
```bash
npm run cli user get 1
```

### Create a new user
```bash
npm run cli user create <name> <email>
```

Example:
```bash
npm run cli user create "John Doe" "john@example.com"
```

### Delete a user
```bash
npm run cli user delete <id>
```

Example:
```bash
npm run cli user delete 1
```

## Post Management

### List all posts
```bash
npm run cli post list
```

### Create a post
```bash
npm run cli post create <title> <content> --author <user-id>
```

Example:
```bash
npm run cli post create "My Title" "Post content" --author 1
```

## WebSocket

### Listen to a channel
```bash
npm run cli ws listen <channel>
```

Example:
```bash
npm run cli ws listen demo
```

This will keep the connection open and display messages as they arrive. Press Ctrl+C to exit.

### Send a message to a channel
```bash
npm run cli ws send <channel> <message>
```

Example:
```bash
npm run cli ws send demo "Hello, World!"
```

## Development

### Adding a New Command

1. Edit `cli/index.ts`
2. Add your command handler:

```typescript
program
  .command('mycommand')
  .description('My custom command')
  .action(async () => {
    // Your command logic here
  });
```

3. Test your command:
```bash
npm run cli mycommand
```

## Configuration

The CLI automatically uses the same environment variables as the main application:

```env
# API endpoint
PORT=3000

# WebSocket endpoint
WS_PORT=3001
```

## Error Handling

The CLI displays user-friendly error messages:

```bash
$ npm run cli user get 999
Error: User not found
```

## Output Formats

Most commands output formatted JSON for easy readability:

```bash
$ npm run cli user list
Users:
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```
