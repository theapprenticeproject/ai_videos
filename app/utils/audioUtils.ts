import * as fs from "fs";
import * as path from "path";
import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import { execSync } from "child_process";

// The main text-to-speech function
export async function textToSpeech(
  text: string,
  {
    apiKey,
    languageCode = "en-US",
    ssmlGender = "NEUTRAL",
    fileName = "output.wav",
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

  const outputDir = path.dirname(fileName);
  if (outputDir && outputDir !== "." && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save to a temporary file first
  const tempFileName = path.join(outputDir, `temp_${path.basename(fileName)}`);
  fs.writeFileSync(tempFileName, Buffer.from(data.audioContent, "base64"));
  
  // Convert to standard WAV (48kHz, 16-bit, stereo)
  console.log(`⚙️ Converting ${tempFileName} to standard WAV (48kHz, 16-bit, stereo)...`);
  execSync(`ffmpeg -y -i "${tempFileName}" -ac 2 -ar 48000 -sample_fmt s16 "${fileName}"`);
  
  // Clean up temporary file
  if (fs.existsSync(tempFileName)) {
    fs.unlinkSync(tempFileName);
  }

  console.log(`✅ Audio content converted and written to file: ${fileName}`);
  return fileName;
}

// Example usage
// (async () => {
//   await textToSpeech("Hello, this is a test!", {
//     apiKey: "", // <-- Replace with your API key
//     languageCode: "en-US",
//     ssmlGender: "NEUTRAL",
//     fileName: "hello.wav"
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
 * ✅ Generate speech → Save WAV → Return wordsArray in YOUR format
 */
export async function generateSpeechWithTranscript(
  apiKey: string,
  voiceId: string|"21m00Tcm4TlvDq8ikWAM",
  text: string,
  filename: string = "speech.wav"
): Promise<SpeechResult> {
  const client = new ElevenLabsClient({ apiKey });

  const outputDir = path.dirname(filename);
  if (outputDir && outputDir !== "." && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[ELEVENLABS] Request start. voiceId=${voiceId} textChars=${text.length}`);
  
  let response;
  try {
    response = await client.textToSpeech.convertWithTimestamps(voiceId, {
      text,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });
  } catch (error) {
    console.error(`[ELEVENLABS] Request failed before audio write. voiceId=${voiceId}`);
    throw error;
  }

  // ✅ SAVE AUDIO FILE TEMPORARILY
  const audioBase64 = response.audioBase64!;
  const audioBuffer = Buffer.from(audioBase64, "base64");
  const tempFilename = path.join(outputDir, `temp_${path.basename(filename)}`);
  fs.writeFileSync(tempFilename, audioBuffer);
  const alignedChars = response.alignment?.characters?.length ?? 0;
  console.log(`[ELEVENLABS] Response received. audioBytes=${audioBuffer.length} alignedChars=${alignedChars}`);
  
  // ✅ CONVERT TO WAV 48kHz, 16-bit, stereo
  console.log(`⚙️ Converting ${tempFilename} to standard WAV (48kHz, 16-bit, stereo)...`);
  execSync(`ffmpeg -y -i "${tempFilename}" -ac 2 -ar 48000 -sample_fmt s16 "${filename}"`);
  
  // Clean up temporary file
  if (fs.existsSync(tempFilename)) {
    fs.unlinkSync(tempFilename);
  }

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
