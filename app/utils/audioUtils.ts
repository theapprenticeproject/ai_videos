import * as fs from "fs";

// You can also use: import fetch from "node-fetch"; if on Node 16 or below.

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


