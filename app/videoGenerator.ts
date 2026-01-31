"use server";
import { callLlm, callStructuredLlm } from "./llm";
import {
  fixIfBrokenVideo,
  getTimestampsForPhrase,
  saveDataAsJSON,
} from "./utils/utils";
import { templateSelector } from "./templating";
import { callAssetSearch } from "./assetSearch";
// import { textToSpeech,speechToText } from "./utils/audioTranscript";
import { downloadFile } from "./utils/downloadAsset";
import { speechToText } from "./utils/speechToText";
import { textToSpeech, generateSpeechWithTranscript } from "./utils/audioUtils";
import { renderPersonalizedVideo } from "../revideo/render";
import Sanscript from "@indic-transliteration/sanscript";
import { getAudioDuration } from "./utils/utils";

import { deleteFiles } from "./utils/utils";
import { generateFreepikImage, generateFreepikVideo } from "./mediaApis/freepik";
import { generateNanoBananaImage, generateNanoBananaBatch } from "./mediaApis/nanoBanana";
import { generateVeo3FastVideo } from "./mediaApis/veo";
import { generateVeoVideo } from "./mediaApis/vertex";
import { generateImagen4Image } from "./mediaApis/imagegen4";
import { searchPexels } from "./mediaApis/pexels";
import { searchYouTubeImages } from "./mediaApis/googleSearch";
import data from "../dynamication.json"


import { AUDIO_API_KEY, LLM_API_KEY, TRANSCRIPT_API_KEY, ELEVENLABS_API_KEY } from "./constant";

async function retryLlmCall<T>(
  fn: (...args: any[]) => Promise<T>,
  args: any[],
  retries = 5,
  delayMs = 10000
): Promise<T | ""> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(...args);
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || "Unknown error";
      console.warn(`Attempt ${i + 1} failed: ${errorMsg}`);

      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error("All retry attempts failed. Returning blank.");
        return "" as T | "";
      }
    }
  }

  // Should never reach here
  return "" as T | "";
}

function convertSceneToAsset(
  sceneJson: { [key: string]: any }[]
): { [key: string]: any }[] {
  return sceneJson.map(({ startTime, endTime, ...rest }) => ({
    ...rest,
    start: startTime,
    end: endTime,
  }));
}

function convertHindiToHinglish(
  trans: { word: string; startTime: number; endTime: number }[]
): { word: string; startTime: number; endTime: number }[] {
  return trans.map((obj) => ({
    ...obj,
    // word: Sanscript.t(obj.word, 'devanagari', 'itrans').toLowerCase()
    word: Sanscript.t(obj.word, "devanagari", "iast").toLowerCase(),
  }));
}

// function formatSceneJsonToAssets(sceneJson:any): { path: string; type: string; start: number; end: number }[] {
//   return sceneJson.map((chunk:any) => ({
//     path: chunk.templateJson.path,
//     type: chunk.selectedUrl?.includes('.mp4') ? 'video' : 'image',
//     start: chunk.startTime,
//     end: chunk.endTime,
//   }));
// }
function formatSceneJsonToAssets(
  sceneJson: any
): { path: string; type: string; start: number; end: number }[] {
  return sceneJson.map((chunk: any) => ({
    path: chunk.templateJson.path,
    type: chunk.templateJson.path?.includes(".mp4") ? "video" : "image",
    start: chunk.startTime,
    end: chunk.endTime,
  }));
}

function getAvatarDetails(voiceId: string) {
  const avatar = data.avatars.find(a => a.value === voiceId);
  return avatar || { languageCode: "en-US", gender: "FEMALE" }; // Default fallback
}

function getLang(voice: string): string {
  return getAvatarDetails(voice).languageCode;
}

function getGender(voice: string): string {
  return getAvatarDetails(voice).gender;
}

// getVoiceID is no longer needed as the voice IS the ID now


type ChunkJson = {
  chunkId: number;
  chunkText: string;
  keywords: string;
  startTime: number;
  endTime: number;
  words: { word: string; startTime: number; endTime: number }[];
  selectedUrl: string;
  alternateUrls: string[];
  template: string; // e.g. "slideshow", "image_fullscreen_text", etc.
  templateJson: any; // This should be defined based on your template structure,
  tag: string;
};

type SceneJson = ChunkJson[];

export async function callVideoGenerator(
  script: string,
  preferences: {
    subtitles: boolean;
    style: string;
    avatar: string;
    animation?: boolean;
  },
  contentClass: string,
  user_video_id: string,
  flow: string = "eleven",
  staticGen: boolean = false,
  onProgress?: (progress: number, status: string) => void,
  modelName: string = "gemini-2.0-flash-lite",
  vidGen: string = "veo"
): Promise<string> {
  // Helper to safely call progress
  const reportProgress = (p: number, s: string) => {
    if (onProgress) onProgress(p, s);
  };

  reportProgress(5, "Initializing video generation...");

  if (staticGen) {
    console.log("Static Generation Mode Enabled: Reading from debug_render_data.json");
    try {
      const fs = require('fs');
      const path = require('path');
      const debugFilePath = path.join(process.cwd(), 'data', 'debug_render_data.json');

      if (fs.existsSync(debugFilePath)) {
        const rawData = fs.readFileSync(debugFilePath, 'utf8');
        const renderParams = JSON.parse(rawData);

        console.log("Loaded render params:", JSON.stringify(renderParams, null, 2));

        reportProgress(90, "Rendering static video...");
        await renderPersonalizedVideo(renderParams);
        reportProgress(100, "Video generated successfully!");
        return `video-${renderParams.user_video_id}.mp4`;
      } else {
        console.warn("Debug file not found. Falling back to normal generation.");
      }
    } catch (err) {
      console.error("Error in static generation mode:", err);
    }
  }

  // deleteFiles([], true); // Removed to prevent deleting other users' files
  console.log("got pref, ", preferences);

  let tts_options: any;

  if (flow == "eleven") {
    tts_options = {
      text: script,
      language: getLang(preferences.avatar),
      gender: getGender(preferences.avatar),
      voiceId: preferences.avatar,
      user_video_id: user_video_id,
    };
  } else {
    // Legacy flow - keeping as fallback if needed, but updated to use same helpers
    tts_options = {
      text: script,
      language: getLang(preferences.avatar),
      gender: getGender(preferences.avatar),
      voiceId: preferences.avatar, // In new config, avatar IS the voiceId
      user_video_id: user_video_id,
    };
  }




  console.log("tts options ", tts_options);
  // let audioPath = `audio_${tts_options.user_video_id}.mp3`;
  // Output: Audio file saved at: ./bhashini-audio/user_abcd_1234.wav

  let tempFiles: string[] = [];

  let audioPath: string | null = null;
  let transcriptData: any = null;

  reportProgress(10, "Generating Audio...");

  if (flow == "eleven") {
    ({ audioPath, transcriptData } = await generateSpeechWithTranscript(
      ELEVENLABS_API_KEY,
      tts_options.voiceId,
      tts_options.text,
      `audio_${tts_options.user_video_id}.mp3`,
    )
    )
  } else {
    // 1. Text to Audio (TTS)
    audioPath = await textToSpeech(tts_options.text, {
      apiKey: AUDIO_API_KEY, // <-- Replace with your API key
      languageCode: tts_options.language,
      ssmlGender: tts_options.gender,
      fileName: `audio_${tts_options.user_video_id}.mp3`,
      name: tts_options.voiceId,
    });


    console.log("done with audioPath");
    // 2. Audio to Text (ASR with word timestamps)
    transcriptData = await speechToText(
      `audio_${tts_options.user_video_id}.mp3`,
      {
        apiKey: TRANSCRIPT_API_KEY,
        languageCode: tts_options.language
      },
      script.split(" ")
    );

  }


  tempFiles.push(audioPath);

  console.log("transcription data is ", transcriptData);

  //  saveDataAsJSON(transcriptData,"transcription.json")

  // if(tts_options.language === "hi-IN") {
  // transcriptData = convertHindiToHinglish(transcriptData)
  // // transcriptData = convertHindiToHinglish(transcriptData)
  // }

  script = "";
  for (let word of transcriptData) {
    script += word.word + " ";
  }

  console.log("script is , ", script);

  // transcriptData: { text: string; words: { word: string; startTime: number; endTime: number }[] }

  reportProgress(20, "Chunking Transcript...");

  // 3. Chunk transcript via LLM structured output
  //   const chunkingStructure = {
  //     type: "object",
  //     properties: {
  //       chunks: {
  //         type: "array",
  //         items: {
  //           type: "string",
  //         },
  //         description: `Return an array of string chunks without any spell changes from the given transcript.

  // Each chunk should be meaningful and suitable for a visual video scene.
  // Limit each chunk to a maximum of 10-15 words.
  // Strictly Do not change any spelling, punctuation, or characters from the original text — even if they are incorrect. Keep everything exactly as it appears.`,
  //       },
  //     },
  //     required: ["chunks"],
  //   };

  const chunkingStructure = {
    "type": "object",
    "properties": {
      "chunks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "chunk": {
              "type": "string",
              "description": "string chunk strictly without any spell changes even if there is any incorrect, no punctuation changes or addition  from the given transcript."
            }
          },
          "required": ["chunk"]
        },
        "description": `Return an array of string chunks without any spell changes from the given transcript.
Each chunk should be meaningful and suitable for a visual video scene.
Limit each chunk to a maximum of 10-15 words.
Strictly Do not change any spelling, punctuation, or characters from the original text — even if they are incorrect. Keep everything exactly as it appears.`,
      }
    },
    "required": ["chunks"]
  }

  // OpenAI expects structure as stringified JSON schema

  const systemPrompt = `Your only task is to divide the given transcript into meaningful visual chunks for video scenes.

Instructions:

Each chunk must contain a maximum of 10-15 words.
Do NOT modify the input in any way:
No spelling, punctuation, formatting, or word changes.
Preserve original sentence structure and wording exactly.
Do not add, remove, or rephrase anything.
Focus solely on segmenting the text into chunks that make sense visually.
Strictly Do not change any spelling, punctuation, or characters from the original text — even if they are incorrect. Keep everything exactly as it appears.
Output only the array of chunk objects. Do not include any explanations or extra text.`;
  // You are a helpful assistant that divides a transcript into meaningful chunks which can be represented with independent visual for video scenes. Return array of chunk objects with chunkText.chunk should not be more than maximum 8-10 words. Strictly make sure not to make any spelling or punctuation or any changes to given in sentence words
  // const chunkResponseStr = await callStructuredLlm(
  //   apiKey,
  //   systemPrompt,
  //   script,
  //   chunkingStructure
  // );
  const chunkResponseStr = await retryLlmCall(callStructuredLlm, [
    LLM_API_KEY,
    systemPrompt,
    `Do not change any spell even if its incorrect, no chnages in punctuation , just chunk it as per instruction nothing else,  in given script ${script}`,
    chunkingStructure,
    [], // otherPrompts
    modelName
  ]);

  console.log(chunkResponseStr);

  // Parse chunkResponseStr as JSON array
  // const chunks: [string] = JSON.parse(chunkResponseStr);
  const chunks = chunkResponseStr.chunks;

  console.log("chunks are, ", chunks);

  // saveDataAsJSON(chunks,"chunks.json")

  // Prepare Scene JSON array
  const sceneJson: SceneJson = [];

  const contextPrompt = `Summarize the context and main idea of the following script segment:\n\n${script}`;
  // const scriptContextSummary = await callLlm(apiKey, contextPrompt, contextInput);
  // const scriptContextSummary = await retryLlmCall(callLlm, [apiKey, "summzarize main context", contextPrompt]);
  const scriptContextSummary = script;

  console.log("done with scriptContextSummary ", scriptContextSummary);

  reportProgress(30, "Extracting Keywords...");
  // 4. Batch Keyword Extraction with LLM
  console.log("Starting batch keyword extraction...");

  const batchKeywordSchema = {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "index": { "type": "integer" },
            "visual_query": {
              "type": "string",
              "description": "A specific, descriptive image generation prompt or search query for the given chunk."
            },
            "google_search": {
              "type": "boolean",
              "description": "Set to true if the visual requires a real-world entity, famous person, specific location, or current event that an AI image generator might get wrong. Set to false for generic scenes, illustrations, or concepts."
            },
            "reasoning": { "type": "string" }
          },
          "required": ["index", "visual_query", "google_search", "reasoning"]
        }
      }
    },
    "required": ["results"]
  };

  const batchSystemPrompt = `You are a visual direction assistant. You will be given a list of script chunks and the overall story context.
For each chunk, generate a specific visual description (prompt) to be used for image generation or image search.
Decide whether to use Google Search (Real images/Specifics) or AI Generation (Generic/Creative).
- Use Google Search (google_search: true) for: Famous people, specific real-world locations (like Taj Mahal), complex real-world events, or when photorealism of specific entities is critical.
- Use AI Generation (google_search: false) for: Generic characters (e.g. "a boy reading"), illustrations, fantasy elements, emotions, or scenes where exact real-world fidelity isn't restrictive.

Return a JSON object with a 'results' array containing an object for each chunk.`;

  const chunksPayload = chunks.map((c: any, i: number) => ({ index: i, text: c.chunk }));

  const batchUserPrompt = `
STORY CONTEXT: "${scriptContextSummary}"

CHUNKS:
${JSON.stringify(chunksPayload, null, 2)}

Generate visual prompts with all types as animated for all chunks.


Example visual prompts are :

1
TYPE: Animated for kids explainer
Scene: Split Screen.
Left: A friendly-looking man, Mr. Gupta, busy arranging clothes in a modest retail shop.
Right: A woman, Meena, writing on a blackboard in a classroom filled with children.

2
type:animated kids explaners

Scene: A teenage boy's room.


Visual: Rahul (around 13 years old) sits comfortably in a beanbag chair surrounded by books. He is engrossed in a large book titled "World History."


`;

  let batchKeywordsData: any = {};

  try {
    const batchResponse = await retryLlmCall(callStructuredLlm, [
      LLM_API_KEY,
      batchSystemPrompt,
      batchUserPrompt,
      batchKeywordSchema,
      [], // otherPrompts
      modelName
    ]);

    if (batchResponse?.results) {
      batchResponse.results.forEach((r: any) => {
        batchKeywordsData[r.index] = r;
      });
    }
    console.log("Batch keywords generated:", batchKeywordsData);
  } catch (e) {
    console.error("Failed batch keyword extraction, falling back to chunk text", e);
  }

  // 5. Pre-process Batch Generation for AI chunks
  reportProgress(40, "Generating Visuals (Batch)...");
  console.log("Preparing batch generation requests...");
  const batchPrompts: string[] = [];
  const chunkIndicesForBatch: number[] = [];

  for (const [chunk_index, chunk] of chunks.entries()) {
    const promptData = batchKeywordsData[chunk_index] || { visual_query: chunk.chunk, google_search: false };
    if (!promptData.google_search) {
      batchPrompts.push(promptData.visual_query);
      chunkIndicesForBatch.push(chunk_index);
    }
  }

  let batchResultsMap = new Map<string, string>();
  if (batchPrompts.length > 0) {
    console.log(`Sending ${batchPrompts.length} prompts to Gemini Batch...`);
    try {
      batchResultsMap = await generateNanoBananaBatch(batchPrompts);
    } catch (e) {
      console.error("Batch generation failed completely:", e);
    }
  }

  // 6. Iterate over chunks and generate media
  const totalChunks = chunks.length;
  for (const [chunk_index, chunk] of chunks.entries()) {
    const progressPercent = 40 + Math.floor(((chunk_index) / totalChunks) * 45); // 40% to 85%
    reportProgress(progressPercent, `Generating Visuals for Scene ${chunk_index + 1}/${totalChunks}...`);

    console.log(`Processing chunk ${chunk_index}: ${chunk.chunk}`);

    const promptData = batchKeywordsData[chunk_index] || { visual_query: chunk.chunk, google_search: false };
    const keywordsStr = promptData.visual_query;
    const useGoogle = promptData.google_search;

    console.log(`Prompt: "${keywordsStr}", Google Search: ${useGoogle}`);

    let mediaPath = "";
    let selectedUrl = "";
    let generated = false;

    // Get timestamps
    let { startTime, endTime, startIndex, endIndex } = getTimestampsForPhrase(
      transcriptData,
      chunk.chunk
    );
    const chunkWords = transcriptData.slice(startIndex, endIndex + 1);

    // Generation Logic
    if (useGoogle) {
      console.log("Using Google Search...");
      try {
        // Using searchYouTubeImages which actually searches Google Custom Search for images
        const images = await searchYouTubeImages(keywordsStr + " high quality", 3);
        if (images && images.length > 0) {
          // Try downloading the first one
          for (const img of images) {
            try {
              const { path } = await downloadFile(img.imageUrl);
              mediaPath = path.replace(/^public[\\/]/, "");
              selectedUrl = img.imageUrl;
              tempFiles.push(path);
              generated = true;
              console.log("Downloaded Google Image:", mediaPath);
              break;
            } catch (err) {
              console.warn("Failed to download google image:", err);
            }
          }
        }
      } catch (err) {
        console.error("Google search failed:", err);
      }
    }

    if (!generated) {
      // Fallback chain: NanoBanana Batch Result -> Imagen4 -> Freepik -> Pexels
      console.log("Checking AI Generation (NanoBanana Batch)...");

      // 1. Nano Banana (Batch Result)
      if (batchResultsMap.has(keywordsStr)) {
        const nanoPath = batchResultsMap.get(keywordsStr);
        if (nanoPath) {
          mediaPath = nanoPath.replace(/^public[\\/]/, "");
          selectedUrl = "generated-nano-batch";
          tempFiles.push(nanoPath);
          generated = true;
          console.log("Used Batch Generated Image:", mediaPath);
        }
      } else {
        console.warn("Batch result not found for this prompt. Proceeding to fallbacks.");
      }

      // Note: We skip single-call NanoBanana because if batch failed for this specific prompt, 
      // likely single call would too or we just want to move to next provider as per fallback strategy.
      // UPDATE: User requested fallback to NanoBanana single if batch fails.

      // 1.5 Nano Banana (Single Call Fallback)
      if (!generated) {
        console.log("Fallback to NanoBanana (Single)...");
        try {
          const nanoPath = await generateNanoBananaImage(keywordsStr);
          if (nanoPath) {
            mediaPath = nanoPath.replace(/^public[\\/]/, "");
            selectedUrl = "generated-nano-single";
            tempFiles.push(nanoPath);
            generated = true;
            console.log("Generated NanoBanana (Single) Image:", mediaPath);
          }
        } catch (e) { console.error("NanoBanana (Single) failed", e); }
      }

      // 2. Imagen 4 Fallback
      if (!generated) {
        console.log("Fallback to Imagen 4...");
        try {
          const imagenPath = await generateImagen4Image(keywordsStr);
          if (imagenPath) {
            mediaPath = imagenPath.replace(/^public[\\/]/, "");
            selectedUrl = "generated-imagen4";
            tempFiles.push(imagenPath);
            generated = true;
            console.log("Generated Imagen4 Image:", mediaPath);
          }
        } catch (e) { console.error("Imagen4 failed", e); }
      }

      // 3. Freepik Fallback
      if (!generated) {
        console.log("Fallback to Freepik (Flux)...");
        try {
          const freepikUrl = await generateFreepikImage("flux-dev", keywordsStr);
          if (freepikUrl) {
            try {
              const { path } = await downloadFile(freepikUrl);
              mediaPath = path.replace(/^public[\\/]/, "");
              selectedUrl = freepikUrl;
              tempFiles.push(path);
              generated = true;
              console.log("Generated Freepik Image:", mediaPath);
            } catch (err) {
              console.warn("Freepik download failed:", err);
            }
          }
        } catch (e) { console.error("Freepik failed", e); }
      }

      // 4. Pexels Fallback
      if (!generated) {
        console.log("Fallback to Pexels...");
        try {
          const pexelsResults = await searchPexels("photo", keywordsStr, 3, "landscape");
          if (pexelsResults && pexelsResults.length > 0) {
            for (const photo of pexelsResults) {
              try {
                const url = photo.best_quality_url || photo.url;
                const { path } = await downloadFile(url);
                mediaPath = path.replace(/^public[\\/]/, "");
                selectedUrl = url;
                tempFiles.push(path);
                generated = true;
                console.log("Downloaded Pexels Image:", mediaPath);
                break;
              } catch (err) {
                console.warn("Pexels download failed:", err);
              }
            }
          }
        } catch (e) { console.error("Pexels failed", e); }
      }
    }

    if (!generated) {
      console.warn(`All generation/search methods failed for chunk: ${chunk_index}`);
    } else if (preferences.animation) {
      // ----------------------------------------------------
      // NEW VIDEO GENERATION LOGIC (Veo or Freepik)
      // vidGen parameter: "veo" (default) or "freepik"
      // ----------------------------------------------------
      console.log(`Checking if chunk ${chunk_index} should be animated with ${vidGen}...`);

      const videoDecisionSchema = {
        "type": "object",
        "properties": {
          "should_animate": {
            "type": "boolean",
            "description": "True if the scene depicts action, movement, or emotion that benefits from video. False if it's static, abstract, or better as an image."
          },
          "video_prompt": {
            "type": "string",
            "description": "A concise prompt for the video generator describing the motion. Required if should_animate is true."
          }
        },
        "required": ["should_animate"]
      };

      const videoSystemPrompt = `You are a film director deciding if a scene should be a static image or a short video clip.
Given a script chunk and an image description, decide if it should be animated.
If yes, provide a specific video generation prompt describing the movement.`;

      try {
        const decisionResponse = await retryLlmCall(callStructuredLlm, [
          LLM_API_KEY,
          videoSystemPrompt,
          `Script Chunk: "${chunk.chunk}"\nImage Prompt/Context: "${keywordsStr}"`,
          videoDecisionSchema,
          [], // otherPrompts
          modelName
        ]);

        if (decisionResponse && decisionResponse.should_animate) {
          console.log(`Animating chunk ${chunk_index} with prompt: ${decisionResponse.video_prompt}`);

          if (vidGen === "freepik") {
            // ====== FREEPIK VIDEO GENERATION ======
            console.log(`Using Freepik for chunk ${chunk_index}`);

            // Use the image we just generated/downloaded as the source
            let imageInputForVideo = "";
            if (selectedUrl.startsWith("http")) {
              imageInputForVideo = selectedUrl;
            } else {
              // It's a local file
              imageInputForVideo = "public/" + mediaPath;
            }

            console.log(`Using image source for video: ${imageInputForVideo}`);

            const videoUrl = await generateFreepikVideo(
              "hailuo-02-768p",
              decisionResponse.video_prompt || keywordsStr,
              imageInputForVideo
            );

            if (videoUrl) {
              console.log(`Freepik Video Generated: ${videoUrl}`);
              try {
                const { path: vidPath } = await downloadFile(videoUrl);

                // Update the asset to point to the video
                mediaPath = vidPath.replace(/^public[\\/]/, "");
                selectedUrl = videoUrl;
                tempFiles.push(vidPath);

                console.log(`Video downloaded to: ${mediaPath}`);
              } catch (err) {
                console.error("Failed to download Freepik video:", err);
              }
            } else {
              console.warn("Freepik video generation returned null URL.");
            }
          } else if (vidGen === "veo") {
            // ====== VEO VIDEO GENERATION ======
            console.log(`Using Veo for chunk ${chunk_index}`);

            // Prepare the image path for Veo
            // Veo expects an optional imagePath for image-to-video
            let imagePath = "";
            if (selectedUrl.startsWith("http")) {
              // For HTTP URLs, we need to download first
              try {
                const { path: downloadedPath } = await downloadFile(selectedUrl);
                imagePath = downloadedPath;
                tempFiles.push(downloadedPath);
              } catch (err) {
                console.warn("Failed to download image for Veo:", err);
              }
            } else {
              // It's a local file
              imagePath = "public/" + mediaPath;
            }

            try {
              const veoOutputPath = `veo_video_${user_video_id}_${chunk_index}.mp4`;
              console.log(`Generating Veo video with prompt: ${decisionResponse.video_prompt}`);

              // await generateVeo3FastVideo({
              //   prompt: decisionResponse.video_prompt || keywordsStr,
              //   imagePath: imagePath || undefined,
              //   outputPath: veoOutputPath
              // });


              let veoOutputName = veoOutputPath.replace(/\.mp4$/, "");


              await generateVeoVideo(
                decisionResponse.video_prompt || keywordsStr,
                veoOutputName,
                imagePath || undefined
              );
              // Move the video to public folder for consistency
              const fs = require('fs');
              const path = require('path');
              const publicVidPath = `public/${veoOutputPath}`;

              if (fs.existsSync(veoOutputPath)) {
                fs.copyFileSync(veoOutputPath, publicVidPath);
                fs.unlinkSync(veoOutputPath);
              }

              mediaPath = veoOutputPath;
              selectedUrl = publicVidPath;
              tempFiles.push(publicVidPath);

              console.log(`Veo video generated and saved to: ${publicVidPath}`);
            } catch (err) {
              console.error("Failed to generate Veo video:", err);
            }
          } else {
            console.warn(`Unknown vidGen option: ${vidGen}. Defaulting to image (no animation).`);
          }
        } else {
          console.log(`Skipping animation for chunk ${chunk_index} (LLM decided against it).`);
        }
      } catch (err) {
        console.error("Error in video decision/generation flow:", err);
      }
    }

    const templateJson = { path: mediaPath };

    // e. Compose chunkJson
    const chunkJson: ChunkJson = {
      chunkId: chunk_index,
      chunkText: chunk.chunk,
      keywords: keywordsStr,
      startTime,
      endTime,
      words: chunkWords,
      selectedUrl,
      alternateUrls: [],
      template: preferences.style,
      templateJson: templateJson,
      tag: "",
    };

    // Append chunkJson to sceneJson
    sceneJson.push(chunkJson);
  }

  console.log("sceneJson is ", sceneJson);

  let assetJson = formatSceneJsonToAssets(sceneJson);
  transcriptData = convertSceneToAsset(transcriptData);

  console.log("assetJson is ", JSON.stringify(assetJson, null, 2));

  // let transcriptData = [
  // { "word": "have", "start": 0.0, "end": 0.2 },
  // { "word": "you", "start": 0.2, "end": 0.2 },
  // { "word": "ever", "start": 0.2, "end": 0.5 },
  // { "word": "wondered","start": 0.5, "end": 0.9 },
  // { "word": "how", "start": 0.9, "end": 1.3 },
  // { "word": "some", "start": 1.3, "end": 1.9 },
  // { "word": "Indian", "start": 1.9, "end": 2.2 },
  // { "word": "villages","start": 2.2, "end": 2.7 }
  // ]
  //   let assetJson = [
  //   {
  //     "path": "20691359-uhd_3840_2160_30fps.mp4",
  //     "type": "video",
  //     "start": 0,
  //     "end": 0.9
  //   },
  //   {
  //     "path": "pexels-photo-21363814.jpeg",
  //     "type": "image",
  //     "start": 0.9,
  //     "end": 2.7
  //   }
  // ]

  for (let a in assetJson) {
    console.log("asset is : ", assetJson[a].path);
    if (assetJson[a].type === "video") {
      let tempPath = fixIfBrokenVideo("public/" + assetJson[a].path);
      //assetJson[a].path = fixIfBrokenVideo(assetJson[a].path)
      tempFiles.push(tempPath);
      assetJson[a].path = tempPath.replace(/^public[\\/]/, "");
    }

  }

  if (audioPath != null) {
    console.log("last end is ", assetJson[assetJson.length - 1].end);
    assetJson[assetJson.length - 1].end = await getAudioDuration(audioPath);
    console.log("audio duration is ", assetJson[assetJson.length - 1].end);
  }

  // 5. Call video creator API with sceneJson and audioPath
  reportProgress(90, "Rendering Final Video...");
  // const finalVideoPath = await renderPersonalizedVideo({
  // user_video_id: tts_options.user_video_id,
  // words: transcriptData,
  // assets: assetJson,
  // options: {
  //   wordsPerLine: 3,
  //     subtitleStyle: {
  //       fontSize: 60,
  //       highlightColor: "#FF0",
  //       normalColor: "#FFF"
  //     },
  //   logoUrl: "https://cdn.pixabay.com/photo/2019/11/23/10/31/sea-of-clouds-4646744_1280.jpg",
  //   audioUrl: "audio_" + tts_options.user_video_id + ".mp3",
  // }
  // );

  // Save render params for debugging/static mode
  const renderParams = {
    user_video_id: tts_options.user_video_id,
    chunks: sceneJson,
    words: transcriptData,
    assets: assetJson,
    options: {
      subtitles: preferences.subtitles,
      wordsPerLine: 3,
      subtitleStyle: {
        fontSize: 60,
        highlightColor: "#FF0",
        normalColor: "#FFF",
      },
      logoUrl: "logo.png",
      audioUrl: "../audio_" + tts_options.user_video_id + ".mp3",
    },
  };

  saveDataAsJSON(renderParams, "debug_render_data.json");

  await renderPersonalizedVideo(renderParams);
  let finalVideoPath = `video-${tts_options.user_video_id}.mp4`;

  // let finalVideoPath = "";
  // 6. Render the final video using Revideo renderer
  // const words = [
  //   { word: "Hello", start: 0, end: 1 },
  //   { word: "world", start: 1, end: 2 }
  // ];
  // const assets = [
  //   { path: "test_video.mp4", type: "video", start: 0, end: 10 }
  // ];
  // const options = {}

  // const finalVideoPath = await fetch("/api/render-video", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ words, assets, options })
  // });
  deleteFiles(tempFiles);
  return finalVideoPath;
}

// async function callAssetSearch(chunkText: string): Promise<{ selectedUrl: string; alternateUrls: string[] }> {
//   // TODO: Call asset search API to find video/image URLs for chunkText
//   console.log("Searching assets for:", chunkText);
//   await delay(1000);
//   return {
//     selectedUrl: "https://example.com/asset1.mp4",
//     alternateUrls: ["https://example.com/asset2.mp4", "https://example.com/asset3.mp4"],
//   };
// }

// async function callVideoCreator(
//   sceneJson:any,
//   audioPath:string,
//   preferences:any
// ): Promise<string> {
//   if(preferences.style == "slideshow") {
//     // callSlideshowCreator(sceneJson, audioPath);
//   }
//   // TODO: Call your video creation API with scene JSON + audio path
//   console.log("Calling Video Creator API");
//   await delay(2000);
//   return "/path/to/final/generated/video.mp4";
// }

// import path from 'path';
// import { renderAutoFittedMedia } from '@/revideo/renderAutoFittedMedia';

// async function callVideoCreator(
//   sceneJson: any,
//   audioPath: string,
//   preferences: any
// ): Promise<string> {
//   const inputFile = preferences.inputFile || sceneJson.inputPath;
//   const orientation = preferences.orientation || 'portrait';
//   const type = preferences.type || 'image';
//   const duration = preferences.duration || 5;

//   const inputPath = path.resolve(`revideo/input/${inputFile}`);

//   const outputPath = await renderAutoFittedMedia({
//     inputPath,
//     filename: inputFile,
//     orientation,
//     type,
//     duration,
//     backgroundColor: preferences.backgroundColor || '#000',
//   });

//   return outputPath;
// }

// Example call for callVideoGenerator

// Imagine, zombies are everywhere, and you are a superhero who can eliminate them just by tapping!
// Our objective today is to kill the zombie. Your game will look something like this:
// Zombies will pop up in front of you, and you will tap on them to make them disappear.
// Sounds fun, right?
// Through this project, you will learn how critical thinking and problem-solving skills are applied in the real world.
// Just like in the game, where zombies pop up and you tap them to make them disappear, in real life, you need to ""tap"" away unhealthy habits and negative thoughts — meaning, get rid of them — so you don't become a zombie yourself.
// So, take care of yourself, stay active, eat healthy, think positive, and always be ready to ""tap"" away real-life zombies!
// This skill will be very helpful to you in life, because every day we face new challenges that we need to solve.

// (async () => {
//   try {
//     const script = `
// Imagine you have ₹100 and need to buy either a notebook or a toy. But you can only buy one.
// What would you choose?
// `;
//     const preferences = {
//       subtitles: true,
//       style: "slideshow",
//       voiceover: "en-US-Wavenet-C",

//     };
//     const contentClass = "educational";
//     const user_video_id = "test_2_demo_1_US_EN_6_generated_agaib";

//     const result = await callVideoGenerator(
//       script,
//       preferences,
//       contentClass,
//       user_video_id
//     );

//     console.log("Video Generator result:", result);
//   } catch (error) {
//     console.error("Error calling callVideoGenerator:", error);
//   }
// })();

// The Solar System is made up of the Sun and all the objects that orbit around it, including eight planets. Earth is the third planet from the Sun and the only known planet to support life.

//     Main hoon Suraj aasmaan ka sabse bada taara Meri gravity pure solar system ko saath rakhti hai
// Main hoon Jupiter Main solar system ka sabse bada planet hoon
// Main hoon Saturn aur mujhe mere khoobsurat rings se pehchana jaata hai

// Main hoon Mars Mere laal rang ki wajah se mujhe red planet bhi kehte hain Scientists ka maanna hai ki bhavishya mein insaan mujh par reh sakte hain Soooo exciting na

// Ab chaliye hello kehte hain Dharti ko Lekin rukko ye kya Dharti to udaas lag rahi hai

// Oh no Dharti tum itni udaas kyun ho

// Main bahut udaas hoon kyunki log mera khayal nahi rakh rahe

// Yeh to bahut bura hai Lekin hum aapki madad kar sakte hain Hai na Humein logo ko yeh batana hoga aur sochne par majboor karna hoga ke wo Dharti ka kaise accha dhyan rakh sakte hain

// Haan lekin tum mera yeh sandesh sab tak kaise pahunchaogi

// Arey! Earth aur Saturn toh Sun se bhi chhote lag rahe hain! (fun fact — kya aapko pata hai ke Sun is 109 times wider than Earth aur Saturn is 9.5 times bigger than Earth?) Ab ise kaise fix karein? Inhe aise click karne se to kuchh nahi ho raha!
// Yahan humari madad karenge ‘Look’ category ke blocks! Scratch Jr. mein, hum characters ka size bada ya chota karne ke liye in purple blocks ka use karte hain. Is category ko ‘Looks’ kehte hain. Isse hum apne characters ke looks change kar sakte hain — jaise unki sizes, unko chhupana, dikhana, ya dialogues add karna.
// Ab Sun ka size badhane ke liye pehle Sun pe click karenge, fir looks category mein jaake ‘grow’ block dhundhenge. Ye blocks thode same lag rahe hain. Click karne se hum unke names dekhte hain. Usse white programming area mein drag karenge aur tap karenge — aur Sun ka size badhne lagega. Isse fir se tap karte hai - haan ab ye perfect lag raha hai! Ab poore project me Sun ka size yahi rahega - toh humne iss grow block ki zaroorat nahi hai, to hum usse programming area se aise nikalke delete kar sakte hain.
// Aise hi hum Saturn ka size bhi badhaenge.(repeat)

// Ab baari hai Earth ko chhota karne ki, toh hum shrink block use karenge. Ye raha, ab ise aise drag karte hain aur tap karte hain. Well done!
// Ab hum in characters mein thoda action aur life add karte hai. Earth pehle cough karta hai, phir ek baari hide hoke wapis dikhai deta hai, aur bolta hai ‘Help! Save me!’
// Iske liye hum use karenge ‘say’ blocks aur usmein dialogues type karenge. In dono say blocks ke beech mein hum ‘hide’ aur ‘show’ blocks bhi add karenge to give a coughing effect.
// Ab ye green flag press karne par hum chahte hain ki code apne aap run ho. Iske liye hum ye yellow block category se start on green flag ka block use karenge. Is category ke blocks character ko batate hain ki kab start karna hai. Ise lagate hain in dono blocks ke aage. Aur humara code end karne ke liye hum lagate hain red color se ye END block.
// Ye blocks train ke dibbon ki tarhan hain. Starting me use hote hain yellow category ke blocks, last me red, and middle mein baaki color ke blocks. Inko hum jab saath mein lagate hain tab humara code work karta hai.
// Ab Saturn ko code karte hain. Saturn thoda grow aur shrink hota hai, fir wo bolta hai ‘Hey Earth, are you ok?.’ Blocks pe click kar ke dekhte hain. Ab upar iss green flag par click karte hain. Are Saturn to Green flag se start hi nahi hua? Something is missing na! Hmm, iska matlab hume Saturn ke code ke liye bhi start on green flag ka yellow block lagana padega! Aur aise hi lagate hain end block. There you go! Now it’s working perfectly!
// Lastly, hum apne project ke liye ek title add karenge. Us ke liye,iss  ABC icon pe click karenge, aur type karenge ‘Outer Space’. Iska size thoda bada lag raha hai, toh mai size chhota karungi, aur iska color bhi change kar sakti hoon to any of these color options.
// Aur bus, our project is ready! Chalo isse full screen pe dekhte hain — uske liye left side pe icon pe click karna hoga! There you go! Kitna sundar lag raha hai ye, what do you think?"

// output1
// Our objective today is to kill the zombie. Your game will look something like this:
// Sounds fun, right?
// Through this project, you will learn how critical thinking and problem-solving skills are applied in the real world.
// Just like in the game, where zombies pop up and you tap them to make them disappear, in real life, you need to ""tap"" away unhealthy habits and negative thoughts — meaning, get rid of them — so you don't become a zombie yourself.
// So, take care of yourself, stay active, eat healthy, think positive, and always be ready to ""tap"" away real-life zombies!
