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

// ─── Load Environment Variables First (Hoisting Fix) ─────────────────────────
import './loadEnv.mjs'; 

// ─── Static import (resolved by tsx/esm at startup) ──────────────────────────
import { callVideoGenerator } from '../app/videoGenerator.ts';

import { fileURLToPath } from 'url';
import path from 'path';
import { writeJob, getJobsByStatus, purgeOldJobs } from './jobStore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MAX_CONCURRENT    = parseInt(process.env.MAX_CONCURRENT_RENDERS || '1', 10);
const POLL_INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_MS || '2000', 10);
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let activeRenders = 0;
let lastPurgeAt   = Date.now();

// ─── Main render function ─────────────────────────────────────────────────────
async function processJob(job) {
  const { jobId, params } = job;
  activeRenders++;

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
    } = params;

    const videoUrl = await callVideoGenerator(
      script,
      preferences,
      contentClass,
      user_video_id,
      flow,
      rebuild,
      (progress, statusMessage) => {
        writeJob(jobId, { progress, statusMessage });
      },
      modelName,
      vidGen
    );

    console.log(`[worker] Job ${jobId} completed -> ${videoUrl}`);
    writeJob(jobId, {
      status: 'done',
      progress: 100,
      statusMessage: 'Video generated successfully!',
      videoUrl,
      finishedAt: Date.now(),
    });

  } catch (err) {
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

// ─── Poll loop ────────────────────────────────────────────────────────────────
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

// ─── Graceful shutdown ────────────────────────────────────────────────────────
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

// ─── Start ────────────────────────────────────────────────────────────────────
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
