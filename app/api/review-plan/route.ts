import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { prepareVideoReviewData } from "../../videoReview";

export const maxDuration = 300; // 5 minutes (300 seconds)

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const useSync = searchParams.get("sync") === "true";
    const body = await request.json();
    const {
      script,
      preferences,
      contentClass,
      user_video_id,
      modelName = "gemini-2.0-flash-lite",
      flow = "eleven",
      chunkingMaxWords = 15,
      manualChunks,
      visualTheme = "",
      formData = null,
    } = body;

    if (
      typeof script !== "string" ||
      typeof preferences !== "object" ||
      typeof contentClass !== "string" ||
      typeof user_video_id !== "string"
    ) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    if (useSync) {
      const { prepareVideoReviewData } = await import("../../videoReview");
      const reviewData = await prepareVideoReviewData({
        script,
        preferences,
        contentClass,
        user_video_id,
        modelName,
        flow,
        chunkingMaxWords,
        manualChunks: Array.isArray(manualChunks) ? manualChunks : undefined,
        visualTheme,
      });
      return NextResponse.json(reviewData);
    }

    const { createJob, getJob } = await import("../../../workers/jobStore.mjs");
    let userIdStr = request.headers.get('x-user-id'); // will pass from client if possible, else anonymous logic
    
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

    const job = createJob(jobId, userIdStr || 'anonymous', {
      type: 'review_plan',
      script,
      preferences,
      contentClass,
      user_video_id,
      modelName,
      flow,
      chunkingMaxWords,
      manualChunks,
      visualTheme,
      formData,
    });

    console.log(`[api/review-plan] Enqueued job ${jobId} | PID: ${process.pid}`);

    return NextResponse.json(
      {
        message: 'Review job enqueued successfully',
        jobId: job.jobId,
        status: job.status,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("[api/review-plan] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
