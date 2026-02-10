import fetch from 'node-fetch';

/**
 * This script tests the video rebuild functionality.
 * It sends a POST request to the /api/render endpoint with the "rebuild" flag set to true.
 * 
 * Requirement: The Next.js server must be running (e.g., via `npm run dev`) at http://localhost:3000
 */

async function testRebuild() {
  const url = 'http://localhost:3000/api/render';
  
  // These parameters are still required by the API validation, 
  // but they will be ignored by the backend because "rebuild": true 
  // tells it to load everything from debug_render_data.json.
  const payload = {
    script: "Dummy script for validation",
    preferences: { subtitles: true, style: "slideshow", avatar: "XfNU2rGpBa01ckF309OY" },
    contentClass: "low",
    user_video_id: "test_rebuild_user",
    rebuild: true
  };

  console.log("🚀 Sending rebuild request to:", url);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    console.log("✅ Request successful! Reading stream...");

    const reader = response.body;
    reader.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type === 'progress') {
            console.log(`[PROGRESS] ${data.progress}% - ${data.status}`);
          } else if (data.type === 'result') {
            console.log(`\n🎉 SUCCESS! Video URL: ${data.videoUrl}`);
          } else if (data.type === 'error') {
            console.error(`\n❌ BACKEND ERROR: ${data.message}`);
          }
        } catch (e) {
          // Fragmented JSON, skip
        }
      }
    });

    reader.on('end', () => {
      console.log("\n🏁 Stream finished.");
    });

  } catch (error) {
    console.error("\n💥 Error during test:", error.message);
    console.log("\n💡 Make sure your dev server is running at http://localhost:3000");
  }
}

testRebuild();
