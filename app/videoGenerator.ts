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
import { textToSpeech } from "./utils/audioUtils";
import { renderPersonalizedVideo } from "../revideo/render";
import Sanscript from "@indic-transliteration/sanscript";
import { getAudioDuration } from "./utils/utils";

import { deleteFiles } from "./utils/utils";
import { generateFreepikAI } from "./mediaApis/freepik";


import { AUDIO_API_KEY, LLM_API_KEY, TRANSCRIPT_API_KEY } from "./constant";

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

function getLang(voice: string): string {
  console.log("voice ", voice)
  switch (voice) {
    case "female":
    case "f1_enin":
    case "f2_enin":
      return "en-IN";  // English (India)
    case "male":
    case "malein":
      return "hi-IN";  // Hindi (India)
    case "f3_hiin":
    case "f4_hiin":
      return "hi-IN";  // Hindi (India) for female voices
    default:
      return "en-US";  // Default language code
  }
}

function getGender(voice: string): string {
  if (voice.startsWith("male")) {
    return "MALE";
  } else {
    return "FEMALE";
  }
}


// let name = "";
// let name = "en-IN-Chirp3-HD-Algenib";
// let name = ""

function getVoiceID(voice: string): string {
  switch (voice) {
    case "female":
      return "en-US-Studio-O";  // Default female voice (US English)
    case "male":
      return "en-IN-Chirp3-HD-Algenib";  // Default male voice (Indian English)
    case "maleIn":
      return "hi-IN-Chirp3-HD-Zubenelgenubi";  // Hindi Male voice
    case "f1_enIn":
      return "en-IN-Chirp3-HD-Achernar";  // Female Avatar (English - India, Achernar)
    case "f2_enIn":
      return "en-IN-Chirp3-HD-Despina";  // Female Avatar (English - India, Despina)
    case "f3_hiIn":
      return "hi-IN-Chirp3-HD-Achernar";  // Female Avatar (Hindi - India, Achernar)
    case "f4_hiIn":
      return "hi-IN-Chirp3-HD-Despina";  // Female Avatar (Hindi - India, Despina)
    default:
      return "en-US-Studio-O";  // Default if no match is found
  }
}


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
  },
  contentClass: string,
  user_video_id: string
): Promise<string> {
  deleteFiles([],true);
  console.log("got pref, ", preferences);

  let tts_options = {
    text: script,
    language: getLang(preferences.avatar.toLowerCase()), // or any other language supported by your TTS service
    gender: getGender(preferences.avatar.toLowerCase()), //male or female,
    voiceId: getVoiceID(preferences.avatar),
    user_video_id: user_video_id,
  };

  console.log("tts options ", tts_options);
  // let audioPath = `audio_${tts_options.user_video_id}.mp3`;
  // Output: Audio file saved at: ./bhashini-audio/user_abcd_1234.wav

  let tempFiles: string[] = [];
  // 1. Text to Audio (TTS)
  let audioPath = await textToSpeech(tts_options.text, {
    apiKey: AUDIO_API_KEY, // <-- Replace with your API key
    languageCode: tts_options.language,
    ssmlGender: tts_options.gender,
    fileName: `audio_${tts_options.user_video_id}.mp3`,
    name: tts_options.voiceId,
  });
  tempFiles.push(audioPath);

  console.log("done with audioPath");
  // 2. Audio to Text (ASR with word timestamps)
  let transcriptData: any = await speechToText(
    `audio_${tts_options.user_video_id}.mp3`,
    {
      apiKey: TRANSCRIPT_API_KEY,
      languageCode: tts_options.language
    },
    script.split(" ")
  );

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
          },
          "type": {
            "type": "string",
            "enum": ["story", "nostory"],
            "description": "Indicates whether the chunk is part of a story or not , it should contain some significant story charater or element or imagination which we are telling in story which can't be shown through real life stock image/video."
          }
        },
        "required": ["chunk", "type"]
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

  // 4. Iterate over chunks
  for (const [chunk_index, chunk] of chunks.entries()) {
    console.log("chunk is , ", chunk);
    console.log("chunk index is ", chunk_index);

    // 2. Extract visually-representable and high-salience keywords, with script context reminder
    // const keywordsPrompt =
    //   `Given the following script segment (which is part of a larger script about: ${scriptContextSummary}), ` +
    //   `extract/generate one distinct, non-duplicate keywords or short phrases in english that would be effective as visuals (image, video), ` +
    //   `as well as text highlights for important dates or phrases. ` +
    //   `Do NOT include explanations.\n\nSCRIPT SEGMENT:\n${chunk}
    //   Note this keyword will be used as query for image/video for visuals of this segment/chunk
    //   also make sure not to put any puncutation,asteriks or special characters in the keyword, just a single word or phrase
    //   Striclty make sure keyword or phrase being generated is in english only`;

    const keywordSystemPrompt =  `You are a visual keyword generation assistant. Your job is to generate a visual query for image/video content based on a given script segment and its overall context.

You must:
- Understand the subject of the script from both the given segment and the overall context.
- Disambiguate keywords by using context clues (e.g., is “Apple” a fruit or the company? Is “money” referring to Indian Rupees or US Dollars?).
- Use culturally or geographically relevant visuals if applicable (e.g., use "Indian Rupees" if the script is set in India).
- Select a keyword or short phrase in **English** that would work well as a **search term** for a visual (image/video).
- Avoid punctuation or special characters.
- Provide a **brief explanation** ("reasoning") for why this keyword was chosen, showing how context influenced your decision.

Your output must follow a strict JSON schema.
`

const keywordsPrompt = `You are given the following information:

OVERALL SCRIPT CONTEXT:
"${scriptContextSummary}"

SCRIPT SEGMENT:
"${chunk.chunk}"

TASK:
Based on the above, generate a visual keyword (as a search query) that accurately reflects the subject and is visually meaningful.

Use the broader script context to disambiguate any ambiguous terms or references (e.g., "Apple" = company or fruit, "money" = which currency, etc.)

Return your output in the following JSON format:
{
  "visual_query": "string",
  "reasoning": "string"
}

Rules:
- The visual_query must be a clean, simple English word or phrase. No punctuation or special characters.
- The reasoning should explain why this query fits the segment based on context.
- Prioritize Indian visual relevance if the script context supports it.

Examples:

Example 1:
Context: "A tech news video discussing recent iPhone updates"
Segment: "Apple is expected to release a new model with better battery life."
Output:
{
  "visual_query": "Apple iPhone",
  "reasoning": "The context makes it clear that Apple refers to the tech company, not the fruit, and the segment talks about a new iPhone release."
}

Example 2:
Context: "A documentary about Himachal Pradesh agriculture"
Segment: "Apple is one of the main crops grown in the region."
Output:
{
  "visual_query": "Himachal Apple Orchard",
  "reasoning": "The context shows this is about fruit farming in Himachal, so 'Apple' refers to the fruit, and location is relevant."
}

Example 3:
Context: "Explaining rising prices in rural Indian markets"
Segment: "People are finding it harder to manage their daily expenses."
Output:
{
  "visual_query": "Indian Rupees",
  "reasoning": "The mention of daily expenses and rural India suggests the money visual should be in Indian currency."
}

Example 4:
Context: "A global finance overview"
Segment: "Inflation has pushed up costs across major cities."
Output:
{
  "visual_query": "US Dollars",
  "reasoning": "The context is global finance, and without specific location, US Dollars is a common visual for money."
}

Now generate the output for the current segment.
`;

const visualKeywordSchema = {
  type: "object",
  properties: {
    visual_query: {
      type: "string",
      description: "A clean English keyword or short phrase usable as a visual search query (no punctuation or special characters)."
    },
    reasoning: {
      type: "string",
      description: "A brief explanation of how the context led to the choice of visual_query."
    }
  },
  required: ["visual_query", "reasoning"]
};
    

      let keywordsJson = await retryLlmCall(callStructuredLlm, [
      LLM_API_KEY,
      keywordSystemPrompt,
      keywordsPrompt,
      visualKeywordSchema,
      ]);

      let keywordsStr = keywordsJson.visual_query;

    console.log("Keywords are:", keywordsStr);

    // Get timestamps for the chunk
    let { startTime, endTime, startIndex, endIndex } = getTimestampsForPhrase(
      transcriptData,
      chunk.chunk
    );

    // Extract the actual word objects for the chunk
    const chunkWords = transcriptData.slice(startIndex, endIndex + 1);

    console.log("chunk words ", chunkWords);

    let tag = "";
    let templateJson = {};
    let { selectedUrl, alternateUrls } = { selectedUrl: "", alternateUrls: [] };
    let mediaPath = "";

    if (preferences.style != "slideshow") {
      // b. Extract tag for chunk
      const tagPrompt = `Extract a single tag for the following text:\n\n${chunk.chunk}\n\nReturn a single tag as a string.`;
      // const tag = await callLlm(apiKey,`Extract a tag from text.`,tagPrompt);
      const tag = await retryLlmCall(callLlm, [LLM_API_KEY, tagPrompt, chunk.chunk]);

      // template selection
      let template = templateSelector(
        chunk.chunk,
        keywordsStr,
        tag,
        scriptContextSummary
      );
      // let template = "slideshow";

      // get scene json info -> media queries , start time, end time
      // let llmOutput = callStructuredLlm(apiKey,`Generate a template JSON for the following text with keywords and tag.`,"",template)
      let llmOutput = await retryLlmCall(callStructuredLlm, [
        LLM_API_KEY,
        `Generate a template JSON for the following text with keywords and tag.`,
        "",
        template,
      ]);

      // let templateJson =  collectTemplateAssets(template, keywords);
    } else {
      console.log("slideshow condition");
      // For slideshow, we don't need a tag or templateJson
      // c. Call asset search

      //  let {selectedUrl: string,alternateUrls: string[]}; = await callAssetSearch(keywordsStr, preferences.style);
      // let assetDetails = await callAssetSearch(keywordsStr, preferences.style);
      // let assetDetails = await retryLlmCall(callAssetSearch,[keywordsStr, preferences.style]);
      // let selectedUrl = assetDetails.selected_asset;
      // let alternateUrls = assetDetails.alternate_asset;
      let assetDetails = (await retryLlmCall(callAssetSearch, [
        keywordsStr,
        preferences.style,
        chunk.type
      ])) || { selected_asset: "", alternate_asset: [] };
      let selectedUrl = assetDetails.selected_asset;
      let alternateUrls = assetDetails.alternate_asset || [];

      // d. Download media with fallback to alternate URLs
      let mediaPath: string | undefined;
      let downloadSuccess = false;

      const allUrls = [selectedUrl, ...(alternateUrls || [])];

      console.log("all urls, ", allUrls);

      for (const url of allUrls) {
        try {
          const { path } = await downloadFile(url);
          console.log("Downloaded path: ", path);
          tempFiles.push(path);
          //mediaPath = path
          mediaPath = path.replace(/^public[\\/]/, "");
          console.log("media path is ", mediaPath);
          selectedUrl = url; // update to the actually used URL
          downloadSuccess = true;
          break; // Exit loop on first success
        } catch (err) {
          console.warn(`Failed to download from ${url}: ${err}`);
          // Try next URL
        }
      }

      if (!downloadSuccess) {
        try {
          const url = await generateFreepikAI("image", keywordsStr);
          console.log("Selected asset set to:", url);

          if (typeof url === "string") {
            try {
              const { path } = await downloadFile(url);
              console.log("Downloaded path: ", path);
              tempFiles.push(path);
              //mediaPath = path
              mediaPath = path.replace(/^public[\\/]/, "");
              console.log("media path is ", mediaPath);
              selectedUrl = url; // update to the actually used URL
              downloadSuccess = true;
            } catch (err) {
              console.warn(`Failed to download from ${url}: ${err}`);
              // Try next URL
            }
          }
        } catch (err) {
          console.error("Error generating Freepik AI image:", err);
        }
        console.log("All media download attempts failed.");
      }

      templateJson = { path: mediaPath };
    }

    // e. Compose chunkJson
    const chunkJson: ChunkJson = {
      chunkId: chunk_index,
      chunkText: chunk.chunk,
      keywords: keywordsStr,
      startTime,
      endTime,
      words: chunkWords,
      selectedUrl,
      alternateUrls,
      template: preferences.style,
      templateJson: templateJson,
      tag,
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
    if(assetJson[a].type==="video"){
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

  await renderPersonalizedVideo({
    user_video_id: tts_options.user_video_id,
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
  });
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
