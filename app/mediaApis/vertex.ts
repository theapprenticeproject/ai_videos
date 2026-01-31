// // type VeoResponse = {
// //   video_uri: string;
// //   local_path?: string;
// // };

// // export async function generateVeoVideo(
// //   prompt: string,
// //   download: boolean = false
// // ): Promise<VeoResponse> {
// //   const res = await fetch("http://localhost:8000/generate", {
// //     method: "POST",
// //     headers: {
// //       "Content-Type": "application/json",
// //     },
// //     body: JSON.stringify({
// //       prompt,
// //       download,
// //     }),
// //   });

// //   if (!res.ok) {
// //     const err = await res.text();
// //     throw new Error(`Veo error: ${err}`);
// //   }

// //   return res.json();
// // }


// import fs from "fs";
// import path from "path";
// import fetch from "node-fetch";
// import { GoogleGenAI } from "@google/genai";
// import { GoogleAuth } from "google-auth-library";
// import { Storage } from "@google-cloud/storage";

// // ======================================================
// // 🔐 CONFIG (HARDCODED)
// // ======================================================

// const SERVICE_ACCOUNT_JSON =
//   "app/mediaApis/axiomatic-treat-417617-84f05b46f512.json";

// const PROJECT_ID = "axiomatic-treat-417617";
// const LOCATION = "us-central1";

// const MODEL_ID = "veo-3.1-generate-001";

// // GCS
// const GCS_BUCKET = "axiomatic-veo-output";
// const GCS_VIDEO_PREFIX = "veo/videos";
// const GCS_IMAGE_PREFIX = "veo/inputs";

// // Local
// const LOCAL_DOWNLOAD_DIR = "downloads";
// const TEMP_IMAGE_PATH = "temp_input_image.png";

// // ======================================================
// // 🔑 AUTH
// // ======================================================

// const auth: any = new GoogleAuth({
//   credentials: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_JSON, "utf8")),
//   scopes: ["https://www.googleapis.com/auth/cloud-platform"],
// });

// const genai = new GoogleGenAI({
//   vertexai: true,
//   project: PROJECT_ID,
//   location: LOCATION,
// });

// const storage = new Storage({
//   credentials: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_JSON, "utf8")),
//   projectId: PROJECT_ID,
// });

// // ======================================================
// // 📤 HELPERS
// // ======================================================

// async function uploadToGCS(
//   localPath: string,
//   gcsPath: string
// ): Promise<string> {
//   await storage.bucket(GCS_BUCKET).upload(localPath, {
//     destination: gcsPath,
//   });
//   return `gs://${GCS_BUCKET}/${gcsPath}`;
// }

// async function prepareImage(imageSource: string) {
//   // Case 1: GCS image
//   if (imageSource.startsWith("gs://")) {
//     return {
//       gcsUri: imageSource,
//       mimeType: "image/png",
//     };
//   }

//   // Case 2: Public URL
//   if (imageSource.startsWith("http")) {
//     const res = await fetch(imageSource);
//     if (!res.ok) throw new Error("Failed to fetch image URL");

//     const buffer = await res.arrayBuffer();
//     fs.writeFileSync(TEMP_IMAGE_PATH, Buffer.from(buffer));

//     const gcsUri = await uploadToGCS(
//       TEMP_IMAGE_PATH,
//       `${GCS_IMAGE_PREFIX}/${path.basename(TEMP_IMAGE_PATH)}`
//     );

//     return {
//       gcsUri,
//       mimeType: "image/png",
//     };
//   }

//   // Case 3: Local file
//   if (fs.existsSync(imageSource)) {
//     const gcsUri = await uploadToGCS(
//       imageSource,
//       `${GCS_IMAGE_PREFIX}/${path.basename(imageSource)}`
//     );

//     return {
//       gcsUri,
//       mimeType: "image/png",
//     };
//   }

//   throw new Error("Unsupported image_source");
// }

// async function downloadVideoFromGCS(
//   gcsUri: string,
//   outputName: string
// ): Promise<string> {
//   const [, bucketName, ...blobParts] = gcsUri.split("/");
//   const blobPath = blobParts.join("/");

//   fs.mkdirSync(LOCAL_DOWNLOAD_DIR, { recursive: true });

//   const localPath = path.join(
//     LOCAL_DOWNLOAD_DIR,
//     `${outputName}.mp4`
//   );

//   await storage
//     .bucket(bucketName)
//     .file(blobPath)
//     .download({ destination: localPath });

//   return localPath;
// }

// // ======================================================
// // 🎬 MAIN FUNCTION
// // ======================================================

// export async function generateVideoFromImage(
//   prompt: string,
//   imageSource: string,
//   outputName: string,
//   download = true
// ): Promise<{
//   videoUri: string;
//   localPath?: string;
// }> {
//   const image = await prepareImage(imageSource);

//   const outputGcsUri = `gs://${GCS_BUCKET}/${GCS_VIDEO_PREFIX}/${outputName}.mp4`;

//   console.log("🚀 Starting Veo image-to-video generation...");

//   let operation = await genai.models.generateVideos({
//     model: MODEL_ID,
//     prompt,
//     image,
//     config: {
//       aspectRatio: "16:9",
//       durationSeconds: 6,
//       resolution: "720p",
//       numberOfVideos: 1,
//       enhancePrompt: true,
//       generateAudio: true,
//       outputGcsUri,
//       personGeneration: "allow_adult",
//     },
//   });

//   while (!operation.done) {
//     console.log("⏳ Generating...");
//     await new Promise((r) => setTimeout(r, 15000));
//     operation = await genai.operations.get({ operation });
//   }

//   const videoUri =
//     operation.response?.generatedVideos?.[0]?.video?.uri;

//   if (!videoUri) throw new Error("Veo generation failed");

//   const result: { videoUri: string; localPath?: string } = {
//     videoUri,
//   };

//   if (download) {
//     result.localPath = await downloadVideoFromGCS(
//       videoUri,
//       outputName
//     );
//   }

//   console.log("✅ Video generated:", videoUri);
//   return result;
// }

// // ======================================================
// // ▶ LOCAL TEST
// // ======================================================

// if (import.meta.url === `file://${process.argv[1]}`) {
//   generateVideoFromImage(
//     "Slow cinematic zoom on the subject, ambient music",
//     "public/test.png",
//     "local_image_video",
//     true
//   ).then(console.log).catch(console.error);
// }

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
