import { getTimestampsForPhrase, adjustTimestampsForContinuity, ChunkWithTimes } from './app/utils/utils';

const transcriptWords = [
  { word: "Hello", startTime: 0, endTime: 0.5 },
  { word: "world", startTime: 0.6, endTime: 1.0 },
  { word: "this", startTime: 1.1, endTime: 1.5 },
  { word: "is", startTime: 1.6, endTime: 2.0 },
  { word: "a", startTime: 2.1, endTime: 2.5 },
  { word: "test", startTime: 2.6, endTime: 3.0 },
];

console.log("--- Testing getTimestampsForPhrase ---");

const res1 = getTimestampsForPhrase(transcriptWords, "Hello world", 0);
console.log("Match 1 ('Hello world'):", res1);

const res2 = getTimestampsForPhrase(transcriptWords, "is a test", res1.endIndex + 1);
console.log("Match 2 ('is a test', search from index 2):", res2);

const res3 = getTimestampsForPhrase(transcriptWords, "nonexitent", 0);
console.log("Match 3 ('nonexitent', should fallback):", res3);

console.log("\n--- Testing adjustTimestampsForContinuity ---");

const chunks: ChunkWithTimes[] = [
  { startTime: 0, endTime: 1.0, text: "C1" },
  { startTime: 1.6, endTime: 3.0, text: "C2" },
];

console.log("Before adjustment:", JSON.stringify(chunks, null, 2));
adjustTimestampsForContinuity(chunks, 5.0);
console.log("After adjustment (totalDuration 5.0):", JSON.stringify(chunks, null, 2));

if (chunks[0].endTime === chunks[1].startTime && chunks[1].endTime === 5.0) {
  console.log("✅ Continuity test passed!");
} else {
  console.log("❌ Continuity test failed!");
}
