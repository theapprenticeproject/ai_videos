/**
 * videoWorker.mjs
 *
 * Standalone video rendering worker process.
 * Launch with:  node --import tsx/esm workers/videoWorker.mjs
 * Or via PM2:   see ecosystem.config.cjs
 *
 * WHY STATIC IMPORT:
 * Dynamic import() on Windows passes the raw 'c:\...' path string to Node's
 * ESM loader, which rejects it with "protocol 'c:'". Static imports are
 * resolved by the tsx transformer at startup, before Node sees the path.
 *
 * Environment variables:
 *   MAX_CONCURRENT_RENDERS  (default: 1)
 *   POLL_INTERVAL_MS        (default: 2000)
 */

// — Load Environment Variables First (Hoisting Fix) —————————————————————
import './loadEnv.mjs'; 

// — Static import (resolved by tsx/esm at startup) ——————————————————————
import { callVideoGenerator } from '../app/videoGenerator.ts';
import { uploadFinalVideoToGCS } from '../app/mediaApis/vertex.ts';
import { prepareVideoReviewData, refreshReviewPromptsForChunks } from '../app/videoReview.ts';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { writeJob, getJob, getJobsByStatus, purgeOldJobs } from './jobStore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MAX_CONCURRENT    = parseInt(process.env.MAX_CONCURRENT_RENDERS || '1', 10);
const POLL_INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let activeRenders = 0;
let lastPurgeAt   = Date.now();

// — Main render function ————————————————————————————————————————————————
async function processJob(job) {
  const { jobId, params } = job;
  activeRenders++;
  const isStoppedOrDeleted = () => {
    const current = getJob(jobId);
    return !current || current.status === 'aborted';
  };

  console.log(`[worker] Starting job ${jobId} | PID: ${process.pid} | active: ${activeRenders}/${MAX_CONCURRENT}`);

  writeJob(jobId, {
    status: 'running',
    startedAt: Date.now(),
    progress: 0,
    statusMessage: 'Worker picked up job...',
  });

  try {
    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      flow      = 'eleven',
      rebuild   = false,
      modelName = 'gemini-2.0-flash-lite',
      vidGen    = 'veo',
      reviewData = null,
      visualTheme = '',
      reference = '',
    } = params;
    console.log(`[worker] Job params | jobId=${jobId} | animation=${Boolean(preferences?.animation)} | reviewChunks=${Boolean(preferences?.reviewChunks)} | reviewPrompts=${Boolean(preferences?.reviewPrompts)} | vidGen=${vidGen}`);

    // Handle review plan generation as a background job
    if (params.type === 'review_plan') {
      console.log(`[worker] Processing review_plan for job ${jobId}`);
      writeJob(jobId, { statusMessage: 'Generating chunks & image prompts...' });
      
      let reviewDataLoc = await prepareVideoReviewData({
        script,
        preferences,
        contentClass,
        user_video_id,
        modelName,
        flow,
        chunkingMaxWords: params.chunkingMaxWords || 15,
        manualChunks: Array.isArray(params.manualChunks) ? params.manualChunks : undefined,
        visualTheme,
      });

      if (isStoppedOrDeleted()) {
        console.log(`[worker] Job ${jobId} stopped/deleted before review plan completion.`);
        return;
      }

      const shouldGenerateVisualReviewImages = Boolean(preferences?.reviewPrompts) && !Boolean(preferences?.reviewChunks);
      if (shouldGenerateVisualReviewImages) {
        const reviewItems = Array.isArray(reviewDataLoc?.items) ? reviewDataLoc.items : [];
        if (reviewItems.length === 0) {
          throw new Error('Review plan generated without items; cannot prepare visual previews.');
        }
        const isPromptsOnly = preferences?.visualReviewMode === 'prompts_only';
        writeJob(jobId, {
          statusMessage: isPromptsOnly ? 'Generating visual prompts...' : 'Generating image previews for visual review...',
          progress: 70,
        });
        const changedChunkIds = reviewItems.map((item) => item.chunkId);
        const updatedItems = await refreshReviewPromptsForChunks({
          script: reviewDataLoc.script,
          items: reviewItems,
          changedChunkIds,
          modelName,
          visualTheme,
          promptsOnly: preferences?.visualReviewMode === 'prompts_only',
        });

        const safeUpdatedItems = Array.isArray(updatedItems) ? updatedItems : [];
        const updatedMap = new Map(safeUpdatedItems.map((item) => [item.chunkId, item]));
        reviewDataLoc = {
          ...reviewDataLoc,
          items: reviewItems.map((item) => updatedMap.get(item.chunkId) || item),
        };
      }

      if (isStoppedOrDeleted()) {
        console.log(`[worker] Job ${jobId} stopped/deleted before review image completion.`);
        return;
      }

      writeJob(jobId, {
        status: 'done',
        progress: 100,
        statusMessage: 'Review ready. Click to open.',
        reviewDataReady: reviewDataLoc,
        finishedAt: Date.now(),
      });
      return;
    }

    const { videoUrl, chunks } = await callVideoGenerator(
      script,
      preferences,
      contentClass,
      user_video_id,
      flow,
      rebuild,
      async (progress, statusMessage) => {
        // Check for pause or abort signals
        while (true) {
          const currentJob = getJob(jobId);
          if (!currentJob || currentJob.status === 'aborted') {
            throw new Error('JOB_ABORTED');
          }
          if (currentJob.status === 'paused') {
            // Wait while paused
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          break;
        }
        writeJob(jobId, { progress, statusMessage });
      },
      modelName,
      vidGen,
      reviewData,
      visualTheme,
      reference
    );

    if (isStoppedOrDeleted()) {
      console.log(`[worker] Job ${jobId} stopped/deleted before upload.`);
      return;
    }

    const localFinalPath = path.join(ROOT, 'public', videoUrl);
    console.log(`[worker] Uploading final video to GCS...`);
    const gcsUrl = await uploadFinalVideoToGCS(localFinalPath, videoUrl);
    
    // Update gallery.json track
    const galleryDbPath = path.join(ROOT, 'public', 'final_videos.json');
    let galleryDb = [];
    if (fs.existsSync(galleryDbPath)) {
      try {
        galleryDb = JSON.parse(fs.readFileSync(galleryDbPath, 'utf8'));
      } catch (e) {
        console.error("Failed to parse galleryDB:", e);
      }
    }
    galleryDb.push({
      filename: videoUrl,
      gcsUrl,
      prompt: params.prompt || "",
      chunks: chunks,
      createdAt: Date.now()
    });
    fs.writeFileSync(galleryDbPath, JSON.stringify(galleryDb, null, 2));

    // Delete local final video
    if (fs.existsSync(localFinalPath)) {
      fs.unlinkSync(localFinalPath);
      console.log(`[worker] Deleted local final video: ${localFinalPath}`);
    }

    if (isStoppedOrDeleted()) {
      console.log(`[worker] Job ${jobId} stopped/deleted before final status write.`);
      return;
    }

    console.log(`[worker] Job ${jobId} completed -> ${gcsUrl}`);
    writeJob(jobId, {
      status: 'done',
      progress: 100,
      statusMessage: 'Video generated successfully!',
      videoUrl: gcsUrl,
      chunks, // Save chunks
      prompt: params.prompt, // Save prompt from params
      finishedAt: Date.now(),
    });

  } catch (err) {
    const currentJob = getJob(jobId);
    if (currentJob?.status === 'aborted' || err.message === 'JOB_ABORTED') {
      console.log(`[worker] Job ${jobId} was aborted by user.`);
      return;
    }
    const errorMsg = err?.message || String(err);
    console.error(`[worker] Job ${jobId} FAILED:`, errorMsg);
    writeJob(jobId, {
      status: 'failed',
      statusMessage: 'Rendering failed.',
      error: errorMsg,
      finishedAt: Date.now(),
    });
  } finally {
    activeRenders--;
    console.log(`[worker] Job ${jobId} done | active: ${activeRenders}/${MAX_CONCURRENT}`);
  }
}

// — Poll loop ———————————————————————————————————————————————————————————
async function tick() {
  if (Date.now() - lastPurgeAt > PURGE_INTERVAL_MS) {
    purgeOldJobs();
    lastPurgeAt = Date.now();
  }

  if (activeRenders >= MAX_CONCURRENT) return;

  const pending = getJobsByStatus('pending');
  if (pending.length === 0) return;

  // FIFO order
  pending.sort((a, b) => a.createdAt - b.createdAt);

  const slots     = MAX_CONCURRENT - activeRenders;
  const toProcess = pending.slice(0, slots);

  for (const job of toProcess) {
    // Claim immediately to prevent double-pickup on next tick
    writeJob(job.jobId, { status: 'running' });
    processJob(job).catch(err =>
      console.error(`[worker] Unhandled error in processJob(${job.jobId}):`, err)
    );
  }
}

// — Graceful shutdown ———————————————————————————————————————————————————
let shuttingDown = false;

process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received. Draining active renders...');
  shuttingDown = true;
});

process.on('SIGINT', () => {
  console.log('[worker] SIGINT received. Stopping worker.');
  shuttingDown = true;
  if (activeRenders === 0) process.exit(0);
});

// — Start ———————————————————————————————————————————————————————————————
console.log(`[worker] Video Worker starting — max concurrency: ${MAX_CONCURRENT}`);
console.log(`[worker] Polling every ${POLL_INTERVAL_MS}ms`);
console.log(`[worker] callVideoGenerator ready: ${typeof callVideoGenerator === 'function'}`);

const interval = setInterval(async () => {
  if (shuttingDown) {
    if (activeRenders === 0) {
      clearInterval(interval);
      console.log('[worker] All renders complete. Exiting.');
      process.exit(0);
    }
    return;
  }
  try {
    await tick();
  } catch (err) {
    console.error('[worker] Error in tick:', err);
  }
}, POLL_INTERVAL_MS);
