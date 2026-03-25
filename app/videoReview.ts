import { callStructuredLlm } from "./llm";
import { downloadFile } from "./utils/downloadAsset";
import { speechToText } from "./utils/speechToText";
import { textToSpeech, generateSpeechWithTranscript } from "./utils/audioUtils";
import { getTimestampsForPhrase } from "./utils/utils";
import { generateFreepikImage } from "./mediaApis/freepik";
import { generateNanoBananaImage, generateNanoBananaBatch } from "./mediaApis/nanoBanana";
import { generateImagen4Image } from "./mediaApis/imagegen4";
import { searchPexels } from "./mediaApis/pexels";
import { searchYouTubeImages } from "./mediaApis/googleSearch";
import data from "../dynamication.json";
import path from "path";
import {
  AUDIO_API_KEY,
  LLM_API_KEY,
  TRANSCRIPT_API_KEY,
  ELEVENLABS_API_KEY,
} from "./constant";

export type ReviewPreferences = {
  subtitles: boolean;
  style: string;
  avatar: string;
  animation?: boolean;
  reviewChunks?: boolean;
  reviewPrompts?: boolean;
  visualReviewMode?: 'full' | 'prompts_only';
};

// Reverting to simple style appending logic as per user request
function appendStyleToPrompt(prompt: string, style: string): string {
  if (!style || style.trim().length === 0) return prompt;
  const lowerPrompt = prompt.toLowerCase();
  const cleanStyle = style.trim();
  const lowerStyle = cleanStyle.toLowerCase();
  
  // If the prompt already contains the style name, assume it's integrated
  const styleBase = lowerStyle.endsWith(" style") 
    ? lowerStyle.substring(0, lowerStyle.length - 6).trim() 
    : lowerStyle;
  
  if (lowerPrompt.includes(styleBase)) return prompt;
  
  // Predictably append style, ensuring we don't double the word "style"
  const finalStyleSuffix = lowerStyle.endsWith(" style") ? cleanStyle : `${cleanStyle} style`;
  return `${prompt.trim()}, ${finalStyleSuffix}`;
}

export type ReviewPlanItem = {
  chunkId: number;
  chunkText: string;
  prompt: string;
  useGoogle: boolean;
  reasoning: string;
  startTime: number;
  endTime: number;
  words: { word: string; startTime: number; endTime: number }[];
  mediaPath: string;
  previewUrl: string;
  selectedUrl: string;
};

export type ReviewWord = {
  word: string;
  startTime: number;
  endTime: number;
};

export type ReviewPlanData = {
  userVideoId: string;
  chunkingMaxWords: number;
  script: string;
  transcriptWords: ReviewWord[];
  items: ReviewPlanItem[];
};

async function retryLlmCall<T>(
  fn: (...args: any[]) => Promise<T>,
  args: any[],
  retries = 5,
  delayMs = 10000
): Promise<T> {
  const modelArgIndex = args.length - 1;
  if (typeof args[modelArgIndex] !== "string" || args[modelArgIndex] === "") {
    args[modelArgIndex] = "gemini-2.0-flash-lite";
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await fn(...args);
    } catch (err: any) {
      const errorMsg = err?.message || err?.toString() || "Unknown error";
      console.warn(`Attempt ${i + 1} failed: ${errorMsg}`);

      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw new Error(`LLM Call failed after ${retries} attempts. Last error: ${errorMsg}`);
      }
    }
  }

  throw new Error("Unexpected end of retry loop");
}

function getAvatarDetails(voiceId: string) {
  const avatar = data.avatars.find((a) => a.value === voiceId);
  return avatar || { languageCode: "en-US", gender: "FEMALE" };
}

function getLang(voice: string): string {
  return getAvatarDetails(voice).languageCode;
}

function getGender(voice: string): string {
  return getAvatarDetails(voice).gender;
}

function buildChunkingSchema(maxWordsPerChunk: number) {
  return {
    type: "object",
    properties: {
      chunks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            chunk: {
              type: "string",
              description: "string chunk strictly without any spell changes even if there is any incorrect, no punctuation changes or addition from the given transcript.",
            },
          },
          required: ["chunk"],
        },
        description: `Return an array of string chunks without any spell changes from the given transcript.
Each chunk should be meaningful and suitable for a visual video scene.
Limit each chunk to a maximum of ${maxWordsPerChunk} words.
Strictly Do not change any spelling, punctuation, or characters from the original text even if they are incorrect. Keep everything exactly as it appears.`,
      },
    },
    required: ["chunks"],
  };
}

async function createAudioAndTranscript(
  script: string,
  preferences: ReviewPreferences,
  user_video_id: string,
  flow: string
) {
  const ttsOptions = {
    text: script,
    language: getLang(preferences.avatar),
    gender: getGender(preferences.avatar),
    voiceId: preferences.avatar,
    user_video_id,
  };

  let audioPath: string | null = null;
  let transcriptData: any = null;
  const audioFilePath = path.join("public", `audio_${ttsOptions.user_video_id}.wav`);

  if (flow === "eleven") {
    ({ audioPath, transcriptData } = await generateSpeechWithTranscript(
      ELEVENLABS_API_KEY,
      ttsOptions.voiceId,
      ttsOptions.text,
      audioFilePath
    ));
  } else {
    audioPath = await textToSpeech(ttsOptions.text, {
      apiKey: AUDIO_API_KEY,
      languageCode: ttsOptions.language,
      ssmlGender: ttsOptions.gender,
      fileName: audioFilePath,
      name: ttsOptions.voiceId,
    });

    transcriptData = await speechToText(
      audioFilePath,
      {
        apiKey: TRANSCRIPT_API_KEY,
        languageCode: ttsOptions.language,
      },
      script.split(" ")
    );
  }

  let normalizedScript = "";
  for (const word of transcriptData) {
    normalizedScript += word.word + " ";
  }

  return {
    audioPath,
    transcriptData,
    normalizedScript: normalizedScript.trim(),
  };
}

async function buildChunks(
  script: string,
  transcriptData: any[],
  modelName: string,
  maxWordsPerChunk: number,
  manualChunks?: string[]
) {
  if (manualChunks && manualChunks.length > 0) {
    return manualChunks
      .map((chunk) => ({ chunk: chunk.trim() }))
      .filter((chunk) => chunk.chunk.length > 0);
  }

  const systemPrompt = `Your only task is to divide the given transcript into meaningful visual chunks for video scenes.

Instructions:

Each chunk must contain a maximum of ${maxWordsPerChunk} words.
Do NOT modify the input in any way:
No spelling, punctuation, formatting, or word changes.
Preserve original sentence structure and wording exactly.
Do not add, remove, or rephrase anything.
Focus solely on segmenting the text into chunks that make sense visually.
Strictly Do not change any spelling, punctuation, or characters from the original text even if they are incorrect. Keep everything exactly as it appears.
Output only the array of chunk objects. Do not include any explanations or extra text.`;

  const response = await retryLlmCall(callStructuredLlm, [
    LLM_API_KEY,
    systemPrompt,
    `TRANSCRIPT TO CHUNK:\n"""\n${script}\n"""\n\nInstruction: Chunk the transcript above exactly. Do NOT include any instructions or context in the chunks themselves.`,
    buildChunkingSchema(maxWordsPerChunk),
    [],
    modelName,
  ]);

  if (!response || !response.chunks) {
    throw new Error("Failed to chunk transcript via LLM.");
  }

  return response.chunks;
}

async function buildPromptSuggestions(
  chunks: { chunk: string }[],
  scriptContextSummary: string,
  modelName: string,
  visualTheme: string = "animated for kids explainer"
) {
  const resolvedVisualTheme = visualTheme?.trim() || "animated for kids explainer";
  const batchKeywordSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            visual_query: { type: "string" },
            google_search: { type: "boolean" },
            reasoning: { type: "string" },
          },
          required: ["index", "visual_query", "google_search", "reasoning"],
        },
      },
    },
    required: ["results"],
  };

  const batchSystemPrompt = `You are a visual direction assistant. You will be given a list of script chunks and the overall story context.
From this script, we want an image prompt for each chunk, and this should be in the style of "${resolvedVisualTheme}".

Instructions:
1. VERY IMPORTANT: All chunks are part of the SAME continuous story. Use the STORY CONTEXT to understand the characters, setting, and plot.
2. For each chunk, generate a specific, descriptive visual prompt. The image generator does not know the story, so you MUST describe the subjects fully in EVERY prompt. DO NOT use pronouns like "he", "she", or "it". Instead of "He looks under the bed", write "A young boy looks under the bed".
3. Maintain visual continuity. If the story is about a "red dragon", ensure "red dragon" is described in the prompt for any chunk where the dragon is visible.
4. Decide whether to use Google Search (Real images/Specifics) or AI Generation (Generic/Creative).
- Use Google Search (google_search: true) for: Famous people, specific real-world locations, complex real-world events.
- Use AI Generation (google_search: false) for: Generic characters, illustrations, fantasy, or general scenes.
5. STRICT RULES FOR VISUAL PROMPT TEXT: DO NOT include conversational filler like "Here is the prompt" and DO NOT use markdown symbols like * or - in the text. Output plain descriptions only.

Return a JSON object with a 'results' array containing an object for each chunk.`;

  const chunksPayload = chunks.map((c, i) => ({ index: i, text: c.chunk }));
  const batchUserPrompt = `
FULL SCRIPT CONTEXT:
"""
${scriptContextSummary}
"""

VISUAL THEME: "${resolvedVisualTheme}"

CHUNKS TO PROCESS:
${JSON.stringify(chunksPayload, null, 2)}

Action: From the story context above, generate an image prompt for each chunk in the style of "${resolvedVisualTheme}". Ensure every prompt has enough context to stand alone (replace pronouns with character descriptions based on the story).
`;

  const promptMap: Record<number, { visual_query: string; google_search: boolean; reasoning: string }> = {};

  try {
    const batchResponse = await retryLlmCall(callStructuredLlm, [
      LLM_API_KEY,
      batchSystemPrompt,
      batchUserPrompt,
      batchKeywordSchema,
      [],
      modelName,
    ]);

    if (batchResponse?.results) {
      batchResponse.results.forEach((result: any) => {
        // Appending the visual style manually as per user request
        let cleanQuery = result.visual_query || "";
        // Remove conversational filler and markdown
        cleanQuery = cleanQuery.replace(/here is the prompt[\s\w:]*/i, '')
                               .replace(/here is a prompt[\s\w:]*/i, '')
                               .replace(/^[*\s-]+/gm, '')
                               .replace(/[-\*\_]/g, ' ')
                               .trim();

        const finalPrompt = appendStyleToPrompt(cleanQuery, resolvedVisualTheme);
        promptMap[result.index] = {
          ...result,
          visual_query: finalPrompt
        };
      });
    }
  } catch (error) {
    console.error("Failed batch keyword extraction, falling back to chunk text", error);
  }

  return promptMap;
}

async function generateReviewImageAsset(
  prompt: string,
  useGoogle: boolean,
  batchResultsMap?: Map<string, string>
) {
  console.log(`[videoReview] generateReviewImageAsset start | prompt="${prompt}" | useGoogle=${useGoogle} | hasBatchMap=${Boolean(batchResultsMap?.size)}`);
  let mediaPath = "";
  let selectedUrl = "";
  let generated = false;

  if (useGoogle) {
    console.log(`[videoReview] Provider path: google-search for prompt="${prompt}"`);
    try {
      const images = await searchYouTubeImages(prompt + " high quality", 3);
      if (images && images.length > 0) {
        for (const img of images) {
          try {
            const { path } = await downloadFile(img.imageUrl);
            mediaPath = path.replace(/^public[\\/]/, "");
            selectedUrl = img.imageUrl;
            generated = true;
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

  if (!generated && batchResultsMap?.has(prompt)) {
    console.log(`[videoReview] Provider path: nano-batch hit for prompt="${prompt}"`);
    const nanoPath = batchResultsMap.get(prompt);
    if (nanoPath) {
      mediaPath = nanoPath.replace(/^public[\\/]/, "");
      selectedUrl = "generated-nano-batch";
      generated = true;
    }
  }

  if (!generated) {
    console.log(`[videoReview] Provider fallback: nano-single for prompt="${prompt}"`);
    try {
      const nanoPath = await generateNanoBananaImage(prompt);
      if (nanoPath) {
        mediaPath = nanoPath.replace(/^public[\\/]/, "");
        selectedUrl = "generated-nano-single";
        generated = true;
      }
    } catch (e) {
      console.error("NanoBanana (Single) failed", e);
    }
  }

  if (!generated) {
    console.log(`[videoReview] Provider fallback: imagen4 for prompt="${prompt}"`);
    try {
      const imagenPath = await generateImagen4Image(prompt);
      if (imagenPath) {
        mediaPath = imagenPath.replace(/^public[\\/]/, "");
        selectedUrl = "generated-imagen4";
        generated = true;
      }
    } catch (e) {
      console.error("Imagen4 failed", e);
    }
  }

  if (!generated) {
    console.log(`[videoReview] Provider fallback: freepik for prompt="${prompt}"`);
    try {
      const freepikUrl = await generateFreepikImage("flux-dev", prompt);
      if (freepikUrl) {
        const { path } = await downloadFile(freepikUrl);
        mediaPath = path.replace(/^public[\\/]/, "");
        selectedUrl = freepikUrl;
        generated = true;
      }
    } catch (e) {
      console.error("Freepik failed", e);
    }
  }

  if (!generated) {
    console.log(`[videoReview] Provider fallback: pexels for prompt="${prompt}"`);
    try {
      const pexelsResults = await searchPexels("photo", prompt, 3, "landscape");
      if (pexelsResults && pexelsResults.length > 0) {
        for (const photo of pexelsResults) {
          try {
            const url = photo.best_quality_url || photo.url;
            const { path } = await downloadFile(url);
            mediaPath = path.replace(/^public[\\/]/, "");
            selectedUrl = url;
            generated = true;
            break;
          } catch (err) {
            console.warn("Pexels download failed:", err);
          }
        }
      }
    } catch (e) {
      console.error("Pexels failed", e);
    }
  }

  return {
    mediaPath,
    selectedUrl,
    previewUrl: mediaPath ? `/${mediaPath.replace(/^\/+/, "")}` : "",
  };
}

export async function regenerateReviewImageForChunk(input: {
  prompt: string;
  useGoogle: boolean;
}) {
  console.log(`[videoReview] regenerateReviewImageForChunk | prompt="${input.prompt}" | useGoogle=${input.useGoogle}`);
  return generateReviewImageAsset(input.prompt, input.useGoogle);
}

export async function refreshReviewPromptsForChunks(input: {
  script: string;
  items: Pick<ReviewPlanItem, "chunkId" | "chunkText" | "startTime" | "endTime" | "words" | "mediaPath" | "previewUrl" | "selectedUrl" | "prompt" | "useGoogle" | "reasoning">[];
  changedChunkIds: number[];
  modelName?: string;
  visualTheme?: string;
  promptsOnly?: boolean;
}) {
  const { script, items, changedChunkIds, modelName = "gemini-2.0-flash-lite", visualTheme = "", promptsOnly = false } = input;
  console.log(`[videoReview] refreshReviewPromptsForChunks start | changed=${changedChunkIds.length} | totalItems=${items.length} | promptsOnly=${promptsOnly} | visualTheme="${visualTheme}"`);

  const changedIdSet = new Set(changedChunkIds);
  const changedEntries = items.filter((item) => changedIdSet.has(item.chunkId));
  if (changedEntries.length === 0) {
    return [] as ReviewPlanItem[];
  }

  const chunks = changedEntries.map((item) => ({ chunk: item.chunkText }));
  const promptMap = await buildPromptSuggestions(chunks, script, modelName, visualTheme);

  const updatedItems: ReviewPlanItem[] = [];

  if (promptsOnly) {
    // Fast path: only return prompts, no image generation
    for (const [index, item] of changedEntries.entries()) {
      const promptData = promptMap[index] || {
        visual_query: item.chunkText,
        google_search: false,
        reasoning: "",
      };
      updatedItems.push({
        ...item,
        prompt: promptData.visual_query,
        useGoogle: promptData.google_search,
        reasoning: promptData.reasoning || "",
        mediaPath: "",
        previewUrl: "",
        selectedUrl: "",
      });
    }
  } else {
    // Full path: generate images too
    const batchPrompts: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const promptData = promptMap[index] || {
        visual_query: chunk.chunk,
        google_search: false,
        reasoning: "",
      };
      if (!promptData.google_search) {
        batchPrompts.push(promptData.visual_query);
      }
    }

    let batchResultsMap = new Map<string, string>();
    const shouldUseBatch = changedEntries.length > 2 && batchPrompts.length > 0;
    if (shouldUseBatch) {
      console.log(`[videoReview] Preview batch request | prompts=${batchPrompts.length} | changedEntries=${changedEntries.length}`);
      try {
        batchResultsMap = await generateNanoBananaBatch(batchPrompts);
        console.log(`[videoReview] Preview batch response | results=${batchResultsMap.size}`);
      } catch (error) {
        console.error("Batch preview generation failed:", error);
      }
    } else if (batchPrompts.length > 0) {
      console.log(`[videoReview] Skipping preview batch because changedEntries=${changedEntries.length}. Using nano single + fallbacks.`);
    }

    for (const [index, item] of changedEntries.entries()) {
      const promptData = promptMap[index] || {
        visual_query: item.chunkText,
        google_search: false,
        reasoning: "",
      };

      const asset = await generateReviewImageAsset(
        promptData.visual_query,
        promptData.google_search,
        batchResultsMap
      );
      console.log(`[videoReview] Preview asset resolved | chunkId=${item.chunkId} | mediaPath="${asset.mediaPath}" | selectedUrl="${asset.selectedUrl}"`);

      updatedItems.push({
        ...item,
        prompt: promptData.visual_query,
        useGoogle: promptData.google_search,
        reasoning: promptData.reasoning || "",
        mediaPath: asset.mediaPath,
        previewUrl: asset.previewUrl,
        selectedUrl: asset.selectedUrl,
      });
    }
  }

  return updatedItems;
}

export async function prepareVideoReviewData(input: {
  script: string;
  preferences: ReviewPreferences;
  contentClass: string;
  user_video_id: string;
  flow?: string;
  modelName?: string;
  chunkingMaxWords?: number;
  manualChunks?: string[];
  visualTheme?: string;
}) {
  const {
    script,
    preferences,
    user_video_id,
    flow = "eleven",
    modelName = "gemini-2.0-flash-lite",
    chunkingMaxWords = 15,
    manualChunks,
    visualTheme: visualThemeInput = "",
  } = input;

  const { transcriptData, normalizedScript } = await createAudioAndTranscript(
    script,
    preferences,
    user_video_id,
    flow
  );

  const chunks = await buildChunks(
    normalizedScript,
    transcriptData,
    modelName,
    chunkingMaxWords,
    manualChunks
  );

  // Sequential Logic: Skip initial prompt generation if user is reviewing chunks first
  const shouldPreparePrompts = Boolean(preferences.reviewPrompts) && !Boolean(preferences.reviewChunks);
  const visualTheme = visualThemeInput?.trim() || "animated for kids explainer";
  
  const promptMap = shouldPreparePrompts
    ? await buildPromptSuggestions(chunks, normalizedScript, modelName, visualTheme)
    : {};

  // Skip batch image generation and polling internally to avoid Gateway Timeout.
  // Images are now loaded lazily by the frontend via /api/review-image.
  const batchResultsMap = new Map<string, string>();

  let lastEndIndex = 0;
  const items: ReviewPlanItem[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const promptData = promptMap[chunkIndex] || {
      visual_query: chunk.chunk,
      google_search: false,
      reasoning: "",
    };

    const { startTime, endTime, startIndex, endIndex } = getTimestampsForPhrase(
      transcriptData,
      chunk.chunk,
      lastEndIndex
    );
    lastEndIndex = endIndex + 1;

    // DEFERRED: Skip image generation to avoid Gateway Timeout.
    // Frontend will trigger generation for chunks lazily.
    const asset = { mediaPath: "", selectedUrl: "", previewUrl: "" };

    items.push({
      chunkId: chunkIndex,
      chunkText: chunk.chunk,
      prompt: promptData.visual_query,
      useGoogle: promptData.google_search,
      reasoning: promptData.reasoning || "",
      startTime,
      endTime,
      words: transcriptData.slice(startIndex, endIndex + 1),
      mediaPath: asset.mediaPath,
      previewUrl: asset.previewUrl,
      selectedUrl: asset.selectedUrl,
    });
  }

  return {
    userVideoId: user_video_id,
    chunkingMaxWords,
    script: normalizedScript,
    transcriptWords: transcriptData,
    items,
  } satisfies ReviewPlanData;
}
