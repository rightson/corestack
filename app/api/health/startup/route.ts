import { NextResponse } from 'next/server';
import { checkStartup } from '@/lib/observability/health';

/**
 * Startup probe endpoint
 * GET /api/health/startup
 *
 * Kubernetes startup probe - checks if the application has finished starting up
 * This can be more lenient with timeouts for slow-starting applications
 */
export async function GET() {
  const health = await checkStartup();

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  });
}
