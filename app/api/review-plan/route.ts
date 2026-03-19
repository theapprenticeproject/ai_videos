import { NextRequest, NextResponse } from "next/server";
import { prepareVideoReviewData } from "../../videoReview";

export async function POST(request: NextRequest) {
  try {
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
    } = body;

    if (
      typeof script !== "string" ||
      typeof preferences !== "object" ||
      typeof contentClass !== "string" ||
      typeof user_video_id !== "string"
    ) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    const reviewData = await prepareVideoReviewData({
      script,
      preferences,
      contentClass,
      user_video_id,
      modelName,
      flow,
      chunkingMaxWords,
      manualChunks: Array.isArray(manualChunks) ? manualChunks : undefined,
    });

    return NextResponse.json(reviewData);
  } catch (error: any) {
    console.error("[api/review-plan] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
