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
};

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

  if (flow === "eleven") {
    ({ audioPath, transcriptData } = await generateSpeechWithTranscript(
      ELEVENLABS_API_KEY,
      ttsOptions.voiceId,
      ttsOptions.text,
      `audio_${ttsOptions.user_video_id}.wav`
    ));
  } else {
    audioPath = await textToSpeech(ttsOptions.text, {
      apiKey: AUDIO_API_KEY,
      languageCode: ttsOptions.language,
      ssmlGender: ttsOptions.gender,
      fileName: `audio_${ttsOptions.user_video_id}.wav`,
      name: ttsOptions.voiceId,
    });

    transcriptData = await speechToText(
      `audio_${ttsOptions.user_video_id}.wav`,
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
    `Do not change any spell even if its incorrect, no chnages in punctuation, just chunk it as per instruction nothing else, in given script ${script}`,
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
  modelName: string
) {
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
For each chunk, generate a specific visual description (prompt) to be used for image generation or image search.
Decide whether to use Google Search (Real images/Specifics) or AI Generation (Generic/Creative).
- Use Google Search (google_search: true) for: Famous people, specific real-world locations, complex real-world events, or when photorealism of specific entities is critical.
- Use AI Generation (google_search: false) for: Generic characters, illustrations, fantasy elements, emotions, or scenes where exact real-world fidelity isn't restrictive.

Return a JSON object with a 'results' array containing an object for each chunk.`;

  const chunksPayload = chunks.map((c, i) => ({ index: i, text: c.chunk }));
  const batchUserPrompt = `
STORY CONTEXT: "${scriptContextSummary}"

CHUNKS:
${JSON.stringify(chunksPayload, null, 2)}

Generate visual prompts with all types as animated for all chunks.
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
        promptMap[result.index] = result;
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
  let mediaPath = "";
  let selectedUrl = "";
  let generated = false;

  if (useGoogle) {
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
    const nanoPath = batchResultsMap.get(prompt);
    if (nanoPath) {
      mediaPath = nanoPath.replace(/^public[\\/]/, "");
      selectedUrl = "generated-nano-batch";
      generated = true;
    }
  }

  if (!generated) {
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
  return generateReviewImageAsset(input.prompt, input.useGoogle);
}

export async function refreshReviewPromptsForChunks(input: {
  script: string;
  items: Pick<ReviewPlanItem, "chunkId" | "chunkText" | "startTime" | "endTime" | "words" | "mediaPath" | "previewUrl" | "selectedUrl" | "prompt" | "useGoogle" | "reasoning">[];
  changedChunkIds: number[];
  modelName?: string;
}) {
  const { script, items, changedChunkIds, modelName = "gemini-2.0-flash-lite" } = input;

  const changedIdSet = new Set(changedChunkIds);
  const changedEntries = items.filter((item) => changedIdSet.has(item.chunkId));
  if (changedEntries.length === 0) {
    return [] as ReviewPlanItem[];
  }

  const chunks = changedEntries.map((item) => ({ chunk: item.chunkText }));
  const promptMap = await buildPromptSuggestions(chunks, script, modelName);

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
  if (batchPrompts.length > 0) {
    try {
      batchResultsMap = await generateNanoBananaBatch(batchPrompts);
    } catch (error) {
      console.error("Batch preview generation failed:", error);
    }
  }

  const updatedItems: ReviewPlanItem[] = [];
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
}) {
  const {
    script,
    preferences,
    user_video_id,
    flow = "eleven",
    modelName = "gemini-2.0-flash-lite",
    chunkingMaxWords = 15,
    manualChunks,
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

  const shouldPreparePrompts = Boolean(preferences.reviewPrompts);
  const promptMap = shouldPreparePrompts
    ? await buildPromptSuggestions(chunks, normalizedScript, modelName)
    : {};

  const batchPrompts: string[] = [];
  if (shouldPreparePrompts) {
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
  }

  let batchResultsMap = new Map<string, string>();
  if (batchPrompts.length > 0) {
    try {
      batchResultsMap = await generateNanoBananaBatch(batchPrompts);
    } catch (error) {
      console.error("Batch preview generation failed:", error);
    }
  }

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

    const asset = shouldPreparePrompts
      ? await generateReviewImageAsset(
          promptData.visual_query,
          promptData.google_search,
          batchResultsMap
        )
      : { mediaPath: "", selectedUrl: "", previewUrl: "" };

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
