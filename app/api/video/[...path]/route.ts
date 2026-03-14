import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs";

// ======================================================
// CONFIG (Matching vertex.ts)
// ======================================================

const SERVICE_ACCOUNT_JSON = path.resolve(
  process.cwd(),
  "app/mediaApis/axiomatic-treat-417617-84f05b46f512.json"
);
const PROJECT_ID = "axiomatic-treat-417617";
const BUCKET_NAME = "axiomatic-veo-output";

let storage: Storage;

try {
  const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_JSON, "utf8"));
  storage = new Storage({
    credentials,
    projectId: PROJECT_ID,
  });
} catch (err) {
  console.error("Failed to initialize storage in video proxy:", err);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    if (!storage) {
       return NextResponse.json({ error: "Storage not initialized" }, { status: 500 });
    }

    const { path: pathParts } = params;
    const objectPath = pathParts.join("/");

    console.log(`[Proxy] Requesting: ${objectPath}`);

    const file = storage.bucket(BUCKET_NAME).file(objectPath);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    
    // Create a readable stream from GCS
    const stream = file.createReadStream();

    // Return the stream as a response
    return new Response(stream as any, {
      headers: {
        "Content-Type": metadata.contentType || "video/mp4",
        "Cache-Control": "public, max-age=31536000",
        "Content-Length": metadata.size,
      },
    });

  } catch (error: any) {
    console.error("[Proxy] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
