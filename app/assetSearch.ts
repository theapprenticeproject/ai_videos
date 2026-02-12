// import { searchPexels } from "../app/mediaApis/pexels";
// import {
//   searchFreepikFreemiumAssets,
//   generateFreepikAI,
// } from "../app/mediaApis/freepik";
// import { callStructuredLlm } from "./llm";
// import { LLM_API_KEY } from "../app/constant";
// import Sanscript from "@indic-transliteration/sanscript";

// const apiKeys = {
//   PEXELS: process.env.PEXELS_API_KEY,
//   PIXABAY: process.env.PIXABAY_API_KEY,
//   UNSPLASH: process.env.UNSPLASH_API_KEY,
//   PNGMAKER: process.env.PNGMAKER_API_KEY,
//   GOOGLE_API_KEY: process.env.GOOGLE_IMAGE_SEARCH_API_KEY,
//   GOOGLE_CX: process.env.GOOGLE_SEARCH_ENGINE_ID,
//   FREEPIK: process.env.FREEPIK_API_KEY,
//   VECTEEZY: process.env.VECTEEZY_API_KEY,
//   FLATICON: process.env.FLATICON_API_KEY,
// };

// interface GetApiConfigParams {
//   source: string;
//   query: string;
//   limit?: number;
// }

// interface ApiHeaders {
//   [key: string]: string | undefined;
// }

// interface ApiConfig {
//   url: string;
//   headers: ApiHeaders;
// }

// function getApiConfig(
//   source: string,
//   query: string,
//   limit: number = 10
// ): ApiConfig {
//   switch (source) {
//     case "pexels":
//       return {
//         url: `https://api.pexels.com/v1/search?query=${query}&per_page=${limit}`,
//         headers: { Authorization: apiKeys.PEXELS },
//       };
//     case "pixabay":
//       return {
//         url: `https://pixabay.com/api/?key=${
//           apiKeys.PIXABAY
//         }&q=${encodeURIComponent(query)}&per_page=${limit}`,
//         headers: {},
//       };
//     case "unsplash":
//       return {
//         url: `https://api.unsplash.com/search/photos?query=${query}&per_page=${limit}`,
//         headers: { Authorization: `Client-ID ${apiKeys.UNSPLASH}` },
//       };
//     case "pngmaker":
//       return {
//         url: `https://api.pngmaker.ai/v1/search?q=${query}&limit=${limit}`,
//         headers: { Authorization: apiKeys.PNGMAKER },
//       };
//     case "googleImages":
//       return {
//         url: `https://www.googleapis.com/customsearch/v1?q=${query}&searchType=image&num=${limit}&key=${apiKeys.GOOGLE_API_KEY}&cx=${apiKeys.GOOGLE_CX}`,
//         headers: {},
//       };
//     case "pexelsVideos":
//       return {
//         url: `https://api.pexels.com/videos/search?query=${query}&per_page=${limit}`,
//         headers: { Authorization: apiKeys.PEXELS },
//       };
//     case "pixabayVideos":
//       return {
//         url: `https://pixabay.com/api/videos/?key=${
//           apiKeys.PIXABAY
//         }&q=${encodeURIComponent(query)}&per_page=${limit}`,
//         headers: {},
//       };
//     case "freepik":
//       return {
//         url: `https://api.freepik.com/v1/resources/search?q=${query}&limit=${limit}`,
//         headers: { Authorization: apiKeys.FREEPIK },
//       };
//     case "vecteezy":
//       return {
//         url: `https://api.vecteezy.com/v1/search?q=${query}&limit=${limit}`,
//         headers: { Authorization: apiKeys.VECTEEZY },
//       };
//     case "flaticon":
//       return {
//         url: `https://api.flaticon.com/v3/search/icons?q=${query}&limit=${limit}`,
//         headers: { Authorization: `Bearer ${apiKeys.FLATICON}` },
//       };
//     default:
//       throw new Error(`Unsupported API source: ${source}`);
//   }
// }

// // interface ApiConfig {
// //     url: string;
// //     headers: Record<string, string | undefined>;
// // }

// // export async function fetchAssets(
// //     source: string,
// //     query: string,
// //     limit: number = 10
// // ): Promise<unknown> {
// //     try {
// //         const { url, headers }: ApiConfig = getApiConfig(source, query, limit);
// //         const res: Response = await fetch(url, { headers });

// //         if (!res.ok) {
// //             throw new Error(`Failed to fetch from ${source}: ${res.statusText}`);
// //         }

// //         const data: unknown = await res.json();
// //         return data;
// //     } catch (error) {
// //         console.error(`[fetchAssets] Error for source "${source}":`, error);
// //         throw error;
// //     }
// // }

// type AssetResult = {
//   selected_asset: string;
//   alternate_asset: string[];
// };

// export async function callAssetSearch(
//   keywords: string,
//   style: string,
//   subtype: string = ""
// ): Promise<AssetResult> {
//   if (style === "slideshow") {
//     console.log("in slideshow");
//     let temp: string[] = [];
//     let response = { selected_asset: "", alternate_asset: [] };

//     if (subtype != "story") {
//       let photoResults = await searchPexels(
//         "photo",
//         keywords,
//         2,
//         "landscape",
//         "large"
//       );
//       console.log("photo result is ", photoResults);
//       // let freepikResults = await searchFreepikFreemiumAssets(keywords, "horizontal", "photo", 2)
//       let videoResults = await searchPexels(
//         "video",
//         keywords,
//         2,
//         "landscape",
//         "large"
//       );
//       console.log("result is ", videoResults);

//       // temp = [...photoResults, ...videoResults];
//       // temp = [...(videoResults||[])];
//       // temp = [...(photoResults || []), ...(freepikResults || []),...(videoResults||[])];
//       temp = [...(photoResults || []), ...(videoResults || [])];
//       // temp = []
//       console.log("temp is ", temp);

//       const prompt = `
//     You are a smart media selection assistant. The user searched for: "${keywords}".

//     Here are the media asset URLs available:
// ${JSON.stringify(temp)}

//     From these options, select:
//     - One **best match** for the query (as "selected_asset")
//     - A few **other strong alternatives** (as "alternate_asset", an array of strings)

//     Return the result in this structured JSON format:
//     {
//     "selected_asset": "string",
//     "alternate_asset": ["string", "string", ...]
//     }
//     `;

//       //   ${temp.map((url, index) => `Option ${index + 1}: ${url}`).join("\n")}
//       console.log("prompt  . ", prompt);

//       try {
//         response = await callStructuredLlm(
//           LLM_API_KEY,
//           "You help select the most appropriate media assets from a list of URLs based on a user query by analyzing given metadata of media , and thinking and providing best selection with reasoning.",
//           prompt,
//           {
//             type: "object",
//             properties: {
//               selected_asset: {
//                 type: "string",
//                 description:
//                   "The best_quality_url of the most relevant media object asset based on the query. Select only if you are 100% sure of that it contains subject as required query, else give empty string.",
//               },
//               alternate_asset: {
//                 type: "array",
//                 description:
//                   "A list of alternate media best_quality_url URLs that are also good matches.Select only if you are 100% sure of that it contains subject as required query, else give empty array.",
//                 items: {
//                   type: "string",
//                 },
//               },
//               reasoning: {
//                 type: "string",
//                 description:
//                   "A brief explanation of how the context led to the choice of visual_query.",
//               },
//             },
//             required: ["selected_asset", "alternate_asset"],
//           } as any // 👈 fix: bypass type checking for schema here
//         );
//       } catch (err) {
//         try {
//           const url = await generateFreepikAI("image", keywords);
//           response.selected_asset = url || "";
//           console.log("Selected asset set to:", url);
//         } catch (err) {
//           console.error("Error generating Freepik AI image:", err);
//         }
//       }

//       console.log("response is ", response);
//     }

//     if (!response.selected_asset) {
//       if (temp.length > 0 && temp.length > 0) {
//         // assuming temp is an array and temp.length > 0 means temp>0
//         try {
//           // Try generation first
//           const url = await generateFreepikAI("image", keywords);

//           if (url) {
//             // If generation successful and not blank
//             response.selected_asset = url;
//             console.log("Selected asset set via AI:", url);
//           } else {
//             // If generation returned blank, fallback to last item in temp
//             const lastItem: any = temp[temp.length - 1];
//             if (lastItem && lastItem.best_quality_url) {
//               response.selected_asset = lastItem.best_quality_url;
//               console.log(
//                 "Selected asset set from temp (fallback):",
//                 response.selected_asset
//               );
//             } else {
//               throw new Error(
//                 "Generation returned blank and last item in temp missing best_quality_url"
//               );
//             }
//           }
//         } catch (err) {
//           // If generation throws error, fallback to last item in temp if possible
//           console.warn(
//             "Error generating Freepik AI image, trying last item in temp...",
//             err
//           );

//           const lastItem: any = temp[temp.length - 1];
//           if (lastItem && lastItem.best_quality_url) {
//             response.selected_asset = lastItem.best_quality_url;
//             console.log(
//               "Selected asset set from temp (fallback after error):",
//               response.selected_asset
//             );
//           } else {
//             throw new Error(
//               "Generation failed and last item in temp missing best_quality_url"
//             );
//           }
//         }
//       } else {
//         // temp.length == 0 or temp is empty
//         try {
//           // Just try generation, no fallback
//           const url = await generateFreepikAI("image", keywords);
//           if (url) {
//             response.selected_asset = url;
//             console.log("Selected asset set via AI:", url);
//           } else {
//             throw new Error(
//               "Generation returned blank and no temp to fallback to"
//             );
//           }
//         } catch (err) {
//           throw new Error(
//             "Error generating Freepik AI image and no temp to fallback to: " +
//               err
//           );
//         }
//       }
//     }

//     // return {
//     //   selectedUrl: "https://example.com/slideshow1.mp4",
//     //   alternateUrls: ["https://example.com/slideshow2.mp4", "https://example.com/slideshow3.mp4"]
//     // };
//     return response;
//   } else {
//     // if (subtype === "image") {
//     //   // Define sources to fetch from
//     //   const imageSources = ['pexels', 'pixabay', 'unsplash', 'pngmaker', 'googleImages', 'freepik', 'vecteezy', 'flaticon'];

//     //   // Fetch assets from each source
//     //   const imagePromises = imageSources.map(source =>
//     //     fetchAssets(source, keywords.join(' '), 5)
//     //   );
//     //   const imageResults = await Promise.all(imagePromises);

//     //   // Flatten and filter results
//     //   const images = imageResults.flat().filter((item: any) => item && item.url);

//     //   if (images.length === 0) {
//     //     throw new Error("No images found for the given keywords.");
//     //   }

//     //   return {
//     //     selectedUrl: images[0].url,
//     //     alternateUrls: images.slice(1).map((img: any) => img.url)
//     //   };
//     // }

//     // Default fallback if subtype is not handled
//     throw new Error("Unsupported subtype or no subtype provided.");
//   }
// }

// // callAssetSearch("solar ", "slideshow")
