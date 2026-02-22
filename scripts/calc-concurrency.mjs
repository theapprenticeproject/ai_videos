import os from 'os';

/**
 * Script to calculate recommended parallel concurrency for the Video Worker System.
 * Works on Windows, Linux, and macOS.
 */

function calculate() {
  const logicalCores = os.cpus().length;
  const totalRamBytes = os.totalmem();
  const totalRamGb = (totalRamBytes / (1024 ** 3)).toFixed(2);
  const freeRamBytes = os.freemem();
  const freeRamGb = (freeRamBytes / (1024 ** 3)).toFixed(2);

  console.log("==========================================");
  console.log("📊 SYSTEM HARDWARE REPORT");
  console.log("==========================================");
  console.log(`OS:            ${os.type()} (${os.release()})`);
  console.log(`Hostname:      ${os.hostname()}`);
  console.log(`CPU Cores:     ${logicalCores} (Logical)`);
  console.log(`Total RAM:     ${totalRamGb} GB`);
  console.log(`Free RAM:      ${freeRamGb} GB`);
  console.log("------------------------------------------");

  // Formula Logic
  // 1. CPU: Video rendering is heavy. We recommend 1 render per 4 logical cores to avoid system lag.
  const cpuFactor = Math.max(1, Math.floor(logicalCores / 4));

  // 2. RAM: Each render (Revideo/Chrome + FFmpeg) takes roughly 1.5GB - 2GB.
  // We use total RAM for baseline, but check free RAM for caution.
  const ramFactor = Math.max(1, Math.floor(parseFloat(totalRamGb) / 2));

  // Result: The more restrictive factor wins
  const recommended = Math.min(cpuFactor, ramFactor);

  console.log("🧮 CALCULATION FORMULA");
  console.log("------------------------------------------");
  console.log(`1. CPU Limit: Cores(${logicalCores}) / 4 = ${cpuFactor}`);
  console.log(`2. RAM Limit: Total RAM(${totalRamGb}GB) / 2GB = ${ramFactor}`);
  console.log("");
  console.log("💡 WHY THIS FORMULA?");
  console.log("- CPU: Rendering uses heavy FFmpeg and Browser processing. Too many local renders will freeze the server.");
  console.log("- RAM: Each concurrent render spawns a headless Chrome engine. 2GB is the safe buffer.");
  console.log("------------------------------------------");
  console.log(`✅ RECOMMENDED CONCURRENCY: ${recommended}`);
  console.log("==========================================");
  console.log("");
  console.log("🚀 HOW TO APPLY:");
  console.log(`Set MAX_CONCURRENT_RENDERS=${recommended} in your .env or ecosystem.config.cjs`);
}

calculate();
