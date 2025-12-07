
import * as fs from "fs";
import fetch from "node-fetch";
import { saveDataAsJSON } from "./utils";

type WordTimestamp = {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
};

export async function speechToText(
  audioPath: string,
  {
    apiKey,
    languageCode = "en-US"
  }: {
    apiKey: string;
    languageCode?: string;
  },
  scriptWords?:string[]
): Promise<WordTimestamp[]> {
  const audioBytes = fs.readFileSync(audioPath).toString("base64");

  const url = `https://speech.googleapis.com/v1p1beta1/speech:recognize?key=${apiKey}`;
  const payload = {
    config: {
      encoding: "OGG_OPUS",
      sampleRateHertz: 48000 , //LINEAR16, FLAC, MULAW, AMR, etc.`
      languageCode: languageCode,
      enableWordTimeOffsets: true,
      useEnhanced: true, // Use enhanced model for better accuracy
      speechContexts:{
        phrases:scriptWords
      }
    },
    audio: {
      content: audioBytes
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Speech-to-Text API error: ${await response.text()}`);
  }

  const data = await response.json() as any;

  console.log("Speech-to-Text response:", JSON.stringify(data,null,2));
  // saveDataAsJSON(data, 'google_speech_to_text_response.json');
  // For debugging, print the complete response:
  // console.dir(data, { depth: 10 });

  const wordsArray: WordTimestamp[] = [];

  if (data.results) {
    for (const result of data.results) {
      for (const alt of result.alternatives ?? []) {
        for (const wordInfo of alt.words ?? []) {
          let start = 0;
          let end = 0;
          // startTime could be { seconds, nanos } or a string like "4.300s"
          if (typeof wordInfo.startTime === "string") {
            start = parseFloat(wordInfo.startTime.replace("s", ""));
          } else if (wordInfo.startTime && typeof wordInfo.startTime === "object") {
            start = Number(wordInfo.startTime.seconds || 0) + Number(wordInfo.startTime.nanos || 0) / 1e9;
          }
          if (typeof wordInfo.endTime === "string") {
            end = parseFloat(wordInfo.endTime.replace("s", ""));
          } else if (wordInfo.endTime && typeof wordInfo.endTime === "object") {
            end = Number(wordInfo.endTime.seconds || 0) + Number(wordInfo.endTime.nanos || 0) / 1e9;
          }
          wordsArray.push({
            word: wordInfo.word,
            startTime: start,
            endTime: end
          });
        }
      }
    }
  }

  return wordsArray;
}

// Example usage:
// (async () => {
//   const words = await speechToText("audio_unique_user_video_id_test6_fullscrptcontext_generated_2_IN.mp3", {
//     apiKey: "",
//     languageCode: "hi-IN"
//   });

//   // Print results:
// //   words.forEach((w) =>
// //     console.log(`${w.word}\t${w.startTime.toFixed(2)}s\t${w.endTime.toFixed(2)}s`)
// //   );
//     console.log(words)
// })();
