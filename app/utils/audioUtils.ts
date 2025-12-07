import * as fs from "fs";
import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';

// The main text-to-speech function
export async function textToSpeech(
  text: string,
  {
    apiKey,
    languageCode = "en-US",
    ssmlGender = "NEUTRAL",
    fileName = "output.mp3",
    name
  }: {
    apiKey: string;
    languageCode?: string;
    ssmlGender?: "MALE" | "FEMALE" | "NEUTRAL"|string;
    fileName?: string;
    name?:string
  }
): Promise<string> {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  // let name = "hi-IN-Chirp3-HD-Zubenelgenubi";
  // let name = "en-IN-Chirp3-HD-Algenib";
  // let name = "en-US-Studio-O"
  const payload = {
    input: { text },
    voice: { languageCode,name, ssmlGender },
    audioConfig: { audioEncoding: "OGG_OPUS",    sampleRateHertz: 48000  },

  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`TTS API error: ${await response.text()}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("No audio content received from API.");
  }

  fs.writeFileSync(fileName, Buffer.from(data.audioContent, "base64"));
  console.log(`Audio content written to file: ${fileName}`);
  return fileName;
}

// Example usage
// (async () => {
//   await textToSpeech("Hello, this is a test!", {
//     apiKey: "", // <-- Replace with your API key
//     languageCode: "en-US",
//     ssmlGender: "NEUTRAL",
//     fileName: "hello.mp3"
//   });
// })();



interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
}

interface SpeechResult {
  audioPath: string;
  transcriptData: WordInfo[];  // ✅ YOUR EXACT FORMAT
}

/**
 * ✅ Generate speech → Save MP3 → Return wordsArray in YOUR format
 */
export async function generateSpeechWithTranscript(
  apiKey: string,
  voiceId: string|"21m00Tcm4TlvDq8ikWAM",
  text: string,
  filename: string = "speech.mp3"
): Promise<SpeechResult> {
  const client = new ElevenLabsClient({ apiKey });

  console.log(`🎤 Generating: "${text}"`);
  
  const response = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  // ✅ SAVE AUDIO FILE
  const audioBase64 = response.audioBase64!;
  const audioBuffer = Buffer.from(audioBase64, "base64");
  fs.writeFileSync(filename, audioBuffer);
  console.log(`✅ SAVED: ${filename}`);

  // ✅ YOUR EXACT FORMAT: wordsArray
  const wordsArray: WordInfo[] = [];
  
  const characters = response.alignment?.characters || [];
  const startTimes = response.alignment?.characterStartTimesSeconds || [];
  const endTimes = response.alignment?.characterEndTimesSeconds || [];
  
  // ✅ EXACT MATCH: wordsArray.push({ word, startTime, endTime })
  let currentWord = "";
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (char.trim() !== "") {
      if (currentWord === "") wordStart = startTimes[i];
      currentWord += char;
    } else if (currentWord !== "") {
      const start = wordStart;
      const end = endTimes[i - 1];
      wordsArray.push({
        word: currentWord,
        startTime: start,
        endTime: end
      });
      currentWord = "";
    }
  }
  
  // Last word
  if (currentWord !== "") {
    wordsArray.push({
      word: currentWord,
      startTime: wordStart,
      endTime: endTimes[endTimes.length - 1]
    });
  }

  console.log("\n📝 WORD-LEVEL TRANSCRIPT:");
  wordsArray.forEach((wordInfo, i) => {
    console.log(`${i + 1}. "${wordInfo.word}" → ${wordInfo.startTime.toFixed(2)}s - ${wordInfo.endTime.toFixed(2)}s`);
  });

  return { audioPath: filename, transcriptData:wordsArray };
}
