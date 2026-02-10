
// // function normalize(word: string): string {
// //   // Removes punctuation and makes lowercase
// //   return word.replace(/[^\w\s]|_/g, '').toLowerCase();
// // }

// function normalize(word: string): string {
//   return word.replace(/[^\p{L}\p{N}\s]+/gu, '').toLowerCase();
// }


// export function getTimestampsForPhrase(
//   transcriptWords: {
//     word: string;
//     startTime: number;
//     endTime: number;
//   }[],
//   phrase: string,
//   fallbackDuration: number = 5
// ): { startTime: number; endTime: number; startIndex: number; endIndex: number } {

//   phrase = normalize(phrase);

//   const chunkWords = phrase
//     .trim()
//     .toLowerCase()
//     .split(/\s+/)
//     .filter(word => word.trim() !== "");

//   // Filter transcript words that are blank or empty
//   transcriptWords = transcriptWords.filter(w => w.word && w.word.trim() !== "");

//   // Adjust start times for transcriptWords
//   for (let i = 1; i < transcriptWords.length; i++) {
//     transcriptWords[i].startTime = transcriptWords[i - 1].endTime;

//     if (transcriptWords[i].endTime < transcriptWords[i].startTime) {
//       console.log("Adjusting endTime for word:", transcriptWords[i].word);
//       transcriptWords[i].endTime = transcriptWords[i].startTime + 0.01;
//     }
//   }

//   for (let i = 0; i <= transcriptWords.length - chunkWords.length; i++) {
//     const slice = transcriptWords.slice(i, i + chunkWords.length);

//     let match = true;

//     for (let idx = 0; idx < chunkWords.length; idx++) {
//       const wordFromTranscript = normalize(slice[idx].word.toLowerCase().trim());
//       const wordFromChunk = normalize(chunkWords[idx].toLowerCase().trim());

//       // If either word is blank or empty — skip this entire attempt
//       if (!wordFromTranscript || !wordFromChunk) {
//         match = false;
//         console.log(`⏭️ Skipping comparison at index ${i}, idx ${idx} due to blank word`);
//         break;
//       }

//       if (wordFromTranscript !== wordFromChunk) {
//         match = false;
//         break;
//       }
//     }

//     console.log("Match result at index", i, ":", match);

//     if (match) {
//       console.log("✅ Match found with times:", slice[0].startTime, "-", slice[slice.length - 1].endTime);
//       return {
//         startTime: slice[0].startTime,
//         endTime: slice[slice.length - 1].endTime,
//         startIndex: i,
//         endIndex: i + chunkWords.length - 1,
//       };
//     }
//   }

//   // Fallback
//   console.log("⚠️ Phrase not found, using fallback duration.");
//   return {
//     startTime: 0,
//     endTime: fallbackDuration,
//     startIndex: 0,
//     endIndex: Math.floor(fallbackDuration),
//   };
// }
export interface ChunkWithTimes {
  startTime: number;
  endTime: number;
  [key: string]: any;
}

/**
 * Adjusts chunks so that each chunk's endTime matches the next chunk's startTime.
 * The last chunk's endTime is set to the total duration.
 */
export function adjustTimestampsForContinuity(
  chunks: ChunkWithTimes[],
  totalDuration: number
): void {
  if (chunks.length === 0) return;

  // 1. Force start of the first chunk to 0
  chunks[0].startTime = 0;

  // 2. Unify all intermediate boundaries
  for (let i = 0; i < chunks.length - 1; i++) {
    // We prioritize the start time of the NEXT chunk as the boundary,
    // but we ensure the previous chunk ends exactly there.
    // If the next chunk's start time is somehow earlier than the previous start, 
    // we keep it as is but the loop ensures continuity.
    chunks[i].endTime = chunks[i + 1].startTime;
  }
  
  // 3. Force end of the last chunk to the total audio duration
  chunks[chunks.length - 1].endTime = totalDuration;
  
  // 4. Optional: double check for any remaining gaps (should be none now)
  for (let i = 0; i < chunks.length - 1; i++) {
    if (chunks[i].endTime !== chunks[i+1].startTime) {
       chunks[i+1].startTime = chunks[i].endTime;
    }
  }
}

export function getTimestampsForPhrase(
  transcriptWords: {
    word: string;
    startTime: number;
    endTime: number;
  }[],
  phrase: string,
  searchFromIndex: number = 0,
  fallbackDuration: number = 5
): { startTime: number; endTime: number; startIndex: number; endIndex: number } {
  const normalize = (w: string) =>
    w.toLowerCase()
     .replace(/[।.,!?]/g, "") // Remove common Hindi and English punctuation
     .replace(/[^\p{L}\p{N}\s]+/gu, "") 
     .trim();

  // 1. Atomization: Split multi-word transcript entries into single words
  const atoms: { norm: string; originalIndex: number; startTime: number; endTime: number }[] = [];
  transcriptWords.forEach((tw, idx) => {
    // Some transcriptions might have multiple words in one entry
    const parts = tw.word.split(/\s+/).filter(Boolean);
    parts.forEach(p => {
      atoms.push({
        norm: normalize(p),
        originalIndex: idx,
        startTime: tw.startTime,
        endTime: tw.endTime
      });
    });
  });

  const phraseWords = phrase.split(/\s+/).map(normalize).filter(Boolean);
  
  if (!phraseWords.length || !atoms.length) {
    const start = transcriptWords[searchFromIndex]?.startTime || (transcriptWords.length > 0 ? transcriptWords[transcriptWords.length-1].endTime : 0);
    return {
      startTime: start,
      endTime: start + fallbackDuration,
      startIndex: searchFromIndex,
      endIndex: searchFromIndex,
    };
  }

  // Find mapping from original searchFromIndex to atoms index
  let atomStartIndex = 0;
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i].originalIndex >= searchFromIndex) {
      atomStartIndex = i;
      break;
    }
  }

  // 2. Smart Window Search
  const firstWord = phraseWords[0];
  let currentSearchPos = atomStartIndex;

  while (currentSearchPos < atoms.length) {
    // Look for the normalized starting word
    if (atoms[currentSearchPos].norm === firstWord) {
      // Found a potential start. Now try matching the sequence in decreasing window sizes
      // starting from the full phrase length.
      for (let windowSize = phraseWords.length; windowSize > 0; windowSize--) {
        if (currentSearchPos + windowSize > atoms.length) continue;

        const windowAtoms = atoms.slice(currentSearchPos, currentSearchPos + windowSize);
        const windowNorms = windowAtoms.map(a => a.norm);
        
        // Compare joined strings to allow for minor variations in grouping
        const windowStr = windowNorms.join("");
        const targetStr = phraseWords.slice(0, windowSize).join("");

        if (windowStr === targetStr) {
          const startIndex = windowAtoms[0].originalIndex;
          const endIndex = windowAtoms[windowAtoms.length - 1].originalIndex;
          const startTime = transcriptWords[startIndex].startTime;
          const endTime = transcriptWords[endIndex].endTime;

          console.log(`✅ Smart Window match: "${phrase}" -> found first ${windowSize} words at indices ${startIndex}-${endIndex}`);
          return { startTime, endTime, startIndex, endIndex };
        }
      }
    }
    // Look ahead for the next occurrence of the first word
    currentSearchPos++;
  }

  // 3. Robust Fallback: If no match found, use the next available words from searchFromIndex
  console.warn(`⚠️ Smart Window failed for: "${phrase}". Using fallback words.`);
  const fallbackIndex = Math.min(searchFromIndex, transcriptWords.length - 1);
  const fallbackEnd = Math.min(fallbackIndex + 2, transcriptWords.length - 1); // take 3 words as fallback if possible
  
  const start = transcriptWords[fallbackIndex]?.startTime || 0;
  const end = transcriptWords[fallbackEnd]?.endTime || (start + fallbackDuration);

  return {
    startTime: start,
    endTime: end,
    startIndex: fallbackIndex,
    endIndex: fallbackEnd,
  };
}



let t =  [
  // { word: '""', startTime:19, endTime: 20.6 },
  { word: 'just', startTime: 20.6, endTime: 21.4 },
  { word: 'like', startTime: 21.4, endTime: 21.6 },
  { word: 'in', startTime: 21.6, endTime: 21.8 },
  { word: 'the', startTime: 21.8, endTime: 21.8 },
  { word: 'game', startTime: 21.8, endTime: 22.1 },
  { word: 'where', startTime: 22.1, endTime: 22.6 },
  { word: 'zombies', startTime: 22.6, endTime: 22.7 },
  { word: 'pop', startTime: 22.7, endTime: 23.1 },
  { word: 'up', startTime: 23.1, endTime: 23.2 },
  { word: 'and', startTime: 23.2, endTime: 23.3 },
  { word: 'you', startTime: 23.3, endTime: 23.6 },
  { word: 'tap', startTime: 23.6, endTime: 23.7 },
  { word: 'them', startTime: 23.7, endTime: 23.8 },
  { word: 'to', startTime: 23.8, endTime: 24 },
  { word: 'make', startTime: 24, endTime: 24.1 },
  { word: 'them', startTime: 24.1, endTime: 24.3 },
  { word: 'disappear', startTime: 24.3, endTime: 24.7 },
  { word: 'in', startTime: 24.7, endTime: 25.6 },
  { word: 'real', startTime: 25.6, endTime: 25.6 },
  { word: 'life', startTime: 25.6, endTime: 25.8 },
  { word: 'you', startTime: 25.8, endTime: 26.2 },
  { word: 'need', startTime: 26.2, endTime: 26.2 },
  { word: 'to', startTime: 26.2, endTime: 26.4 },
  { word: 'Tap', startTime: 26.4, endTime: 26.7 },
  { word: 'Away', startTime: 26.7, endTime: 27 },
  { word: 'on', startTime: 27, endTime: 27.4 },
  { word: 'healthy', startTime: 27.4, endTime: 27.5 },
  { word: 'habits', startTime: 27.5, endTime: 27.8 },
  { word: 'and', startTime: 27.8, endTime: 28.1 },
  { word: 'negative', startTime: 28.1, endTime: 28.5 },
  { word: 'thoughts', startTime: 28.5, endTime: 28.8 },
  { word: 'meaning', startTime: 28.8, endTime: 29.5 },
  { word: 'get', startTime: 29.5, endTime: 29.8 },
  { word: 'rid', startTime: 29.8, endTime: 29.9 },
  { word: 'of', startTime: 29.9, endTime: 30 },
  { word: 'them', startTime: 30, endTime: 30.2 },
  { word: 'so', startTime: 30.2, endTime: 30.7 },
  { word: 'you', startTime: 30.7, endTime: 30.8 },
  { word: "don't", startTime: 30.8, endTime: 31 },
  { word: 'become', startTime: 31, endTime: 31.3 },
  { word: 'a', startTime: 31.3, endTime: 31.4 },
  { word: 'zombie', startTime: 31.4, endTime: 31.6 },
  { word: 'yourself', startTime: 31.6, endTime: 32 },
  { word: 'so', startTime: 32, endTime: 32.8 },
  { word: 'take', startTime: 32.8, endTime: 33.1 },
  { word: 'care', startTime: 33.1, endTime: 33.3 },
  { word: 'of', startTime: 33.3, endTime: 33.5 },
  { word: 'yourself', startTime: 33.5, endTime: 33.7 },
  { word: 'stay', startTime: 33.7, endTime: 34.3 },
  { word: 'active', startTime: 34.3, endTime: 34.6 },
  { word: 'eat', startTime: 34.6, endTime: 35.1 },
  { word: 'healthy', startTime: 35.1, endTime: 35.3 },
  { word: 'think', startTime: 35.3, endTime: 35.8 },
  { word: 'positive', startTime: 35.8, endTime: 36.3 },
  { word: 'and', startTime: 36.3, endTime: 36.7 },
  { word: 'always', startTime: 36.7, endTime: 37.1 },
  { word: 'be', startTime: 37.1, endTime: 37.4 },
  { word: 'ready', startTime: 37.4, endTime: 37.6 },
  { word: 'to', startTime: 37.6, endTime: 37.7 },
  { word: 'Tap', startTime: 37.7, endTime: 38.1 },
  { word: 'Away', startTime: 38.1, endTime: 38.5 },
  { word: 'real', startTime: 38.5, endTime: 38.8 },
  { word: 'life', startTime: 38.8, endTime: 39 },
  { word: 'zombies', startTime: 39, endTime: 39.4 },
  { word: 'this', startTime: 39.4, endTime: 39.7 },
  { word: 'skill', startTime: 39.7, endTime: 40.1 },
  { word: 'will', startTime: 40.1, endTime: 40.3 },
  { word: 'be', startTime: 40.3, endTime: 40.3 },
  { word: 'very', startTime: 40.3, endTime: 40.5 },
  { word: 'helpful', startTime: 40.5, endTime: 40.8 },
  { word: 'to', startTime: 40.8, endTime: 41.2 },
  { word: 'you', startTime: 41.2, endTime: 41.2 },
  { word: 'in', startTime: 41.2, endTime: 41.6 },
  { word: 'life', startTime: 41.6, endTime: 41.6 },
  { word: 'because', startTime: 41.6, endTime: 42.2 },
  { word: 'every', startTime: 42.2, endTime: 42.6 },
  { word: 'day', startTime: 42.6, endTime: 42.7 },
  { word: 'we', startTime: 42.7, endTime: 43 },
  { word: 'Face', startTime: 43, endTime: 43.4 },
  { word: 'new', startTime: 43.4, endTime: 43.6 },
  { word: 'challenges', startTime: 43.6, endTime: 43.9 },
  { word: 'that', startTime: 43.9, endTime: 44.2 },
  { word: 'we', startTime: 44.2, endTime: 44.3 },
  { word: 'need', startTime: 44.3, endTime: 44.4 },
  { word: 'to', startTime: 44.4, endTime: 44.5 },
  { word: 'solve', startTime: 44.5, endTime: 44.8 }
]


// let s = "and always be ready to Tap away real life zombies"
// getTimestampsForPhrase(t,s)

// export async function downloadMedia(url: string,alternateUrls:string[]): Promise<{ mediaPath: string; selectedUrl: string }> {
//   // firstly try downloading from the selected url
//   // if fails, try alternate urls
//   console.log("Downloading media from:", url);
//   await delay(1000);
//   return {"mediaPath":"/local/path/to/media.mp4","selectedUrl":url};
// }

// export function delay(ms: number) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

import path from "path";
import { execSync } from "child_process";


export function fixIfBrokenVideo(videoPath:string) {
  const ext = path.extname(videoPath);
  const fixedPath = videoPath.replace(ext, "_fixed" + ext);

  try {
    console.log("⚙️ Rebuilding timestamps and remuxing...");

    execSync(
      `ffmpeg -y -fflags +genpts -i "${videoPath}" -vsync vfr -c:v copy -c:a copy "${fixedPath}"`
    );

    console.log("✅ Timestamp fix applied:", fixedPath);
    return fixedPath;
  } catch (error) {
    console.error("❌ Failed to fix video:", error);
    return "";
  }
}


// console.log(fixIfBrokenVideo("public\\14148104_3840_2160_60fps.mp4"))
// console.log(fixIfBrokenVideo("public\\5527135-uhd_3840_2160_24fps.mp4"))

import ffmpeg from 'fluent-ffmpeg';

export function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      const duration = metadata.format.duration;
      if (typeof duration === 'number') {
        resolve(duration);
      } else {
        reject(new Error('Duration not found in metadata'));
      }
    });
  });
}


export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import * as fs from 'fs';

export function saveDataAsJSON<T>(data: T | T[], filename: string): void {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filename, jsonData, 'utf8');
    console.log(`Data saved successfully to ${filename}`);
  } catch (error) {
    console.error(`Error saving data to ${filename}:`, error);
  }
}


// /**
//  * Deletes files from the provided paths.
//  * @param filePaths - An array of file paths to delete.
//  */
// export function deleteFiles(filePaths: string[]): void {
//     filePaths.forEach(filePath => {
//         try {
//             const fullPath = path.resolve(filePath);

//             if (fs.existsSync(fullPath)) {
//                 const stat = fs.statSync(fullPath);

//                 if (stat.isFile()) {
//                     fs.unlinkSync(fullPath);
//                     console.log(`Deleted file: ${fullPath}`);
//                 } else {
//                     console.warn(`Skipped (not a file): ${fullPath}`);
//                 }
//             } else {
//                 console.warn(`File not found: ${fullPath}`);
//             }
//         } catch (error) {
//             console.error(`Error deleting file: ${filePath}`, error);
//         }
//     });
// }


export function deleteFiles(filePaths: string[], initial: boolean = false): void {
    if (initial) {
        // Define the directory and files to be skipped
        const publicDirectory = path.resolve('public');
        const skipFiles = ['logo.png', 'video-test.mp4'];

        try {
            // Read all files in the public directory
            const files = fs.readdirSync(publicDirectory);

            files.forEach(file => {
                const fullPath = path.resolve(publicDirectory, file);

                // Skip files that are in the skip list
                if (skipFiles.includes(file)) {
                    console.log(`Skipped file (whitelisted): ${file}`);
                    return;
                }

                try {
                    const stat = fs.statSync(fullPath);

                    // Check if it's a file and delete it
                    if (stat.isFile()) {
                        fs.unlinkSync(fullPath);
                        console.log(`Deleted file: ${fullPath}`);
                    } else {
                        console.warn(`Skipped (not a file): ${fullPath}`);
                    }
                } catch (error) {
                    console.error(`Error deleting file: ${fullPath}`, error);
                }
            });
        } catch (error) {
            console.error('Error reading the public directory', error);
        }
    } else {
        // Normal file deletion behavior
        filePaths.forEach(filePath => {
            try {
                const fullPath = path.resolve(filePath);

                if (fs.existsSync(fullPath)) {
                    const stat = fs.statSync(fullPath);

                    if (stat.isFile()) {
                        fs.unlinkSync(fullPath);
                        console.log(`Deleted file: ${fullPath}`);
                    } else {
                        console.warn(`Skipped (not a file): ${fullPath}`);
                    }
                } else {
                    console.warn(`File not found: ${fullPath}`);
                }
            } catch (error) {
                console.error(`Error deleting file: ${filePath}`, error);
            }
        });
    }
}
