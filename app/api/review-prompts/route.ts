import { NextRequest, NextResponse } from "next/server";
import { refreshReviewPromptsForChunks } from "../../videoReview";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      items,
      changedChunkIds,
      modelName = "gemini-2.0-flash-lite",
      visualTheme = "",
      promptsOnly = false,
    } = body;

    if (typeof script !== "string" || !Array.isArray(items)) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    const refreshedItems = await refreshReviewPromptsForChunks({
      script,
      items,
      changedChunkIds: changedChunkIds || items.map((i: any) => i.chunkId),
      modelName,
      visualTheme,
      promptsOnly,
    });

    return NextResponse.json({ items: refreshedItems });
  } catch (error: any) {
    console.error("[api/review-prompts] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
