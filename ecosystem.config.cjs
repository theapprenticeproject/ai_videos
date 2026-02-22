/**
 * PM2 Ecosystem Configuration
 * 
 * Start:   pm2 start ecosystem.config.cjs
 * Stop:    pm2 stop ecosystem.config.cjs
 * Restart: pm2 restart ecosystem.config.cjs
 * Logs:    pm2 logs
 * Status:  pm2 list
 */

module.exports = {
  apps: [
    // ── Next.js HTTP Server ───────────────────────────────────────────────────
    {
      name: 'nextjs-server',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,           // single instance — no cluster (as requested)
      exec_mode: 'fork',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Restart on crash, but not on clean exit
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      // Log files
      out_file: './logs/nextjs-out.log',
      error_file: './logs/nextjs-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Video Rendering Worker ────────────────────────────────────────────────
    {
      name: 'video-worker',
      script: 'workers/videoWorker.mjs',
      interpreter: 'node',
      // tsx/esm allows direct .ts imports inside the worker
      interpreter_args: '--import tsx/esm',
      instances: 1,
      exec_mode: 'fork',
      cwd: './',
      env: {
        NODE_ENV: 'production',
        // Number of simultaneous Revideo renders (1 = fully sequential)
        MAX_CONCURRENT_RENDERS: '3',
        // How often to poll the job store (milliseconds)
        POLL_INTERVAL_MS: '2000',
      },
      // Restart on failure
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      // Allow graceful shutdown to drain active renders
      kill_timeout: 60000,   // wait up to 60s for the worker to finish a render
      // Log files
      out_file: './logs/worker-out.log',
      error_file: './logs/worker-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
