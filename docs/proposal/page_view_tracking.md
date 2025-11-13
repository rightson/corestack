# Page View Tracking System

**Document Status**: Proposal
**Created**: 2025-11-09
**Version**: 1.0
**Target Implementation**: Q1 2026

---

## Executive Summary

This proposal outlines the design and implementation of a lightweight, high-performance page view tracking system for the corestack project. The system will enable administrators to:

- Track page views and user navigation patterns in real-time
- Identify hot routes, endpoints, and UI hotspots
- Analyze user behavior and application usage patterns
- Monitor API endpoint performance and usage
- Generate actionable insights with minimal performance overhead

**Key Features**:
- Sub-millisecond tracking overhead (< 0.5ms per event)
- Real-time analytics dashboard
- Privacy-focused design (GDPR compliant)
- Automatic route detection and categorization
- Click heatmap visualization
- API endpoint usage analytics

**Technology Stack**: Next.js middleware, Redis streams, BullMQ, Temporal workflows, tRPC, PostgreSQL with time-series partitioning, React with D3.js

---

## Table of Contents

1. [Motivation](#motivation)
2. [Design Principles](#design-principles)
3. [Architecture Overview](#architecture-overview)
4. [Functional Requirements](#functional-requirements)
5. [Technical Specification](#technical-specification)
6. [Data Model](#data-model)
7. [User Interface](#user-interface)
8. [Implementation Phases](#implementation-phases)
9. [Performance Considerations](#performance-considerations)
10. [Privacy & Compliance](#privacy--compliance)
11. [Testing Strategy](#testing-strategy)
12. [Future Enhancements](#future-enhancements)

---

## Motivation

### Current Challenges

1. **Limited Visibility**: No insight into which features are most used
2. **Performance Blind Spots**: Unclear which endpoints are under heavy load
3. **User Experience**: Cannot identify where users struggle or spend time
4. **Resource Planning**: Difficult to prioritize optimization efforts
5. **Business Intelligence**: No data-driven decision making for feature development

### Business Value

- **User Behavior Insights**: Understand how users navigate and use the application
- **Performance Optimization**: Identify and optimize heavily-used endpoints
- **Feature Prioritization**: Data-driven decisions on what to build next
- **Issue Detection**: Quickly identify problematic areas with high abandonment
- **Resource Allocation**: Optimize infrastructure based on actual usage patterns

### Success Metrics

- Track all page views with < 1% overhead
- Real-time dashboard updates (< 5 second latency)
- Support 10,000+ page views per minute
- 100% coverage of routes and API endpoints
- < 100MB memory footprint for 1M events

---

## Design Principles

### 1. **Minimal Performance Impact**
- Non-blocking data collection
- Async processing with batching
- Efficient storage using time-series optimizations
- No impact on user-facing request latency

### 2. **Privacy-First**
- No PII (Personally Identifiable Information) collection by default
- Anonymized user identifiers
- Configurable data retention policies
- GDPR and privacy compliance built-in

### 3. **Real-Time Insights**
- Stream-based processing for live updates
- Sub-second dashboard refresh rates
- Immediate anomaly detection
- Live event feed for monitoring

### 4. **Developer-Friendly**
- Automatic tracking with zero code changes for routes
- Simple API for custom event tracking
- TypeScript support with full type safety
- Easy to disable in development/testing

### 5. **Scalable Architecture**
- Horizontal scaling support
- Time-based data partitioning
- Automatic data aggregation and rollups
- Configurable retention and archival

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Next.js App │  │ Click Tracker│  │ API Client (tRPC)│   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼────────────────┼───────────────────┼─────────────┘
          │                │                   │
          │ Page Views     │ UI Events         │ API Calls
          │                │                   │
┌─────────▼────────────────▼───────────────────▼─────────────┐
│                    Next.js Middleware                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  - Route Detection                                    │   │
│  │  - User Session Management                            │   │
│  │  - Event Enrichment (timing, referrer, etc.)          │   │
│  │  - Privacy Filtering                                  │   │
│  └──────────────────────┬───────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                          │
                          │ Tracking Events
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                    Redis Streams                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Stream: tracking:events (buffered ingestion)         │ │
│  │ - High-throughput write buffer                        │ │
│  │ - Consumer groups for parallel processing            │ │
│  └──────────────────────┬───────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────┘
                          │
                          │ Event Stream
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                  BullMQ Queue Workers                       │
│  ┌────────────────────┐                                    │
│  │ Event Processor    │  (High-throughput, short-lived)   │
│  │ - Parse events     │                                    │
│  │ - Validate data    │                                    │
│  │ - Write to DB      │                                    │
│  └────────┬───────────┘                                    │
└───────────┼─────────────────────────────────────────────────┘
            │
            │ Raw Events
            │
┌───────────▼──────────────────────────────────────────────┐
│                Temporal Workflows                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Analytics Workflows (Long-running, reliable)       │  │
│  │                                                     │  │
│  │ 1. Aggregation Workflow (Cron: every 1 min)       │  │
│  │    - 1-minute rollups                              │  │
│  │    - 1-hour rollups (every hour)                   │  │
│  │    - 1-day rollups (daily at midnight)             │  │
│  │                                                     │  │
│  │ 2. Data Retention Workflow (Cron: daily)           │  │
│  │    - Delete expired raw events                     │  │
│  │    - Drop old partitions                           │  │
│  │    - Archive to cold storage                       │  │
│  │                                                     │  │
│  │ 3. Report Generation Workflow (On-demand)          │  │
│  │    - Weekly analytics reports                      │  │
│  │    - Custom date range exports                     │  │
│  │    - Scheduled email reports                       │  │
│  └────────┬───────────────────────────────────────────┘  │
└───────────┼──────────────────────────────────────────────┘
            │
            │ Aggregated Stats & Maintenance
            │
┌───────────▼──────────────────────────▼─────────────────────┐
│                    PostgreSQL Database                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tables:                                               │  │
│  │ - page_views (time-series, partitioned by day)       │  │
│  │ - click_events (heatmap data)                        │  │
│  │ - api_calls (endpoint tracking)                      │  │
│  │ - analytics_1min (1-minute aggregates)               │  │
│  │ - analytics_1hour (1-hour aggregates)                │  │
│  │ - analytics_1day (1-day aggregates)                  │  │
│  └──────────────────────┬───────────────────────────────┘  │
└───────────────────────┼─────────────────────────────────────┘
                          │
                          │ Query Data
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                    Analytics API (tRPC)                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Endpoints:                                            │ │
│  │ - getPageViews(dateRange, filters)                   │ │
│  │ - getHotRoutes(limit, period)                        │ │
│  │ - getClickHeatmap(route, dateRange)                  │ │
│  │ - getAPIUsage(endpoint, dateRange)                   │ │
│  │ - getLiveStats() (Redis-backed)                      │ │
│  └──────────────────────┬───────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────┘
                          │
                          │ API Response
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                  Analytics Dashboard (React)                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Components:                                           │ │
│  │ - Live Stats Overview                                 │ │
│  │ - Hot Routes Table                                    │ │
│  │ - Page View Time Series Chart                        │ │
│  │ - Click Heatmap Visualization                        │ │
│  │ - API Endpoint Usage Table                           │ │
│  │ - User Journey Flow Diagram                          │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Collection**: Client-side events and server-side middleware capture tracking data
2. **Ingestion**: Events written to Redis Streams (high-throughput buffer)
3. **Processing**: BullMQ workers consume events, validate, and persist to PostgreSQL
4. **Aggregation**: Temporal workflows create time-based rollups (1min, 1hour, 1day) on scheduled cron triggers
5. **Retention**: Temporal workflows handle data cleanup and partition management
6. **Query**: tRPC API serves analytics data to dashboard
7. **Visualization**: React dashboard displays real-time and historical insights

### BullMQ vs Temporal: Division of Responsibilities

The analytics system uses both BullMQ and Temporal, each optimized for different workload characteristics:

#### BullMQ (High-Throughput, Short-Lived Tasks)

**Use Cases:**
- Real-time event processing (page views, clicks, API calls)
- Immediate data validation and persistence
- High-frequency, low-latency operations

**Characteristics:**
- Handles 10,000+ events per minute
- Sub-100ms processing time per batch
- Stateless processing
- Minimal retry logic (events are best-effort)

**Why BullMQ:**
- Optimized for high-throughput message processing
- Lightweight overhead for simple transformations
- Direct Redis integration for event streams
- Fast worker startup and shutdown

#### Temporal (Long-Running, Reliable Workflows)

**Use Cases:**
- Scheduled aggregation jobs (cron-based)
- Data retention and cleanup workflows
- Report generation (potentially long-running)
- Multi-step analytics pipelines

**Characteristics:**
- Cron schedules (every 1 min, hourly, daily)
- Built-in retry and error handling
- Workflow state persistence
- Long-running operations (minutes to hours)

**Why Temporal:**
- Reliable execution with automatic retries
- Durable workflow state (survives restarts)
- Cron scheduling built-in
- Visibility into workflow execution history
- Consistent with rest of corestack architecture

**Example Workflow Schedules:**
```typescript
// Temporal cron expressions
- Aggregation (1-min): "*/1 * * * *"  // Every minute
- Aggregation (1-hour): "0 * * * *"   // Every hour at :00
- Aggregation (1-day): "0 0 * * *"    // Daily at midnight
- Data Retention: "0 2 * * *"         // Daily at 2 AM
- Weekly Reports: "0 9 * * MON"       // Mondays at 9 AM
```

---

## Functional Requirements

### 1. Page View Tracking

#### Automatic Route Tracking

**Objective**: Track all Next.js page navigations automatically without code changes.

**Captured Data**:
- Route path (e.g., `/dashboard`, `/users/[id]`)
- Route parameters (e.g., `{ id: "123" }`)
- Timestamp (millisecond precision)
- Session ID (anonymized)
- User ID (if authenticated)
- Referrer page
- User agent (parsed: browser, OS, device type)
- Page load time
- Time on page (calculated on next navigation)
- Exit page indicator

**Implementation**: Next.js middleware intercepts all requests

**Example Event**:
```typescript
{
  eventType: 'page_view',
  route: '/dashboard',
  params: {},
  timestamp: '2025-11-09T10:30:45.123Z',
  sessionId: 'anon_7f3a9b2c',
  userId: 'user_123', // if authenticated
  referrer: '/login',
  userAgent: {
    browser: 'Chrome',
    version: '118.0',
    os: 'macOS',
    device: 'desktop'
  },
  loadTime: 342, // ms
  timeOnPage: null // calculated later
}
```

### 2. Click Heatmap Tracking

#### UI Interaction Tracking

**Objective**: Track where users click to identify hotspots and dead zones.

**Captured Data**:
- Route path
- Element selector (e.g., `button#submit`, `a.nav-link`)
- Click coordinates (x, y) as percentage of viewport
- Viewport dimensions
- Timestamp
- Session ID

**Client-Side Implementation**: Lightweight click listener

**Privacy**: No text content captured, only element type and position

**Example Event**:
```typescript
{
  eventType: 'click',
  route: '/dashboard',
  element: 'button#create-project',
  position: { x: 45.2, y: 67.8 }, // percentage of viewport
  viewport: { width: 1920, height: 1080 },
  timestamp: '2025-11-09T10:31:12.456Z',
  sessionId: 'anon_7f3a9b2c'
}
```

### 3. API Endpoint Tracking

#### Automatic API Monitoring

**Objective**: Track all tRPC/API endpoint calls, response times, and error rates.

**Captured Data**:
- Endpoint name (e.g., `user.list`, `project.create`)
- HTTP method (for REST APIs)
- Response status code
- Response time (ms)
- Request size (bytes)
- Response size (bytes)
- Error details (if failed)
- Session ID
- User ID

**Implementation**: tRPC middleware + Next.js API route wrapper

**Example Event**:
```typescript
{
  eventType: 'api_call',
  endpoint: 'user.list',
  method: 'GET',
  statusCode: 200,
  responseTime: 45, // ms
  requestSize: 256,
  responseSize: 4096,
  error: null,
  timestamp: '2025-11-09T10:31:15.789Z',
  sessionId: 'anon_7f3a9b2c',
  userId: 'user_123'
}
```

### 4. Analytics Dashboard

#### Real-Time Overview

**Displays**:
- Current active users (last 5 minutes)
- Page views (last hour, day, week)
- Top 10 routes (by view count)
- Average session duration
- Bounce rate (single-page sessions)

**Refresh Rate**: Every 5 seconds

#### Hot Routes Analysis

**Displays**:
- Ranked list of most-visited routes
- View count, unique visitors, avg time on page
- Trend indicator (↑↓)
- Time period selector (1h, 24h, 7d, 30d)

**Features**:
- Filter by authenticated vs anonymous users
- Export to CSV
- Drill-down to route details

#### Click Heatmap Visualization

**Displays**:
- Interactive heatmap overlay on route screenshots/wireframes
- Color-coded click density
- Element-level click counts
- Dead zone identification (no clicks)

**Features**:
- Route selector
- Date range picker
- Filter by device type (desktop/mobile/tablet)

#### API Endpoint Performance

**Displays**:
- Endpoint usage table (calls, avg response time, error rate)
- Response time percentiles (p50, p95, p99)
- Error rate trends
- Slowest endpoints

**Features**:
- Time series charts
- Correlation with page views
- Alert thresholds

### 5. Admin Controls

#### Configuration

- Enable/disable tracking globally
- Enable/disable by environment (dev/staging/prod)
- Configure data retention policies
- Exclude specific routes from tracking
- Anonymization settings

#### Data Management

- Manual data purge
- Export historical data
- Import/restore backups
- View storage usage

---

## Technical Specification

### Next.js Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { trackPageView } from '@/lib/analytics/tracker';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Skip tracking for static assets and API routes (tracked separately)
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.match(/\.(ico|png|jpg|svg|css|js)$/)
  ) {
    return response;
  }

  // Extract tracking data
  const trackingData = {
    route: request.nextUrl.pathname,
    params: Object.fromEntries(request.nextUrl.searchParams),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(request),
    userId: getUserId(request),
    referrer: request.headers.get('referer') || null,
    userAgent: parseUserAgent(request.headers.get('user-agent') || '')
  };

  // Non-blocking: fire-and-forget
  trackPageView(trackingData).catch(err => {
    // Log error but don't block response
    console.error('Tracking error:', err);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Client-Side Click Tracking

```typescript
// lib/analytics/click-tracker.ts
export function initClickTracking() {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost' && !ENABLE_DEV_TRACKING) return;

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    // Get element selector
    const selector = getElementSelector(target);

    // Calculate position as percentage
    const rect = document.documentElement.getBoundingClientRect();
    const position = {
      x: (event.clientX / rect.width) * 100,
      y: (event.clientY / rect.height) * 100
    };

    const clickEvent = {
      eventType: 'click',
      route: window.location.pathname,
      element: selector,
      position,
      viewport: {
        width: rect.width,
        height: rect.height
      },
      timestamp: new Date().toISOString(),
      sessionId: getSessionId()
    };

    // Send via beacon API (non-blocking, survives page navigation)
    sendTrackingEvent(clickEvent);
  }, { passive: true });
}

function getElementSelector(element: HTMLElement): string {
  // Priority: id > specific classes > tag name
  if (element.id) return `${element.tagName.toLowerCase()}#${element.id}`;

  const meaningfulClasses = Array.from(element.classList)
    .filter(cls => !cls.startsWith('_') && !cls.match(/^[a-z0-9]{6,}$/)) // filter generated classes
    .slice(0, 2);

  if (meaningfulClasses.length > 0) {
    return `${element.tagName.toLowerCase()}.${meaningfulClasses.join('.')}`;
  }

  return element.tagName.toLowerCase();
}

function sendTrackingEvent(event: TrackingEvent) {
  // Use navigator.sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', JSON.stringify(event));
  } else {
    // Fallback to fetch
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true
    }).catch(() => {}); // Ignore errors
  }
}
```

### Redis Stream Ingestion

```typescript
// lib/analytics/tracker.ts
import { redis } from '@/lib/redis';

const STREAM_KEY = 'tracking:events';
const MAX_STREAM_LENGTH = 100000; // Trim to prevent unbounded growth

export async function trackPageView(data: PageViewData): Promise<void> {
  await redis.xadd(
    STREAM_KEY,
    'MAXLEN', '~', MAX_STREAM_LENGTH, // Approximate trimming for performance
    '*', // Auto-generate ID
    'type', 'page_view',
    'data', JSON.stringify(data)
  );
}

export async function trackClick(data: ClickData): Promise<void> {
  await redis.xadd(
    STREAM_KEY,
    'MAXLEN', '~', MAX_STREAM_LENGTH,
    '*',
    'type', 'click',
    'data', JSON.stringify(data)
  );
}

export async function trackAPICall(data: APICallData): Promise<void> {
  await redis.xadd(
    STREAM_KEY,
    'MAXLEN', '~', MAX_STREAM_LENGTH,
    '*',
    'type', 'api_call',
    'data', JSON.stringify(data)
  );
}
```

### BullMQ Event Processor

```typescript
// server/queue/workers/analytics-processor.ts
import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';
import { pageViews, clickEvents, apiCalls } from '@/lib/db/schema';

const STREAM_KEY = 'tracking:events';
const CONSUMER_GROUP = 'analytics-processors';
const CONSUMER_NAME = `processor-${process.pid}`;
const BATCH_SIZE = 100;

// Create consumer group if not exists
redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM').catch(() => {});

// Worker to continuously consume from stream
async function processEventStream() {
  while (true) {
    try {
      // Read batch of events
      const results = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'BLOCK', 5000, // 5 second timeout
        'COUNT', BATCH_SIZE,
        'STREAMS', STREAM_KEY, '>'
      );

      if (!results || results.length === 0) continue;

      const [streamName, messages] = results[0];

      // Process batch
      await processBatch(messages);

      // Acknowledge messages
      const messageIds = messages.map(([id]) => id);
      await redis.xack(STREAM_KEY, CONSUMER_GROUP, ...messageIds);

    } catch (error) {
      console.error('Stream processing error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Backoff
    }
  }
}

async function processBatch(messages: any[]) {
  const pageViewBatch = [];
  const clickBatch = [];
  const apiCallBatch = [];

  for (const [id, fields] of messages) {
    const type = fields[1]; // fields[0] is 'type', fields[1] is value
    const data = JSON.parse(fields[3]); // fields[2] is 'data', fields[3] is value

    switch (type) {
      case 'page_view':
        pageViewBatch.push({
          route: data.route,
          params: data.params,
          timestamp: new Date(data.timestamp),
          sessionId: data.sessionId,
          userId: data.userId,
          referrer: data.referrer,
          browser: data.userAgent.browser,
          os: data.userAgent.os,
          device: data.userAgent.device,
          loadTime: data.loadTime
        });
        break;

      case 'click':
        clickBatch.push({
          route: data.route,
          element: data.element,
          positionX: data.position.x,
          positionY: data.position.y,
          viewportWidth: data.viewport.width,
          viewportHeight: data.viewport.height,
          timestamp: new Date(data.timestamp),
          sessionId: data.sessionId
        });
        break;

      case 'api_call':
        apiCallBatch.push({
          endpoint: data.endpoint,
          method: data.method,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
          requestSize: data.requestSize,
          responseSize: data.responseSize,
          error: data.error,
          timestamp: new Date(data.timestamp),
          sessionId: data.sessionId,
          userId: data.userId
        });
        break;
    }
  }

  // Batch insert to database
  if (pageViewBatch.length > 0) {
    await db.insert(pageViews).values(pageViewBatch);
  }
  if (clickBatch.length > 0) {
    await db.insert(clickEvents).values(clickBatch);
  }
  if (apiCallBatch.length > 0) {
    await db.insert(apiCalls).values(apiCallBatch);
  }
}

// Start processing
processEventStream();
```

### Temporal Workflows

#### Aggregation Workflow

```typescript
// server/temporal/workflows/analytics-aggregation.ts
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/analytics';

const {
  aggregateOneMinute,
  aggregateOneHour,
  aggregateOneDay
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '60s',
    maximumAttempts: 5
  }
});

/**
 * 1-Minute Aggregation Workflow
 * Runs every minute via cron schedule: "*/1 * * * *"
 */
export async function minuteAggregationWorkflow(): Promise<void> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 1000); // Last minute

  await aggregateOneMinute(startTime, endTime);
}

/**
 * Hourly Aggregation Workflow
 * Runs every hour via cron schedule: "0 * * * *"
 */
export async function hourlyAggregationWorkflow(): Promise<void> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

  await aggregateOneHour(startTime, endTime);
}

/**
 * Daily Aggregation Workflow
 * Runs daily at midnight via cron schedule: "0 0 * * *"
 */
export async function dailyAggregationWorkflow(): Promise<void> {
  const endTime = new Date();
  endTime.setHours(0, 0, 0, 0); // Start of today
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Yesterday

  await aggregateOneDay(startTime, endTime);
}
```

#### Data Retention Workflow

```typescript
// server/temporal/workflows/analytics-retention.ts
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/analytics';

const {
  deleteExpiredEvents,
  dropOldPartitions,
  archiveToStorage
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5s',
    maximumInterval: '5m',
    maximumAttempts: 3
  }
});

/**
 * Data Retention Workflow
 * Runs daily at 2 AM via cron schedule: "0 2 * * *"
 */
export async function dataRetentionWorkflow(
  retentionDays: number = 90
): Promise<{ deletedEvents: number; droppedPartitions: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Step 1: Archive old data to cold storage (optional)
  await archiveToStorage(cutoffDate);

  // Step 2: Delete expired events from raw tables
  const deletedEvents = await deleteExpiredEvents(cutoffDate);

  // Step 3: Drop old partitions (PostgreSQL partitions)
  const droppedPartitions = await dropOldPartitions(cutoffDate);

  return { deletedEvents, droppedPartitions };
}
```

#### Temporal Activities

```typescript
// server/temporal/activities/analytics.ts
import { db } from '@/lib/db';
import {
  pageViews,
  clickEvents,
  apiCalls,
  analytics1min,
  analytics1hour,
  analytics1day
} from '@/lib/db/schema';
import { sql, and, gte, lt, lte } from 'drizzle-orm';

/**
 * Aggregate page views into 1-minute buckets
 */
export async function aggregateOneMinute(
  startTime: Date,
  endTime: Date
): Promise<void> {
  await db.insert(analytics1min)
    .select(
      db.select({
        id: sql`gen_random_uuid()`,
        timestamp: sql`date_trunc('minute', ${pageViews.timestamp})`,
        route: pageViews.route,
        pageViews: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})`,
        avgLoadTime: sql<number>`avg(${pageViews.loadTime})`,
        createdAt: sql`now()`
      })
      .from(pageViews)
      .where(
        and(
          gte(pageViews.timestamp, startTime),
          lt(pageViews.timestamp, endTime)
        )
      )
      .groupBy(sql`date_trunc('minute', ${pageViews.timestamp})`, pageViews.route)
    );
}

/**
 * Aggregate page views into 1-hour buckets
 */
export async function aggregateOneHour(
  startTime: Date,
  endTime: Date
): Promise<void> {
  await db.insert(analytics1hour)
    .select(
      db.select({
        id: sql`gen_random_uuid()`,
        timestamp: sql`date_trunc('hour', ${pageViews.timestamp})`,
        route: pageViews.route,
        pageViews: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})`,
        avgLoadTime: sql<number>`avg(${pageViews.loadTime})`,
        createdAt: sql`now()`
      })
      .from(pageViews)
      .where(
        and(
          gte(pageViews.timestamp, startTime),
          lt(pageViews.timestamp, endTime)
        )
      )
      .groupBy(sql`date_trunc('hour', ${pageViews.timestamp})`, pageViews.route)
    );
}

/**
 * Aggregate page views into 1-day buckets
 */
export async function aggregateOneDay(
  startTime: Date,
  endTime: Date
): Promise<void> {
  await db.insert(analytics1day)
    .select(
      db.select({
        id: sql`gen_random_uuid()`,
        date: sql`date_trunc('day', ${pageViews.timestamp})`,
        route: pageViews.route,
        pageViews: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})`,
        avgLoadTime: sql<number>`avg(${pageViews.loadTime})`,
        createdAt: sql`now()`
      })
      .from(pageViews)
      .where(
        and(
          gte(pageViews.timestamp, startTime),
          lt(pageViews.timestamp, endTime)
        )
      )
      .groupBy(sql`date_trunc('day', ${pageViews.timestamp})`, pageViews.route)
    );
}

/**
 * Delete expired events older than cutoff date
 */
export async function deleteExpiredEvents(cutoffDate: Date): Promise<number> {
  const pageViewsResult = await db.delete(pageViews)
    .where(lte(pageViews.timestamp, cutoffDate));

  const clickEventsResult = await db.delete(clickEvents)
    .where(lte(clickEvents.timestamp, cutoffDate));

  const apiCallsResult = await db.delete(apiCalls)
    .where(lte(apiCalls.timestamp, cutoffDate));

  return (pageViewsResult.rowCount || 0) +
         (clickEventsResult.rowCount || 0) +
         (apiCallsResult.rowCount || 0);
}

/**
 * Drop old PostgreSQL partitions
 */
export async function dropOldPartitions(cutoffDate: Date): Promise<number> {
  // Get list of partitions older than cutoff
  const partitions = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'page_views_%'
      AND tablename < ${`page_views_${cutoffDate.toISOString().split('T')[0].replace(/-/g, '_')}`}
  `);

  let dropped = 0;
  for (const partition of partitions.rows) {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(partition.tablename)}`);
    dropped++;
  }

  return dropped;
}

/**
 * Archive old data to cold storage (S3, etc.)
 */
export async function archiveToStorage(cutoffDate: Date): Promise<void> {
  // Implementation depends on storage backend
  // Example: Export to S3, then delete from primary DB
  // This is a placeholder for future implementation
  console.log(`Archiving data older than ${cutoffDate.toISOString()}`);
}
```

#### Workflow Registration

```typescript
// server/temporal/worker.ts
import { Worker } from '@temporalio/worker';
import * as activities from './activities/analytics';
import {
  minuteAggregationWorkflow,
  hourlyAggregationWorkflow,
  dailyAggregationWorkflow,
  dataRetentionWorkflow
} from './workflows/analytics-aggregation';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'analytics-tasks',
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

#### Scheduling Workflows

```typescript
// server/temporal/schedules.ts
import { Client, ScheduleOverlapPolicy } from '@temporalio/client';

const client = new Client({
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
});

/**
 * Create or update analytics workflow schedules
 */
export async function setupAnalyticsSchedules() {
  // 1-minute aggregation schedule
  await client.schedule.create({
    scheduleId: 'analytics-1min-aggregation',
    spec: {
      cronExpressions: ['*/1 * * * *'], // Every minute
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'minuteAggregationWorkflow',
      taskQueue: 'analytics-tasks',
    },
    policies: {
      overlap: ScheduleOverlapPolicy.SKIP, // Skip if previous run still active
    },
  });

  // Hourly aggregation schedule
  await client.schedule.create({
    scheduleId: 'analytics-1hour-aggregation',
    spec: {
      cronExpressions: ['0 * * * *'], // Every hour at :00
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'hourlyAggregationWorkflow',
      taskQueue: 'analytics-tasks',
    },
    policies: {
      overlap: ScheduleOverlapPolicy.SKIP,
    },
  });

  // Daily aggregation schedule
  await client.schedule.create({
    scheduleId: 'analytics-1day-aggregation',
    spec: {
      cronExpressions: ['0 0 * * *'], // Daily at midnight
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'dailyAggregationWorkflow',
      taskQueue: 'analytics-tasks',
    },
    policies: {
      overlap: ScheduleOverlapPolicy.SKIP,
    },
  });

  // Data retention schedule
  await client.schedule.create({
    scheduleId: 'analytics-data-retention',
    spec: {
      cronExpressions: ['0 2 * * *'], // Daily at 2 AM
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'dataRetentionWorkflow',
      taskQueue: 'analytics-tasks',
      args: [90], // 90 days retention
    },
    policies: {
      overlap: ScheduleOverlapPolicy.SKIP,
    },
  });

  console.log('Analytics schedules created successfully');
}
```

### tRPC Analytics API

```typescript
// server/api/routers/analytics.ts
import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { db } from '@/lib/db';
import { pageViews, clickEvents, apiCalls } from '@/lib/db/schema';
import { sql, desc, and, gte, lte, eq } from 'drizzle-orm';

export const analyticsRouter = router({
  // Get page view statistics
  getPageViews: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      route: z.string().optional()
    }))
    .query(async ({ input }) => {
      const conditions = [
        gte(pageViews.timestamp, input.startDate),
        lte(pageViews.timestamp, input.endDate)
      ];

      if (input.route) {
        conditions.push(eq(pageViews.route, input.route));
      }

      const results = await db
        .select({
          route: pageViews.route,
          count: sql<number>`count(*)`,
          uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})`,
          avgLoadTime: sql<number>`avg(${pageViews.loadTime})`
        })
        .from(pageViews)
        .where(and(...conditions))
        .groupBy(pageViews.route)
        .orderBy(desc(sql`count(*)`));

      return results;
    }),

  // Get hot routes
  getHotRoutes: adminProcedure
    .input(z.object({
      limit: z.number().default(10),
      periodHours: z.number().default(24)
    }))
    .query(async ({ input }) => {
      const startDate = new Date(Date.now() - input.periodHours * 60 * 60 * 1000);

      const results = await db
        .select({
          route: pageViews.route,
          views: sql<number>`count(*)`,
          uniqueVisitors: sql<number>`count(distinct ${pageViews.sessionId})`,
          avgTimeOnPage: sql<number>`avg(extract(epoch from (lead(${pageViews.timestamp}) over (partition by ${pageViews.sessionId} order by ${pageViews.timestamp}) - ${pageViews.timestamp})))`
        })
        .from(pageViews)
        .where(gte(pageViews.timestamp, startDate))
        .groupBy(pageViews.route)
        .orderBy(desc(sql`count(*)`))
        .limit(input.limit);

      return results;
    }),

  // Get click heatmap data
  getClickHeatmap: adminProcedure
    .input(z.object({
      route: z.string(),
      startDate: z.date(),
      endDate: z.date()
    }))
    .query(async ({ input }) => {
      const results = await db
        .select({
          element: clickEvents.element,
          clicks: sql<number>`count(*)`,
          avgX: sql<number>`avg(${clickEvents.positionX})`,
          avgY: sql<number>`avg(${clickEvents.positionY})`
        })
        .from(clickEvents)
        .where(
          and(
            eq(clickEvents.route, input.route),
            gte(clickEvents.timestamp, input.startDate),
            lte(clickEvents.timestamp, input.endDate)
          )
        )
        .groupBy(clickEvents.element);

      return results;
    }),

  // Get API endpoint usage
  getAPIUsage: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      endpoint: z.string().optional()
    }))
    .query(async ({ input }) => {
      const conditions = [
        gte(apiCalls.timestamp, input.startDate),
        lte(apiCalls.timestamp, input.endDate)
      ];

      if (input.endpoint) {
        conditions.push(eq(apiCalls.endpoint, input.endpoint));
      }

      const results = await db
        .select({
          endpoint: apiCalls.endpoint,
          calls: sql<number>`count(*)`,
          avgResponseTime: sql<number>`avg(${apiCalls.responseTime})`,
          p95ResponseTime: sql<number>`percentile_cont(0.95) within group (order by ${apiCalls.responseTime})`,
          errorRate: sql<number>`(count(*) filter (where ${apiCalls.statusCode} >= 400))::float / count(*) * 100`,
          avgRequestSize: sql<number>`avg(${apiCalls.requestSize})`,
          avgResponseSize: sql<number>`avg(${apiCalls.responseSize})`
        })
        .from(apiCalls)
        .where(and(...conditions))
        .groupBy(apiCalls.endpoint)
        .orderBy(desc(sql`count(*)`));

      return results;
    }),

  // Get live statistics (from Redis)
  getLiveStats: adminProcedure.query(async () => {
    // Implement using Redis for real-time stats
    // Count unique sessions in last 5 minutes
    // Count page views in last hour
    // etc.
  })
});
```

---

## Data Model

### Database Schema

```typescript
// lib/db/schema/analytics.ts
import { pgTable, varchar, timestamp, integer, json, real, index } from 'drizzle-orm/pg-core';

// Page views table (partitioned by day)
export const pageViews = pgTable('page_views', {
  id: varchar('id', { length: 26 }).primaryKey(), // ULID
  route: varchar('route', { length: 255 }).notNull(),
  params: json('params'),
  timestamp: timestamp('timestamp').notNull(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 26 }), // null for anonymous
  referrer: varchar('referrer', { length: 255 }),
  browser: varchar('browser', { length: 50 }),
  os: varchar('os', { length: 50 }),
  device: varchar('device', { length: 20 }), // desktop, mobile, tablet
  loadTime: integer('load_time'), // milliseconds
  timeOnPage: integer('time_on_page'), // seconds, calculated
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampIdx: index('page_views_timestamp_idx').on(table.timestamp),
  routeIdx: index('page_views_route_idx').on(table.route),
  sessionIdx: index('page_views_session_idx').on(table.sessionId),
  userIdx: index('page_views_user_idx').on(table.userId)
}));

// Click events table
export const clickEvents = pgTable('click_events', {
  id: varchar('id', { length: 26 }).primaryKey(),
  route: varchar('route', { length: 255 }).notNull(),
  element: varchar('element', { length: 255 }).notNull(),
  positionX: real('position_x').notNull(), // percentage
  positionY: real('position_y').notNull(), // percentage
  viewportWidth: integer('viewport_width').notNull(),
  viewportHeight: integer('viewport_height').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampIdx: index('click_events_timestamp_idx').on(table.timestamp),
  routeIdx: index('click_events_route_idx').on(table.route),
  elementIdx: index('click_events_element_idx').on(table.element)
}));

// API calls table
export const apiCalls = pgTable('api_calls', {
  id: varchar('id', { length: 26 }).primaryKey(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  statusCode: integer('status_code').notNull(),
  responseTime: integer('response_time').notNull(), // milliseconds
  requestSize: integer('request_size'), // bytes
  responseSize: integer('response_size'), // bytes
  error: varchar('error', { length: 500 }),
  timestamp: timestamp('timestamp').notNull(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 26 }),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampIdx: index('api_calls_timestamp_idx').on(table.timestamp),
  endpointIdx: index('api_calls_endpoint_idx').on(table.endpoint),
  statusIdx: index('api_calls_status_idx').on(table.statusCode)
}));

// Aggregated analytics tables (for performance)
export const analytics1min = pgTable('analytics_1min', {
  id: varchar('id', { length: 26 }).primaryKey(),
  timestamp: timestamp('timestamp').notNull(), // rounded to minute
  route: varchar('route', { length: 255 }).notNull(),
  pageViews: integer('page_views').notNull(),
  uniqueVisitors: integer('unique_visitors').notNull(),
  avgLoadTime: integer('avg_load_time'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampRouteIdx: index('analytics_1min_timestamp_route_idx').on(table.timestamp, table.route)
}));

export const analytics1hour = pgTable('analytics_1hour', {
  id: varchar('id', { length: 26 }).primaryKey(),
  timestamp: timestamp('timestamp').notNull(), // rounded to hour
  route: varchar('route', { length: 255 }).notNull(),
  pageViews: integer('page_views').notNull(),
  uniqueVisitors: integer('unique_visitors').notNull(),
  avgLoadTime: integer('avg_load_time'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  timestampRouteIdx: index('analytics_1hour_timestamp_route_idx').on(table.timestamp, table.route)
}));

export const analytics1day = pgTable('analytics_1day', {
  id: varchar('id', { length: 26 }).primaryKey(),
  date: timestamp('date').notNull(), // rounded to day
  route: varchar('route', { length: 255 }).notNull(),
  pageViews: integer('page_views').notNull(),
  uniqueVisitors: integer('unique_visitors').notNull(),
  avgLoadTime: integer('avg_load_time'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  dateRouteIdx: index('analytics_1day_date_route_idx').on(table.date, table.route)
}));
```

### Table Partitioning Strategy

**page_views** table: Partition by day using PostgreSQL native partitioning

```sql
-- Create parent table
CREATE TABLE page_views (
  id VARCHAR(26) PRIMARY KEY,
  route VARCHAR(255) NOT NULL,
  -- ... other columns
  timestamp TIMESTAMP NOT NULL
) PARTITION BY RANGE (timestamp);

-- Create partitions (automated via migration or cron)
CREATE TABLE page_views_2025_11_09 PARTITION OF page_views
  FOR VALUES FROM ('2025-11-09 00:00:00') TO ('2025-11-10 00:00:00');

-- Automatically drop old partitions based on retention policy
-- Example: Keep 90 days, drop older partitions
```

---

## User Interface

### Analytics Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Analytics Dashboard                        [Last 24 hours ▼]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Active Users │  │  Page Views  │  │  Avg Session     │  │
│  │     127      │  │    12,450    │  │   3m 24s         │  │
│  │  ▲ +12%      │  │  ▲ +8%       │  │  ▼ -5%           │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Page Views Over Time                                   │  │
│  │ [Line chart showing views over selected period]       │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────┐  ┌────────────────────────┐│
│  │ Top Routes                  │  │ Top API Endpoints      ││
│  │                              │  │                        ││
│  │ 1. /dashboard   (3,245) ──▶ │  │ 1. user.list   45ms   ││
│  │ 2. /projects    (2,891)     │  │ 2. project.get 32ms   ││
│  │ 3. /users       (1,567)     │  │ 3. task.list   78ms   ││
│  │ 4. /settings      (892)     │  │ 4. user.update 51ms   ││
│  │ 5. /tasks         (654)     │  │ 5. ssh.execute 142ms  ││
│  │                              │  │                        ││
│  │ [View All Routes]           │  │ [View All Endpoints]  ││
│  └─────────────────────────────┘  └────────────────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Click Heatmap View

```
┌─────────────────────────────────────────────────────────────┐
│  Click Heatmap: /dashboard                 [Last 7 days ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Route: [/dashboard ▼]                 Device: [All ▼]      │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  [Visual representation of the page with heat overlay]│  │
│  │                                                        │  │
│  │  🔴🔴🔴🔴        High click density                     │  │
│  │    🟡🟡          Medium click density                  │  │
│  │      🔵         Low click density                      │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  Top Clicked Elements:                                       │
│  1. button#create-project         1,234 clicks              │
│  2. a.nav-dashboard                 892 clicks              │
│  3. button#filter                   654 clicks              │
│  4. input#search                    432 clicks              │
│                                                               │
│  [Export Data]  [Share Report]                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
**Deliverables:**
- Database schema and migrations
- Redis stream setup
- Basic event tracking functions
- Middleware for page view tracking

**Files:**
- `lib/db/schema/analytics.ts`
- `lib/analytics/tracker.ts`
- `middleware.ts` (tracking logic)

### Phase 2: Data Collection (Weeks 3-4)
**Deliverables:**
- Client-side click tracking
- API call tracking (tRPC middleware)
- BullMQ worker for event processing
- Session management

**Files:**
- `lib/analytics/click-tracker.ts`
- `server/api/trpc.ts` (middleware)
- `server/queue/workers/analytics-processor.ts`
- `lib/analytics/session.ts`

### Phase 3: Temporal Workflows & Analytics API (Weeks 5-6)
**Deliverables:**
- Temporal workflows for aggregation (1min, 1hour, 1day rollups)
- Temporal activities for data processing
- Workflow schedules (cron-based)
- Data retention workflow
- tRPC analytics router
- Query optimization
- Live stats (Redis-backed)

**Files:**
- `server/temporal/workflows/analytics-aggregation.ts`
- `server/temporal/workflows/analytics-retention.ts`
- `server/temporal/activities/analytics.ts`
- `server/temporal/schedules.ts`
- `server/api/routers/analytics.ts`
- `lib/analytics/queries.ts`

### Phase 4: Dashboard UI (Weeks 7-8)
**Deliverables:**
- Analytics dashboard page
- Real-time overview component
- Hot routes table
- Page view time series chart

**Files:**
- `app/admin/analytics/page.tsx`
- `components/analytics/overview.tsx`
- `components/analytics/hot-routes.tsx`
- `components/analytics/page-views-chart.tsx`

### Phase 5: Heatmap Visualization (Weeks 9-10)
**Deliverables:**
- Click heatmap component
- D3.js visualization
- Element click statistics
- Device filtering

**Files:**
- `components/analytics/click-heatmap.tsx`
- `lib/analytics/heatmap-utils.ts`

### Phase 6: API Performance Monitoring (Week 11)
**Deliverables:**
- API usage table
- Response time charts
- Error rate monitoring
- Performance alerts

**Files:**
- `components/analytics/api-performance.tsx`
- `lib/analytics/performance-alerts.ts`

### Phase 7: Admin Controls & Optimization (Week 12)
**Deliverables:**
- Configuration UI
- Data retention policies
- Performance optimization
- Documentation

**Files:**
- `components/analytics/settings.tsx`
- `lib/analytics/retention.ts`
- `docs/analytics.md`

### Phase 8: Testing & Launch (Weeks 13-14)
**Deliverables:**
- Unit tests
- Integration tests
- Performance benchmarks
- Production deployment

---

## Performance Considerations

### Overhead Targets

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Page view tracking | < 0.5ms | Middleware execution time |
| Click event capture | < 0.1ms | Event listener overhead |
| API call tracking | < 1ms | tRPC middleware overhead |
| Event ingestion (Redis) | < 1ms | XADD operation time |
| Batch processing | < 100ms per 100 events | Worker processing time |
| Dashboard query | < 200ms | tRPC query response time |
| Live stats update | < 50ms | Redis query time |

### Optimization Strategies

1. **Non-blocking Collection**
   - Fire-and-forget event tracking
   - No await on tracking calls in request path
   - Use Redis streams for buffering

2. **Batch Processing**
   - Process events in batches of 100-1000
   - Bulk database inserts
   - Reduce transaction overhead

3. **Aggregation Layers (Temporal Workflows)**
   - Pre-compute 1min, 1hour, 1day rollups using Temporal cron schedules
   - Query aggregates instead of raw data for dashboards
   - Reduce query complexity and execution time
   - Reliable execution with automatic retries
   - Workflow visibility via Temporal UI for monitoring and debugging

4. **Indexing Strategy**
   - Composite indexes on (timestamp, route)
   - Separate indexes for common filters
   - Partial indexes for recent data

5. **Data Partitioning**
   - Partition page_views by day
   - Automatic partition creation
   - Drop old partitions for retention

6. **Caching**
   - Cache hot routes in Redis (5-minute TTL)
   - Cache live stats (10-second TTL)
   - Reduce database load

7. **Client-Side Optimization**
   - Debounce click tracking (100ms)
   - Use sendBeacon API for reliability
   - Minimize payload size

---

## Privacy & Compliance

### Privacy-First Design

1. **No PII by Default**
   - Session IDs are anonymized hashes
   - No IP address storage
   - No email/name in tracking events
   - User ID is internal database ID only

2. **Opt-Out Support**
   - Respect Do-Not-Track headers
   - Cookie consent integration
   - Per-user opt-out settings

3. **Data Retention**
   - Configurable retention period (default: 90 days)
   - Automatic data deletion
   - Manual purge capability

4. **Anonymization**
   - Session IDs rotated daily
   - User agents parsed and stored as categories
   - No cross-session tracking after retention period

### GDPR Compliance

- **Right to Access**: Export user's tracking data
- **Right to Erasure**: Delete all data for a user ID
- **Right to Restriction**: Disable tracking for specific users
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Use only for analytics, not profiling

### Configuration

```typescript
// lib/analytics/config.ts
export const analyticsConfig = {
  enabled: process.env.ANALYTICS_ENABLED === 'true',
  enabledEnvironments: ['production', 'staging'],
  respectDoNotTrack: true,
  sessionRotationHours: 24,
  retentionDays: 90,
  excludeRoutes: ['/admin', '/api/auth/*'],
  anonymizeIPs: true,
  cookieConsent: true
};
```

---

## Testing Strategy

### Unit Tests

1. **Event Tracking** (`lib/analytics/tracker.test.ts`)
   - Test Redis stream writing
   - Verify event payload format
   - Test error handling

2. **Session Management** (`lib/analytics/session.test.ts`)
   - Test session ID generation
   - Test session rotation
   - Test anonymization

3. **Click Tracking** (`lib/analytics/click-tracker.test.ts`)
   - Test element selector generation
   - Test position calculation
   - Test event batching

### Integration Tests

1. **End-to-End Flow**
   - Trigger page view → verify in database
   - Click element → verify heatmap data
   - Call API → verify performance data

2. **Worker Processing**
   - Write to Redis stream → verify worker consumes
   - Test batch processing
   - Verify aggregation jobs

3. **Dashboard Queries**
   - Test hot routes query
   - Test time-series queries
   - Test heatmap data retrieval

### Performance Tests

1. **Load Testing**
   - 1,000 events/second ingestion
   - 100 concurrent dashboard users
   - Response time under load

2. **Benchmark Tracking Overhead**
   - Measure middleware latency
   - Measure client-side overhead
   - Measure database write performance

---

## Future Enhancements

### Phase 2 Features

1. **User Journey Visualization**
   - Sankey diagrams showing navigation flows
   - Conversion funnel analysis
   - Drop-off identification

2. **Real-Time Alerts**
   - Anomaly detection (traffic spikes/drops)
   - Performance degradation alerts
   - Error rate threshold alerts

3. **A/B Testing Integration**
   - Track variant performance
   - Statistical significance calculation
   - Automatic winner declaration

4. **Custom Events**
   - Developer API for custom event tracking
   - Business metric tracking
   - Goal completion tracking

5. **Export & Reporting**
   - Scheduled reports (email/Slack)
   - CSV/PDF export
   - Data warehouse integration (BigQuery, Snowflake)

6. **Advanced Heatmaps**
   - Scroll depth tracking
   - Rage click detection
   - Form field analytics

7. **Mobile App Support**
   - React Native SDK
   - Screen view tracking
   - Touch heatmaps

---

## Success Metrics

### Technical Metrics

- [ ] Tracking overhead < 1ms per event
- [ ] 99.9% event capture rate
- [ ] Dashboard load time < 2 seconds
- [ ] Support 10,000+ events/minute
- [ ] Database storage < 1GB per 1M events

### Business Metrics

- [ ] Admin adoption > 80% (weekly active admins)
- [ ] Insights actioned: > 5 per month
- [ ] Performance improvements: > 10% reduction in slow endpoints
- [ ] User experience improvements: > 15% reduction in bounce rate

---

## Conclusion

The page view tracking system will provide essential visibility into application usage, user behavior, and performance bottlenecks. By implementing a lightweight, privacy-focused solution with real-time analytics, administrators can make data-driven decisions to improve user experience and optimize system performance.

**Recommended Next Steps**:
1. Review and approve this proposal
2. Allocate development resources (1-2 engineers for 14 weeks)
3. Set up testing infrastructure
4. Begin Phase 1 implementation
5. Schedule weekly progress reviews

**Total Estimated Effort**: 14 weeks (full-time equivalent)

---

*Document Version: 1.0*
*Last Updated: 2025-11-09*
*Status: Proposal Phase*
