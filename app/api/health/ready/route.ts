import { NextResponse } from 'next/server';
import { checkReadiness } from '@/lib/observability/health';

/**
 * Readiness probe endpoint
 * GET /api/health/ready
 *
 * Kubernetes readiness probe - checks if the application is ready to accept traffic
 * Verifies that all critical dependencies (database, Redis, etc.) are available
 */
export async function GET() {
  const health = await checkReadiness();

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
