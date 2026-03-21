/**
 * GET  /api/queue?jobId=xxx   → returns current JobRecord (for polling)
 * POST /api/queue             → enqueue a new render job (same as POST /api/render)
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createJob, getJob, getJobsByUser, pauseJob, resumeJob, abortJob, deleteJob } from '../../../workers/jobStore.mjs';

function safeDeleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`[api/queue] Failed to delete file: ${filePath}`, error);
  }
}

function collectCleanupPaths(job: any): string[] {
  const paths = new Set<string>();
  const root = process.cwd();
  const jobId = job?.jobId;
  const userVideoId = job?.params?.user_video_id || jobId;

  if (userVideoId) {
    // Backward compatibility: old jobs used root audio, new jobs use public audio.
    paths.add(path.join(root, `audio_${userVideoId}.wav`));
    paths.add(path.join(root, 'public', `audio_${userVideoId}.wav`));
    paths.add(path.join(root, 'public', `video-${userVideoId}.mp4`));
  }

  const addMediaPath = (rawPath: string | undefined | null) => {
    if (!rawPath || typeof rawPath !== 'string') return;
    const normalized = rawPath.replace(/^\/+/, '').replace(/^public[\\/]/, '');
    paths.add(path.join(root, 'public', normalized));
  };

  if (Array.isArray(job?.chunks)) {
    for (const chunk of job.chunks) {
      addMediaPath(chunk?.templateJson?.path);
    }
  }

  const reviewItems = job?.params?.reviewData?.items;
  if (Array.isArray(reviewItems)) {
    for (const item of reviewItems) {
      addMediaPath(item?.mediaPath);
      addMediaPath(item?.previewUrl);
    }
  }

  // Best-effort sweep for job-scoped Veo assets.
  try {
    const publicDir = path.join(root, 'public');
    if (fs.existsSync(publicDir) && userVideoId) {
      const prefix = `veo_video_${userVideoId}_`;
      for (const name of fs.readdirSync(publicDir)) {
        if (name.startsWith(prefix) && name.endsWith('.mp4')) {
          paths.add(path.join(publicDir, name));
        }
      }
    }
  } catch (error) {
    console.warn('[api/queue] Failed to scan public dir for Veo files', error);
  }

  return Array.from(paths);
}

function cleanupJobArtifacts(job: any) {
  const cleanupPaths = collectCleanupPaths(job);
  for (const filePath of cleanupPaths) {
    safeDeleteFile(filePath);
  }
  return cleanupPaths;
}

// ——— GET: Poll job status ——————————————————————————————————————————————————
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const userId = searchParams.get('userId');

  if (userId) {
    // New logic: Get all active/recent jobs for a user
    const userJobs = getJobsByUser(userId);
    // Sort by newest first
    userJobs.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ jobs: userJobs });
  }

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId or userId query parameter' }, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: `Job '${jobId}' not found` }, { status: 404 });
  }

  // Optional: Disable the constant polling log to keep console clean, or leave it
  // console.log(`[api/queue] Poll for ${jobId} | PID: ${process.pid}`);
  return NextResponse.json(job);
}

// ——— POST: Enqueue a new render job ————————————————————————————————————————
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      userId,
      flow = 'eleven',
      rebuild = false,
      modelName = 'gemini-2.0-flash-lite',
      vidGen = 'veo',
      reviewData = null,
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

    const job = createJob(jobId, userId, {
      script,
      preferences,
      contentClass,
      user_video_id,
      flow,
      rebuild,
      modelName,
      vidGen,
      reviewData,
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

// ——— PATCH: Update job status (Pause/Resume/Abort) ———————————————————————
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, action } = body;

    if (!jobId || !action) {
      return NextResponse.json({ error: 'Missing jobId or action' }, { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: `Job '${jobId}' not found` }, { status: 404 });
    }

    switch (action) {
      case 'pause':
        pauseJob(jobId);
        break;
      case 'resume':
        resumeJob(jobId);
        break;
      case 'abort':
      case 'stop': {
        abortJob(jobId);
        const deletedFiles = cleanupJobArtifacts(job);
        deleteJob(jobId);
        return NextResponse.json({
          message: `Action '${action}' applied successfully`,
          status: 'deleted',
          deletedFilesCount: deletedFiles.length,
        });
      }
      case 'delete': {
        const deletedFiles = cleanupJobArtifacts(job);
        deleteJob(jobId);
        return NextResponse.json({
          message: `Action '${action}' applied successfully`,
          status: 'deleted',
          deletedFilesCount: deletedFiles.length,
        });
      }
      default:
        return NextResponse.json({ error: `Invalid action '${action}'` }, { status: 400 });
    }

    return NextResponse.json({ 
      message: `Action '${action}' applied successfully`,
      status: getJob(jobId)?.status 
    });
  } catch (error: any) {
    console.error('[api/queue] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
