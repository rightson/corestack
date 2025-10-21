# Deployment Guide

## Production Build

### Build the Application

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

This starts the Next.js server on port 3000.

### Start All Services

You need to run multiple services in production:

```bash
# Terminal 1 - Next.js app
npm start

# Terminal 2 - WebSocket server
npm run ws:server

# Terminal 3 - Queue worker
npm run queue:worker
```

## Environment Setup

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# Server
PORT=3000
WS_PORT=3001
NODE_ENV=production

# Authentication
JWT_SECRET=your-production-secret-key-make-it-very-long-and-random

# LDAP (optional)
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password
LDAP_SEARCH_BASE=ou=users,dc=example,dc=com
```

**Important**:
- Use a strong, random `JWT_SECRET` in production
- Use production database credentials
- Set `NODE_ENV=production`

## Docker Deployment

### Using Docker Compose

The included `docker-compose.yml` provides PostgreSQL and Redis:

```bash
docker-compose up -d
```

### Custom Dockerfile

Create a `Dockerfile` for the application:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Build application
RUN npm run build

EXPOSE 3000 3001

# Start all services (consider using a process manager)
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t my-app .
docker run -p 3000:3000 -p 3001:3001 my-app
```

## Process Management

### Using PM2

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'web',
      script: 'npm',
      args: 'start',
    },
    {
      name: 'websocket',
      script: 'npm',
      args: 'run ws:server',
    },
    {
      name: 'queue-worker',
      script: 'npm',
      args: 'run queue:worker',
    },
  ],
};
```

Start all services:
```bash
pm2 start ecosystem.config.js
```

Monitor services:
```bash
pm2 status
pm2 logs
```

## Database Migration

Before deploying, apply database migrations:

```bash
npm run db:migrate
```

Never use `npm run db:push` in production. Always use migrations.

## Health Checks

### API Health Check
```bash
curl http://localhost:3000/api/health
```

### WebSocket Health Check
```bash
wscat -c ws://localhost:3001 -x '{"type":"ping"}'
```

## Scaling Considerations

### Horizontal Scaling

When running multiple instances:

1. **Database**: Use a single PostgreSQL instance with connection pooling
2. **Redis**: Use a single Redis instance for queue and WebSocket sync
3. **WebSocket**: Use Redis Pub/Sub to synchronize messages across instances
4. **Sessions**: Store sessions in Redis, not memory

### Load Balancing

Use a load balancer (nginx, HAProxy) for the Next.js app:

```nginx
upstream nextjs {
  server localhost:3000;
  server localhost:3001;
}

server {
  listen 80;

  location / {
    proxy_pass http://nextjs;
  }
}
```

## Monitoring

### Application Logs

```bash
# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f
```

### Database Monitoring

Use Drizzle Studio or connect directly to PostgreSQL:

```bash
psql $DATABASE_URL
```

### Queue Monitoring

Consider adding Bull Board for queue monitoring:

```bash
npm install @bull-board/express @bull-board/api
```

## Backup

### Database Backup

```bash
pg_dump $DATABASE_URL > backup.sql
```

### Database Restore

```bash
psql $DATABASE_URL < backup.sql
```

## Security Checklist

- [ ] Change default `JWT_SECRET`
- [ ] Use strong database passwords
- [ ] Enable SSL for PostgreSQL connections
- [ ] Use HTTPS in production
- [ ] Enable CORS restrictions
- [ ] Set up rate limiting
- [ ] Regular security updates (`npm audit`)
- [ ] Secure LDAP credentials
- [ ] Enable firewall rules
- [ ] Regular backups

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Issues

Check connection string and firewall rules:
```bash
psql $DATABASE_URL
```

### Redis Connection Issues

```bash
redis-cli -u $REDIS_URL ping
```
