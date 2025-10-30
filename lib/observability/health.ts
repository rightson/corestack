import { db } from '@/lib/db';
import { redisConnection } from '@/lib/queue/config';
import { logger } from './logger';
import { sql } from 'drizzle-orm';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    [key: string]: {
      status: 'up' | 'down';
      message?: string;
      responseTime?: number;
    };
  };
  timestamp: string;
}

/**
 * Liveness probe - checks if the application is alive
 * Returns 200 if the process is running
 * This is a simple check that doesn't verify dependencies
 */
export async function checkLiveness(): Promise<HealthCheckResult> {
  return {
    status: 'healthy',
    checks: {
      server: {
        status: 'up',
        message: 'Server process is running',
      },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Readiness probe - checks if the application is ready to accept traffic
 * Verifies that all critical dependencies are available
 */
export async function checkReadiness(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};

  // Check database connection
  const dbCheck = await checkDatabase();
  checks.database = dbCheck;

  // Check Redis connection
  const redisCheck = await checkRedis();
  checks.redis = redisCheck;

  // Determine overall status
  const allHealthy = Object.values(checks).every((check) => check.status === 'up');

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check database connection health
 */
async function checkDatabase(): Promise<HealthCheckResult['checks'][string]> {
  const start = Date.now();
  try {
    // Simple query to check database connectivity
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - start;

    return {
      status: 'up',
      message: 'Database connection successful',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    logger.error({ error }, 'Database health check failed');

    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Database connection failed',
      responseTime,
    };
  }
}

/**
 * Check Redis connection health
 */
async function checkRedis(): Promise<HealthCheckResult['checks'][string]> {
  const start = Date.now();
  try {
    // Ping Redis to check connectivity
    await redisConnection.ping();
    const responseTime = Date.now() - start;

    return {
      status: 'up',
      message: 'Redis connection successful',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    logger.error({ error }, 'Redis health check failed');

    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Redis connection failed',
      responseTime,
    };
  }
}

/**
 * Startup probe - checks if the application has finished starting up
 * This can be more lenient with timeouts for slow-starting applications
 */
export async function checkStartup(): Promise<HealthCheckResult> {
  // For now, startup check is the same as readiness
  // In the future, this could include additional checks like:
  // - Database migrations completed
  // - Initial data loaded
  // - Cache warmed up
  return checkReadiness();
}
