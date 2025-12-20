import { FREEPIK_API_KEY } from "../constant";
const API_KEY = FREEPIK_API_KEY;



export async function searchFreepikFreemiumAssets(
  query: string,
  orientation: "horizontal" | "vertical" | "square" | "panoramic",
  type: "photo" | "vector" | "icon" | "psd" | "video",
  limit: number
): Promise<any[]> {
  const params = new URLSearchParams({
    term: query,
    orientation,
    type,
    limit: limit.toString(),
    order: "relevance",
    // license: "freemium"
  });

  const response = await fetch(
    `https://api.freepik.com/v1/resources?${params.toString()}`,
    {
      headers: {
        "x-freepik-api-key": FREEPIK_API_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Freepik API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Filter: Only assets that have at least one license with type "freemium"
  const freemiumAssets = data.data?.filter(
    (item: any) => (item.licenses || []).some((lic: any) => lic.type === "freemium")
  ) || [];

  // Map essential attributes
  return freemiumAssets.map((asset: any) => ({
    id: asset.id,
    title: asset.title,
    url: asset.url,
    best_quality_url: asset.image?.source?.url,
    orientation: asset.image?.orientation,
    type: asset.image?.type,
    width: asset.image?.source?.size?.split("x")[0] || undefined,
    height: asset.image?.source?.size?.split("x")[1] || undefined,
    formats: asset.meta?.available_formats ? Object.keys(asset.meta.available_formats) : [],
    filename: asset.filename,
    stats: asset.stats,
    author: asset.author,
    license_url: asset.licenses?.length ? asset.licenses[0].url : undefined,
    web_link: asset.url, // Download link usually is the .zip from the asset.url, especially for icons/vectors
    published_at: asset.meta?.published_at,
    description: asset.description || asset.title,
    tags: asset.related?.keywords
  }));
}

// Example usage:
// searchFreepikFreemiumAssets("amitabh", "square", "photo", 2).then(results => {
//   for (const asset of results) {
//     console.log(`Title: ${asset.title}`);
//     console.log(`Page: ${asset.url}`);
//     console.log(`Preview: ${asset.preview}`);
//     console.log(`Author: ${asset.author?.name}`);
//     console.log(`License: ${asset.license_url}`);
//     console.log(`Download link: ${asset.download_url}`);
//     console.log(`Formats: ${asset.formats.join(", ")}`);
//     console.log(`Published: ${asset.published_at}`);
//     console.log("------");
//   }
// });


/**
 * Ensures the image is a pure Base64 string if it's not a URL.
 * Also handles removing the "data:image/png;base64," prefix if present.
 */
import fs from 'fs';
/**
 * Detects input type and converts to API-ready format.
 * Freepik Hailuo prefers pure Base64 (no data:image prefix) or a public URL.
 */
async function processImageInput(input: string): Promise<string> {
  // 1. Check if it's already a URL
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // 2. Check if it's a Local File Path
  if (fs.existsSync(input)) {
    try {
      const fileBuffer = fs.readFileSync(input);
      // Freepik Hailuo often rejects the "data:image/..." prefix, 
      // so we return pure base64.
      return fileBuffer.toString('base64');
    } catch (err) {
      throw new Error(`Failed to read local file: ${input}`);
    }
  }

  // 3. Check if it's already a Base64 string
  const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(input.replace(/^data:image\/\w+;base64,/, ""));
  if (isBase64) {
    // Strip prefix just in case it exists
    return input.replace(/^data:image\/\w+;base64,/, "");
  }

  throw new Error("Invalid image input: Not a valid URL, local path, or Base64 string.");
}

/**
 * SHARED POLLING UTILITY
 */
async function pollResult(url: string, maxTries: number, interval: number): Promise<string | null> {
  for (let i = 0; i < maxTries; i++) {
    const res = await fetch(url, { headers: { "x-freepik-api-key": API_KEY } });
    const pollData = await res.json();
    const status = pollData.data?.status || pollData.status;

    console.log(`Status: ${status} (${i + 1}/${maxTries})`);

    if (status === "COMPLETED" || status === "SUCCESS") {
      return pollData.data?.video_url || pollData.data?.generated?.[0] || null;
    }
    if (status === "FAILED" || status === "ERROR") return null;

    await new Promise(r => setTimeout(r, interval));
  }
  return null;
}


/**
 * 1. IMAGE GENERATION FUNCTION
 * Supports Mystic, Flux, Seedream, and Classic models.
 */
export async function generateFreepikImage(
  model: "mystic" | "flux-dev" | "flux-pro-v1-1" | "hyperflux" | "seedream" | "seedream-v4" | "classic",
  prompt: string,
  aspect_ratio: string = "widescreen_16_9"
): Promise<string | null> {

  // Base endpoints for image generation models
  const baseUrl = model === "classic"
    ? "https://api.freepik.com/v1/ai/text-to-image"
    : model === "mystic"
      ? "https://api.freepik.com/v1/ai/mystic"
      : `https://api.freepik.com/v1/ai/text-to-image/${model}`;

  console.log(`🚀 Starting Image Gen: [${model}] - Prompt: ${prompt.substring(0, 30)}...`);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": API_KEY
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio,
        num_images: 1 // Default to 1 for speed
      })
    });

    if (!response.ok) {
      const errorDetail = await response.json();
      console.error("❌ Image Submission Failed:", JSON.stringify(errorDetail, null, 2));
      return null;
    }

    const data = await response.json();
    const taskId = data.data?.task_id;
    if (!taskId) return null;

    // Images are fast: poll for 90s (30 tries * 3s)
    return pollResult(`${baseUrl}/${taskId}`, 30, 3000);

  } catch (error) {
    console.error("Critical Image Gen Error:", error);
    return null;
  }
}


/**
 * FULL VIDEO GENERATION FUNCTION
 */
export async function generateFreepikVideo(
  model: "kling" | "hailuo-02-768p" | "hailuo-02-1080p" | "seedance-lite-720p" | "seedance-pro-480p",
  prompt: string,
  imageInput: string, // Can be URL, /local/path, or Base64
  duration: 6 | 10 = 6
): Promise<string | null> {

  const modelEndpoints: Record<string, string> = {
    "kling": "https://api.freepik.com/v1/ai/image-to-video/kling",
    "hailuo-02-768p": "https://api.freepik.com/v1/ai/image-to-video/minimax-hailuo-02-768p",
    "hailuo-02-1080p": "https://api.freepik.com/v1/ai/image-to-video/minimax-hailuo-02-1080p",
    "seedance-lite-720p": "https://api.freepik.com/v1/ai/image-to-video/seedance-lite-720p",
    "seedance-pro-480p": "https://api.freepik.com/v1/ai/image-to-video/seedance-pro-480p"
  };

  try {
    // PRE-PROCESS IMAGE
    const processedImage = await processImageInput(imageInput);

    const payload = {
      prompt,
      first_frame_image: processedImage,
      duration,
      prompt_optimizer: true
    };

    const response = await fetch(modelEndpoints[model], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetail = await response.json();
      console.error("API Rejected:", JSON.stringify(errorDetail, null, 2));
      return null;
    }

    const data = await response.json();
    const taskId = data.data?.task_id || data.task_id;

    return pollResult(`${modelEndpoints[model]}/${taskId}`, 60, 10000);

  } catch (error) {
    console.error("Processing Error:", error);
    return null;
  }
}
// Example image generation:
let p = `TYPE: Animated for kids explainer
  Scene: Split Screen.

  Left: A friendly-looking man, Mr. Gupta, busy arranging clothes in a modest retail shop.

  Right: A woman, Meena, writing on a blackboard in a classroom filled with children.`
let p2 = `type:animated kids explaners

Scene: A teenage boy's room.


Visual: Rahul (around 13 years old) sits comfortably in a beanbag chair surrounded by books. He is engrossed in a large book titled "World History."
`
// generateFreepikImage("flux-dev", p2, "widescreen_16_9").then(url => {
//   console.log("Generated image URL:", url);
// });

// Example video generation:
// generateFreepikVideo("hailuo-02-768p", "on left man selling and on right women teaching", "ENTER_FILE_NAME_0.png", 6).then(url => {
//   console.log("Generated video URL:", url);
// });

// async function a(){
//   console.log("Searching Freepik assets...");
//   let a = await searchFreepikFreemiumAssets("cat", "horizontal", "video", 1)
//   console.log("Freepik assets:",);
//   console.log(JSON.stringify(a,null,2));
// }


// a();