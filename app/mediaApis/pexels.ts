// type MediaType = "photo" | "video";

// export async function searchPexels(
//   type: MediaType,
//   query: string,
//   numberOfResults: number,
//   orientation: "landscape" | "portrait" | "square",
//   size?: "large" | "medium" | "small"
// ): Promise<any[] | null> {
//   console.log("query is ", query);

//   const endpoint =
//     type === "photo"
//       ? "https://api.pexels.com/v1/search"
//       : "https://api.pexels.com/videos/search";

//   const params = new URLSearchParams({
//     query,
//     per_page: numberOfResults.toString(),
//     orientation,
//   });

//   if (size) params.append("size", size);

//   const response = await fetch(`${endpoint}?${params.toString()}`, {
//     headers: {
//       Authorization: "I9lBhi93TuQVJfC57HfW9WgA5fp8c36mmZ6D36Ixu2yUlLTyQORxieMn",
//     },
//   });

//   if (!response.ok) {
//     throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
//   }

//   const data = await response.json();

//   if (type === "photo" && data.photos?.length) {
//     return data.photos.map((photo: any) => ({
//       id: photo.id,
//       url: photo.url,
//       photographer: photo.photographer,
//       best_quality_url: photo.src.original,
//       thumbnail: photo.src.tiny,
//       width: photo.width,
//       height: photo.height,
//     }));
//   }

//   if (type === "video" && data.videos?.length) {
//     return data.videos.map((video: any) => {
//       let bestFile = null;
//       let bestArea = 0;

//       for (const file of video.video_files) {
//         const area = (file.width || 0) * (file.height || 0);
//         if (area > bestArea) {
//           bestFile = file;
//           bestArea = area;
//         }
//       }

//       return {
//         id: video.id,
//         url: video.url,
//         user: video.user?.name,
//         best_quality_url: bestFile?.link || null,
//         best_quality_dimensions: bestFile ? `${bestFile.width}x${bestFile.height}` : undefined,
//         preview: video.image,
//         duration: video.duration,
//       };
//     });
//   }

//   return null;
// }
import { sleep } from "../utils/utils";

// export async function searchPexels(
//   type: "photo" | "video",
//   query: string,
//   numberOfResults: number,
//   orientation?: "landscape" | "portrait" | "square",
//   size?: "large" | "medium" | "small"
// ): Promise<any[] | null> {
//   if (!query || query.trim() === "") {
//     console.warn("Empty query provided to searchPexels.");
//     return null;
//   }

//   sleep(10000)

//   const endpoint =
//     type === "photo"
//       ? "https://api.pexels.com/v1/search"
//       : "https://api.pexels.com/videos/search";

//   const params = new URLSearchParams();

//   params.append("query", query.trim());

//   // Ensure numberOfResults is valid, default 10
//   const perPage = Math.min(Math.max(numberOfResults, 1), 80);
//   params.append("per_page", perPage.toString());

//   // Append orientation only if valid and provided
//   if (orientation && ["landscape", "portrait", "square"].includes(orientation)) {
//     params.append("orientation", orientation);
//   }

//   // Append size only if valid and provided
//   if (size && ["large", "medium", "small"].includes(size)) {
//     params.append("size", size);
//   }

//   const url = `${endpoint}?${params.toString()}`;
//   console.log(`Pexels API Request URL: ${url}`);

//   const response = await fetch(url, {
//     headers: {
//       Authorization: "I9lBhi93TuQVJfC57HfW9WgA5fp8c36mmZ6D36Ixu2yUlLTyQORxieMn",
//     },
//   });

//   if (!response.ok) {
//     // Try to parse error response for more details
//     let errorDetails = "";
//     try {
//       const errorData = await response.json();
//       errorDetails = errorData?.error || JSON.stringify(errorData);
//     } catch {
//       errorDetails = response.statusText;
//     }
//     // throw new Error(`Pexels API error: ${response.status} ${response.statusText} - ${errorDetails}`);
//     console.log("error in pexels api ", errorDetails);
//     return []
//   }

//   const data = await response.json();

//   if (type === "photo" && Array.isArray(data.photos) && data.photos.length > 0) {
//     return data.photos.map((photo: any) => ({
//       id: photo.id,
//       url: photo.url,
//       photographer: photo.photographer,
//       best_quality_url: photo.src?.original,
//       thumbnail: photo.src?.tiny,
//       width: photo.width,
//       height: photo.height,
//     }));
//   }

//   if (type === "video" && Array.isArray(data.videos) && data.videos.length > 0) {
//     return data.videos.map((video: any) => {
//       let bestFile = null;
//       let bestArea = 0;

//       for (const file of video.video_files || []) {
//         const area = (file.width || 0) * (file.height || 0);
//         if (area > bestArea) {
//           bestFile = file;
//           bestArea = area;
//         }
//       }

//       return {
//         id: video.id,
//         url: video.url,
//         user: video.user?.name,
//         best_quality_url: bestFile?.link || null,
//         best_quality_dimensions: bestFile ? `${bestFile.width}x${bestFile.height}` : undefined,
//         preview: video.image,
//         duration: video.duration,
//       };
//     });
//   }

//   return null;
// }
export async function searchPexels(
  type: "photo" | "video",
  query: string,
  numberOfResults: number,
  orientation?: "landscape" | "portrait" | "square",
  size?: "large" | "medium" | "small"
): Promise<any[] | null> {
  if (!query || query.trim() === "") {
    console.warn("Empty query provided to searchPexels.");
    return null;
  }

  // sleep(10000) // (If you need it. Otherwise remove.)

  const endpoint =
    type === "photo"
      ? "https://api.pexels.com/v1/search"
      : "https://api.pexels.com/videos/search";

  const params = new URLSearchParams();

  params.append("query", query.trim());
  const perPage = Math.min(Math.max(numberOfResults, 1), 80);
  params.append("per_page", perPage.toString());

  if (orientation && ["landscape", "portrait", "square"].includes(orientation)) {
    params.append("orientation", orientation);
  }
  if (size && ["large", "medium", "small"].includes(size)) {
    params.append("size", size);
  }

  const url = `${endpoint}?${params.toString()}`;
  console.log(`Pexels API Request URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: "I9lBhi93TuQVJfC57HfW9WgA5fp8c36mmZ6D36Ixu2yUlLTyQORxieMn",
      },
    });

    if (!response.ok) {
      let errorDetails = "";
      try {
        const errorData = await response.json();
        errorDetails = errorData?.error || JSON.stringify(errorData);
      } catch {
        errorDetails = response.statusText;
      }
      console.log("error in pexels api ", errorDetails);
      return [];
    }

    const data = await response.json();

    if (type === "photo" && Array.isArray(data.photos) && data.photos.length > 0) {
      return data.photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        photographer: photo.photographer,
        best_quality_url: photo.src?.original,
        thumbnail: photo.src?.tiny,
        width: photo.width,
        height: photo.height,
      }));
    }

    if (type === "video" && Array.isArray(data.videos) && data.videos.length > 0) {
      return data.videos.map((video: any) => {
        let bestFile = null;
        let bestArea = 0;
        for (const file of video.video_files || []) {
          const area = (file.width || 0) * (file.height || 0);
          if (area > bestArea) {
            bestFile = file;
            bestArea = area;
          }
        }
        return {
          id: video.id,
          url: video.url,
          user: video.user?.name,
          best_quality_url: bestFile?.link || null,
          best_quality_dimensions: bestFile ? `${bestFile.width}x${bestFile.height}` : undefined,
          preview: video.image,
          duration: video.duration,
        };
      });
    }

    return null;
  } catch (error) {
    // Any fetch/network error or unexpected problem returns empty array
    console.log("error calling pexels", error);
    return [];
  }
}



// Usage Examples:

// // Best photo (landscape)
// searchPexels("photo", "mountain", 1, "landscape").then(result => {
//   console.log("Best photo:", result);
// });

// // Best video (portrait)
// searchPexels("video", "man", 3, "portrait", "large").then(result => {
//   console.log("Best video:", JSON.stringify(result,null,2));
// });
