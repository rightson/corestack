import { NextRequest, NextResponse } from 'next/server';
import { QueueManager } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queueName, jobName, data, options } = body;

    if (!queueName || !jobName) {
      return NextResponse.json(
        { error: 'queueName and jobName are required' },
        { status: 400 }
      );
    }

    const job = await QueueManager.addJob(queueName, jobName, data || {}, options);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      jobName: job.name,
      queueName,
    });
  } catch (error: any) {
    console.error('Error adding job to queue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
