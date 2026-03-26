import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { createJob, getJob } from "../../../workers/jobStore.mjs";

export const maxDuration = 300; // 5 minutes (300 seconds)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      reviewData,
      modelName = "gemini-2.0-flash-lite",
      visualTheme = "",
    } = body;

    if (!reviewData || !Array.isArray(reviewData.items)) {
      return NextResponse.json({ error: "Invalid review data" }, { status: 400 });
    }

    const { userVideoId } = reviewData;
    const jobId = userVideoId;
    
    let userIdStr = request.headers.get('x-user-id');

    const job = createJob(jobId, userIdStr || 'anonymous', {
      type: 'preview_batch',
      reviewData,
      modelName,
      visualTheme,
    });

    console.log(`[api/review-batch] Enqueued background batch job ${jobId}`);

    return NextResponse.json({
      message: 'Batch generation started in background',
      jobId: job.jobId,
      status: job.status,
    }, { status: 202 });

  } catch (error: any) {
    console.error("[api/review-batch] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
