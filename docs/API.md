# API Reference

## tRPC Endpoints

All tRPC endpoints are available at `/api/trpc/[procedure]`:

### Users

#### `user.list`
Get all users

**Input**: None

**Output**: Array of users

#### `user.getById`
Get user by ID

**Input**:
```typescript
{ id: number }
```

**Output**: User object or null

#### `user.create`
Create a new user

**Input**:
```typescript
{
  name: string,
  email: string
}
```

**Output**: Created user object

#### `user.update`
Update a user

**Input**:
```typescript
{
  id: number,
  name?: string,
  email?: string
}
```

**Output**: Updated user object

#### `user.delete`
Delete a user

**Input**:
```typescript
{ id: number }
```

**Output**: Success boolean

### Posts

#### `post.list`
Get all posts

**Input**: None

**Output**: Array of posts with author information

#### `post.getById`
Get post by ID

**Input**:
```typescript
{ id: number }
```

**Output**: Post object or null

#### `post.create`
Create a new post

**Input**:
```typescript
{
  title: string,
  content: string,
  authorId: number
}
```

**Output**: Created post object

#### `post.update`
Update a post

**Input**:
```typescript
{
  id: number,
  title?: string,
  content?: string
}
```

**Output**: Updated post object

#### `post.delete`
Delete a post

**Input**:
```typescript
{ id: number }
```

**Output**: Success boolean

## REST Endpoints

### Queue Management

#### `POST /api/queue/add`
Add a job to the queue

**Request Body**:
```json
{
  "queueName": "default" | "email" | "processing",
  "jobName": "my-job",
  "data": { "any": "data" }
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "job-id"
}
```

## WebSocket Protocol

WebSocket server runs on port 3001 (configurable via `WS_PORT`).

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001');
```

### Message Types

#### Subscribe to a channel
```json
{
  "type": "subscribe",
  "channel": "channel-name"
}
```

**Response**:
```json
{
  "type": "subscribed",
  "channel": "channel-name"
}
```

#### Unsubscribe from a channel
```json
{
  "type": "unsubscribe",
  "channel": "channel-name"
}
```

**Response**:
```json
{
  "type": "unsubscribed",
  "channel": "channel-name"
}
```

#### Broadcast a message
```json
{
  "type": "broadcast",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

**Notification** (sent to all subscribers):
```json
{
  "type": "message",
  "channel": "channel-name",
  "data": { "any": "data" }
}
```

#### Ping/Pong
**Send**:
```json
{
  "type": "ping"
}
```

**Response**:
```json
{
  "type": "pong"
}
```
