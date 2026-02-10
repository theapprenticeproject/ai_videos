import { getTimestampsForPhrase } from './app/utils/utils';

const transcript = [
    { word: "नमस्ते", startTime: 1.0, endTime: 1.5 },
    { word: "दुनिया", startTime: 1.5, endTime: 2.0 },
    { word: "कैसे", startTime: 2.0, endTime: 2.5 },
    { word: "हो", startTime: 2.5, endTime: 3.0 },
    { word: "!", startTime: 3.0, endTime: 3.1 }
];

const phrase = "नमस्ते दुनिया";
const result = getTimestampsForPhrase(transcript, phrase);

console.log("Matching phrase:", phrase);
console.log("Result:", result);

if (result.startTime === 1.0 && result.endTime === 2.0) {
    console.log("✅ Hindi matching test passed!");
} else {
    console.log("❌ Hindi matching test failed.");
}

const phraseWithPunc = "हो!";
const resultPunc = getTimestampsForPhrase(transcript, phraseWithPunc);
console.log("Matching phrase with punc:", phraseWithPunc);
console.log("Result:", resultPunc);

// Test punctuation spacing logic simulation
const testTranscriptData = [
    { word: "Hello" },
    { word: "." },
    { word: "How" },
    { word: "are" },
    { word: "you" },
    { word: "?" },
    { word: "मैं" },
    { word: "ठीक" },
    { word: "हूँ" },
    { word: "।" }
];

let script = "";
for (let i = 0; i < testTranscriptData.length; i++) {
    const word = testTranscriptData[i].word;
    if (i > 0 && !/^[।.,!?]/.test(word)) {
        script += " ";
    }
    script += word;
}

console.log("Reconstructed script:", script);
const expectedScript = "Hello. How are you? मैं ठीक हूँ।";
if (script === expectedScript) {
    console.log("✅ Punctuation spacing test passed!");
} else {
    console.log("❌ Punctuation spacing test failed.");
    console.log("Expected:", expectedScript);
}
