import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { GoogleAuth } from "google-auth-library";
import { Storage } from "@google-cloud/storage";
import { fileURLToPath } from "url";

// ======================================================
// PATH SETUP
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// CONFIG
// ======================================================

const SERVICE_ACCOUNT_JSON = path.resolve(
  __dirname,
  "axiomatic-treat-417617-84f05b46f512.json"
);

const PROJECT_ID = "axiomatic-treat-417617";
const LOCATION = "us-central1";
const MODEL_ID = "veo-3.0-fast-generate-001";


const OUTPUT_GCS_PREFIX = "gs://axiomatic-veo-output/veo/";
const LOCAL_OUTPUT_DIR = path.resolve(__dirname, "../../public");

const API_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1`;

// ======================================================
// TYPES
// ======================================================

type PredictResponse = {
  name: string;
};

type PollResponse = {
  done?: boolean;
};

// ======================================================
// AUTH
// ======================================================

const credentials = JSON.parse(
  fs.readFileSync(SERVICE_ACCOUNT_JSON, "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const storage = new Storage({
  credentials,
  projectId: PROJECT_ID,
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token!;
}

// ======================================================
// HELPERS
// ======================================================

function imageToBase64(imagePath: string): {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
} {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : null;

  if (!mimeType) {
    throw new Error("Only PNG or JPEG images are supported");
  }

  return {
    base64: fs.readFileSync(imagePath).toString("base64"),
    mimeType,
  };
}

// ---- Find the actual generated MP4 (NO guessing) ----
async function findGeneratedVideo(
  outputPrefix: string
): Promise<string> {
  const withoutScheme = outputPrefix.replace("gs://", "");
  const [bucketName, ...prefixParts] = withoutScheme.split("/");
  const prefix = prefixParts.join("/");

  const [files] = await storage
    .bucket(bucketName)
    .getFiles({ prefix });

  const mp4 = files.find((f) => f.name.endsWith(".mp4"));

  if (!mp4) {
    throw new Error(
      `No MP4 found in ${outputPrefix}. Files: ${files
        .map((f) => f.name)
        .join(", ")}`
    );
  }

  return `gs://${bucketName}/${mp4.name}`;
}

// ---- Download any GCS file safely ----
async function downloadFromGCS(
  gcsUri: string,
  outputName: string
): Promise<string> {
  const withoutScheme = gcsUri.replace("gs://", "");
  const [bucketName, ...blobParts] = withoutScheme.split("/");
  const blobPath = blobParts.join("/");

  fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });

  const localPath = path.join(
    LOCAL_OUTPUT_DIR,
    `${outputName}.mp4`
  );

  await storage
    .bucket(bucketName)
    .file(blobPath)
    .download({ destination: localPath });

  return localPath;
}

// ======================================================
// MAIN FUNCTION (FINAL & SAFE)
// ======================================================

export async function generateVeoVideo(
  prompt: string,
  outputName: string,
  imagePath?: string
): Promise<{ gcsUri: string; localPath: string }> {
  const accessToken = await getAccessToken();

  const instance: any = { prompt };

  // Image → Video if imagePath provided
  if (imagePath) {
    const { base64, mimeType } = imageToBase64(imagePath);
    instance.image = {
      bytesBase64Encoded: base64,
      mimeType,
    };
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      storageUri: `${OUTPUT_GCS_PREFIX}${outputName}/`,
      sampleCount: 1,
    },
  };

  // ---------------- START JOB ----------------

  const startRes = await fetch(
    `${API_BASE}/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!startRes.ok) {
    throw new Error(await startRes.text());
  }

  const startJson = (await startRes.json()) as PredictResponse;
  const operationName = startJson.name;

  console.log("🚀 Operation started:", operationName);

  // ---------------- POLL ----------------

  while (true) {
    await new Promise((r) => setTimeout(r, 15000));

    const pollRes = await fetch(
      `${API_BASE}/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operationName }),
      }
    );

    if (!pollRes.ok) {
      throw new Error(await pollRes.text());
    }

    const pollJson = (await pollRes.json()) as PollResponse;

    if (pollJson.done === true) {
      const outputPrefix = `${OUTPUT_GCS_PREFIX}${outputName}/`;

      console.log("🔍 Searching output folder:", outputPrefix);

      const gcsUri = await findGeneratedVideo(outputPrefix);

      console.log("✅ Video found:", gcsUri);

      const localPath = await downloadFromGCS(
        gcsUri,
        outputName
      );

      console.log("⬇️ Saved locally:", localPath);

      return { gcsUri, localPath };
    }

    console.log("⏳ Generating...");
  }
}


// async function run() {
//   const result = await generateVeoVideo(
//     "Slow cinematic zoom with ambient music",
//     "final_test_video",
//     "public/test.png" // remove for text-only
//   );

//   console.log("FINAL RESULT:", result);
// }

// run().catch(console.error);

