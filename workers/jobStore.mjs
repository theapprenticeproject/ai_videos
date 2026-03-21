/**
 * jobStore.mjs
 * 
 * Shared in-memory + file-backed job store.
 * Used by both the Next.js API (to create jobs) and the video worker (to update them).
 * 
 * Storage:  temp/jobs.json
 * Atomicity: write to temp/jobs.tmp → rename to temp/jobs.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JOBS_DIR = path.join(ROOT, 'temp');
const JOBS_FILE = path.join(JOBS_DIR, 'jobs.json');
const JOBS_TMP = path.join(JOBS_DIR, 'jobs.tmp');

// Ensure temp dir exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function safeWriteJsonSync(data) {
  const json = JSON.stringify(data, null, 2);
  let attempts = 0;
  while (attempts < 10) {
    try {
      fs.writeFileSync(JOBS_TMP, json, 'utf8');
      fs.renameSync(JOBS_TMP, JOBS_FILE);
      return;
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
        attempts++;
        const start = Date.now();
        // Fallback to a tight loop sleep for 50ms to allow file locks to clear on Windows
        while (Date.now() - start < 50) {
          // block
        }
      } else {
        throw err;
      }
    }
  }
  // Ultimate fallback, write directly which might break atomicity but bypasses rename EPERM on Windows
  try {
    fs.writeFileSync(JOBS_FILE, json, 'utf8');
  } catch (finalErr) {
    console.warn("Failed to write JOBS_FILE synchronously even with fallback:", finalErr.message);
  }
}

/**
 * Read all jobs from disk.
 * @returns {Record<string, JobRecord>}
 */
export function readAllJobs() {
  try {
    if (!fs.existsSync(JOBS_FILE)) return {};
    const raw = fs.readFileSync(JOBS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Write a single job record, merging with existing data atomically.
 * @param {string} jobId
 * @param {Partial<JobRecord>} update
 */
export function writeJob(jobId, update) {
  const all = readAllJobs();
  all[jobId] = { ...(all[jobId] || {}), ...update, jobId };
  safeWriteJsonSync(all);
}

/**
 * Get a single job record by ID.
 * @param {string} jobId
 * @returns {JobRecord | undefined}
 */
export function getJob(jobId) {
  const all = readAllJobs();
  return all[jobId];
}

/**
 * Get all jobs with a given status.
 * @param {'pending'|'running'|'done'|'failed'} status
 * @returns {JobRecord[]}
 */
export function getJobsByStatus(status) {
  const all = readAllJobs();
  return Object.values(all).filter(j => j.status === status);
}

/**
 * Get all jobs for a specific user ID.
 * @param {string} userId
 * @returns {JobRecord[]}
 */
export function getJobsByUser(userId) {
  if (!userId) return [];
  const all = readAllJobs();
  return Object.values(all).filter(j => j.userId === userId);
}

/**
 * Create a brand new pending job.
 * @param {string} jobId
 * @param {string} userId
 * @param {object} params  - callVideoGenerator arguments
 * @returns {JobRecord}
 */
export function createJob(jobId, userId, params) {
  const record = {
    jobId,
    userId: userId || 'anonymous',
    status: 'pending',
    progress: 0,
    statusMessage: 'Queued...',
    videoUrl: null,
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    params,
  };
  writeJob(jobId, record);
  return record;
}

/**
 * Purge jobs older than maxAgeMs (default 24h).
 * Call this periodically to prevent unbounded file growth.
 * @param {number} maxAgeMs
 */
export function purgeOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) {
  const all = readAllJobs();
  const now = Date.now();
  let changed = false;
  for (const [id, job] of Object.entries(all)) {
    if (now - job.createdAt > maxAgeMs) {
      delete all[id];
      changed = true;
    }
  }
  if (changed) {
    safeWriteJsonSync(all);
  }
}

/**
 * Pause an active or pending job.
 * @param {string} jobId
 */
export function pauseJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  if (job.status === 'running' || job.status === 'pending') {
    writeJob(jobId, { status: 'paused', statusMessage: 'Paused by user.' });
  }
}

/**
 * Resume a paused job.
 * @param {string} jobId
 */
export function resumeJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  if (job.status === 'paused') {
    writeJob(jobId, { status: 'running', statusMessage: 'Resuming...' });
  }
}

/**
 * Abort an active or pending job.
 * @param {string} jobId
 */
export function abortJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  if (job.status === 'running' || job.status === 'paused' || job.status === 'pending') {
    writeJob(jobId, { status: 'aborted', statusMessage: 'Stopped by user.', finishedAt: Date.now() });
  }
}

/**
 * Delete a job permanently from the job store.
 * @param {string} jobId
 */
export function deleteJob(jobId) {
  const all = readAllJobs();
  if (!all[jobId]) return;
  delete all[jobId];
  safeWriteJsonSync(all);
}
