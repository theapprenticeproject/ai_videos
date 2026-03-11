import fetch from 'node-fetch';

async function testRebuild() {
  const HOST = '127.0.0.1:3000';
  const RENDER_URL = `http://${HOST}/api/render`;
  const QUEUE_URL = `http://${HOST}/api/queue`;

  const payload = {
    script: "Rebuild dummy script",
    preferences: { subtitles: true, style: "slideshow", avatar: "XfNU2rGpBa01ckF309OY" },
    contentClass: "low",
    user_video_id: `rebuild_test_${Date.now()}`,
    rebuild: true
  };

  console.log(`🚀 Enqueuing rebuild request to ${RENDER_URL} ...`);

  try {
    const response = await fetch(RENDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("--- ERROR RESPONSE BODY ---");
      console.log(errorText.slice(0, 500)); // Show beginning of response
      console.log("---------------------------");
      throw new Error(`Enqueue failed (${response.status}): ${response.statusText}`);
    }

    const { jobId } = await response.json();
    console.log(`✅ Job enqueued! Job ID: ${jobId}`);
    
    // ... polling logic ...
  } catch (error) {
    console.error("\n💥 Error during test:", error.message);
  }
}

testRebuild();
