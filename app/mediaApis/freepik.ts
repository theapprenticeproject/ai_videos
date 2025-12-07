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
        "x-freepik-api-key": "FPSX4cb014cd3cf3421a361baf7be130a214"
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

export async function generateFreepikAI(
  type: "image" | "video",
  prompt: string,
  aspect_ratio: string = "widescreen_16_9"
): Promise<string | null> {
  const endpoints = {
    image: {
      submit: "https://api.freepik.com/v1/ai/text-to-image/flux-dev",
      status: (taskId: string) => `https://api.freepik.com/v1/ai/text-to-image/flux-dev/${taskId}`
    },
    video: {
      submit: "https://api.freepik.com/v1/ai/image-to-video/kling",
      status: (taskId: string) => `https://api.freepik.com/v1/ai/image-to-video/kling/${taskId}`
    }
  };

  // 1. Submit generation request
  const submitRes = await fetch(endpoints[type].submit, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-freepik-api-key": "FPSX4cb014cd3cf3421a361baf7be130a214"
    },
    body: JSON.stringify({ prompt, aspect_ratio })
  });

  if (!submitRes.ok) {
    throw new Error(`Failed to submit request: ${submitRes.statusText}`);
  }
  const submitData = await submitRes.json();
  const taskId = submitData.data?.task_id;
  if (!taskId) throw new Error("No task_id in response");

  // 2. Poll for completion every 3s (max 90s)
  const statusUrl = endpoints[type].status(taskId);
  let tries = 0, maxTries = 30;
  return new Promise<string | null>((resolve, reject) => {
    async function poll() {
      tries++;
      try {
        const pollRes = await fetch(statusUrl, {
          headers: { "x-freepik-api-key": "FPSX4cb014cd3cf3421a361baf7be130a214" }
        });
        const pollData = await pollRes.json();
        const status = pollData.data?.status;
        if (status === "COMPLETED" && Array.isArray(pollData.data.generated) && pollData.data.generated[0]) {
          resolve(pollData.data.generated[0]);
        } else if (status === "FAILED") {
          resolve(null);
        } else if (tries < maxTries) {
          setTimeout(poll, 3000);
        } else {
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    }
    poll();
  });
}

// Example image generation:
// generateFreepikAI("image", "A photorealistic cat astronaut on Mars with sunrise").then(url => {
//   console.log("Generated image URL:", url);
// });

// // Example video generation:
// generateFreepikAI("video", "A timelapse of a city skyline transforming from day to night").then(url => {
  // console.log("Generated video URL:", url);
// });

// async function a(){
//   console.log("Searching Freepik assets...");
//   let a = await searchFreepikFreemiumAssets("cat", "horizontal", "video", 1)
//   console.log("Freepik assets:",);
//   console.log(JSON.stringify(a,null,2));
// }


// a();