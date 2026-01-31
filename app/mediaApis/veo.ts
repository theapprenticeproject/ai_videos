import { GoogleGenAI } from "@google/genai";
import fs from "fs";

/**
 * ⚠️ API KEY IS HARDCODED HERE (as requested)
 */
const ai = new GoogleGenAI({
  apiKey: "AIzaSyDc5pzJpMQEl1oFDinVdW7Iz-v4WPG2kWo",
});

type GenerateVeoVideoParams = {
  prompt: string;
  imagePath?: string;      // optional image input
  outputPath?: string;     // default: output.mp4
};

export async function generateVeo3FastVideo({
  prompt,
  imagePath,
  outputPath = "output.mp4",
}: GenerateVeoVideoParams) {

  let imageInput: any = undefined;

  /** -----------------------------
   * Optional image → image-to-video
   * ----------------------------- */
  if (imagePath) {
    const imageBytes = fs.readFileSync(imagePath).toString("base64");

    imageInput = {
      imageBytes,
      mimeType: "image/jpeg",
    };
  }

  /** -----------------------------
   * Start video generation
   * ----------------------------- */
  let operation:any = await ai.models.generateVideos({
    model: "veo-3.0-fast-generate-001",
    prompt,
    ...(imageInput && { image: imageInput }),
  });

  /** -----------------------------
   * Poll operation until complete
   * ----------------------------- */
  while (!operation.done) {
    console.log("⏳ Waiting for Veo 3 Fast...");
    await new Promise((r) => setTimeout(r, 8000));

    operation = await ai.operations.getVideosOperation({
      operation,
    });
  }

  /** -----------------------------
   * Download generated video
   * ----------------------------- */
  const videoFile = operation.response.generatedVideos?.[0]?.video;
  if (!videoFile) {
    throw new Error("❌ No video returned from Veo");
  }

  await ai.files.download({
    file: videoFile,
    downloadPath: outputPath,
  });

  console.log(`✅ Video saved to ${outputPath}`);
}

/* ------------------------------------------------
   EXAMPLES
------------------------------------------------- */

// TEXT → VIDEO
// generateVeo3FastVideo({
//   prompt: `
// A close-up of two people staring at a cryptic drawing on a wall,
// torchlight flickering, cinematic lighting, realistic expressions,
// slow camera push-in
// `,
//   outputPath: "text_to_video.mp4",
// });

// IMAGE → VIDEO

// generateVeo3FastVideo({
//   prompt: `
// Animate this image with subtle camera movement,
// natural light motion, cinematic realism
// `,
//   imagePath: "temp/batch_gen_1768553983583_1_58430.png",
//   outputPath: "image_to_video.mp4",
// });

