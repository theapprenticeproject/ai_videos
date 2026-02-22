/**
 * GET  /api/queue?jobId=xxx   → returns current JobRecord (for polling)
 * POST /api/queue             → enqueue a new render job (same as POST /api/render)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createJob, getJob } from '../../../workers/jobStore.mjs';

// ─── GET: Poll job status ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId query parameter' }, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: `Job '${jobId}' not found` }, { status: 404 });
  }

  console.log(`[api/queue] Poll for ${jobId} | PID: ${process.pid}`);
  return NextResponse.json(job);
}

// ─── POST: Enqueue a new render job ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      flow = 'eleven',
      rebuild = false,
      modelName = 'gemini-2.0-flash-lite',
      vidGen = 'veo',
    } = body;

    if (
      typeof script !== 'string' ||
      typeof preferences !== 'object' ||
      typeof contentClass !== 'string' ||
      typeof user_video_id !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    // Force slideshow style (matches existing behaviour)
    preferences.style = 'slideshow';

    const jobId = user_video_id;

    // Check if there's already an active job for this ID
    const existing = getJob(jobId);
    if (existing && (existing.status === 'pending' || existing.status === 'running')) {
      return NextResponse.json(
        { 
          message: 'Job already in progress',
          jobId,
          status: existing.status,
        },
        { status: 409 }
      );
    }

    const job = createJob(jobId, {
      script,
      preferences,
      contentClass,
      user_video_id,
      flow,
      rebuild,
      modelName,
      vidGen,
    });

    console.log(`[api/queue] Enqueued job ${jobId}`);

    return NextResponse.json(
      {
        message: 'Job enqueued successfully',
        jobId: job.jobId,
        status: job.status,
        pollUrl: `/api/queue?jobId=${encodeURIComponent(jobId)}`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[api/queue] Enqueue error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
