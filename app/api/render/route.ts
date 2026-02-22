/**
 * POST /api/render
 *
 * Production mode (default): Enqueues the job in the shared job store and
 * returns { jobId } immediately (HTTP 202). The video worker process picks
 * it up asynchronously. Poll GET /api/queue?jobId=xxx for status.
 *
 * Dev/stream mode (?stream=true): Falls back to the old inline-streaming
 * behaviour for local development without PM2.
 */
import { NextRequest, NextResponse } from "next/server";
import { createJob, getJob } from "../../../workers/jobStore.mjs";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const useStream = searchParams.get("stream") === "true";
    const body = await request.json();

    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      modelName = "gemini-2.0-flash-lite",
      rebuild = false,
      flow = "eleven",
      vidGen = "veo",
    } = body;

    // Validate required fields
    if (
      typeof script !== "string" ||
      typeof preferences !== "object" ||
      typeof contentClass !== "string" ||
      typeof user_video_id !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid parameters" },
        { status: 400 }
      );
    }

    preferences.style = "slideshow";

    // ── STREAM MODE (local dev fallback) ───────────────────────────────────
    if (useStream) {
      console.log("[api/render] Stream mode — running inline (dev only)");
      const { callVideoGenerator } = await import("../../videoGenerator");
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: any) =>
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
          try {
            const videoUrl = await callVideoGenerator(
              script,
              preferences,
              contentClass,
              user_video_id,
              flow,
              rebuild,
              (progress: number, status: string) => send({ type: "progress", progress, status }),
              modelName,
              vidGen
            );
            send({ type: "result", videoUrl });
          } catch (err: any) {
            send({ type: "error", message: err.message || "Internal Server Error" });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // ── QUEUE MODE (production default) ────────────────────────────────────
    const jobId = user_video_id;

    // Prevent duplicate submissions
    const existing = getJob(jobId);
    if (existing && (existing.status === "pending" || existing.status === "running")) {
      return NextResponse.json(
        { message: "Job already in progress", jobId, status: existing.status },
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

    console.log(`[api/render] Enqueued job ${jobId} | PID: ${process.pid}`);

    return NextResponse.json(
      {
        message: "Job enqueued. Poll for status.",
        jobId: job.jobId,
        status: job.status,
        pollUrl: `/api/queue?jobId=${encodeURIComponent(jobId)}`,
      },
      { status: 202 }
    );

  } catch (error: any) {
    console.error("[api/render] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

