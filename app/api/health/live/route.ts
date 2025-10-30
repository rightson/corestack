import { NextResponse } from 'next/server';
import { checkLiveness } from '@/lib/observability/health';

/**
 * Liveness probe endpoint
 * GET /api/health/live
 *
 * Kubernetes liveness probe - checks if the application is alive
 * Returns 200 if the process is running
 */
export async function GET() {
  const health = await checkLiveness();

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
