import { NextRequest, NextResponse } from "next/server";
import { regenerateReviewImageForChunk } from "../../videoReview";
export const maxDuration = 300; // 5 minutes (300 seconds)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, useGoogle = false } = body;
    console.log(`[api/review-image] Request | prompt="${prompt}" | useGoogle=${Boolean(useGoogle)}`);

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await regenerateReviewImageForChunk({
      prompt,
      useGoogle: Boolean(useGoogle),
    });
    console.log(`[api/review-image] Response | mediaPath="${result.mediaPath}" | selectedUrl="${result.selectedUrl}"`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[api/review-image] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
