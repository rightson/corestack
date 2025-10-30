import { NextResponse } from 'next/server';
import { getMetrics, getMetricsContentType } from '@/lib/observability/metrics';

/**
 * Prometheus metrics endpoint
 * GET /api/metrics
 *
 * Returns metrics in Prometheus text format for scraping
 */
export async function GET() {
  const metrics = await getMetrics();

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': getMetricsContentType(),
    },
  });
}
