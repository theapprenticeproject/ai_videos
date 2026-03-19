import { NextRequest, NextResponse } from "next/server";
import { regenerateReviewImageForChunk } from "../../videoReview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, useGoogle = false } = body;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await regenerateReviewImageForChunk({
      prompt,
      useGoogle: Boolean(useGoogle),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[api/review-image] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
