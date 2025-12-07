/** @jsxImportSource @revideo/2d/lib */
import { makeScene2D, Img, Video, Txt, Layout, Rect, Audio } from '@revideo/2d';
import { waitFor, createRef } from '@revideo/core';

// Type definitions
type Word = { word: string, start: number, end: number };
type SubtitleStyle = {
  fontSize?: number;
  fontFamily?: string;
  highlightColor?: string;
  normalColor?: string;
};

// function groupWordsByCount(words: Word[], count: number,assets:any) {
//   const lines = [];
//   for (let i = 0; i < words.length; i += count) {
//     lines.push(words.slice(i, i + count));
//   }
//   return lines;
// }


function groupWordsByCount(words: Word[], count: number, assets: any[]) {
  const lines: Word[][] = [];
  let currentGroup: Word[] = [];
  let currentAssetIndex = -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const assetIndex = assets.findIndex(asset => word.start >= asset.start && word.end <= asset.end);

    if (assetIndex === -1) {
      console.warn(`⚠️ Word "${word.word}" (${word.start}-${word.end}) does not fit in any asset`);
      continue; // skip words not fitting in any asset
    }

    // If group is empty, or still inside the same asset
    const sameAsset = assetIndex === currentAssetIndex;

    if (currentGroup.length < count && sameAsset) {
      currentGroup.push(word);
    } else {
      // Push the current group if it has words
      if (currentGroup.length > 0) {
        lines.push(currentGroup);
      }

      // Start a new group with this word
      currentGroup = [word];
      currentAssetIndex = assetIndex;
    }
  }

  // Push the last group
  if (currentGroup.length > 0) {
    lines.push(currentGroup);
  }

  return lines;
}
function measureTextWidth(
  text: string,
  font: string = "700 48px Arial"
): number {
  // Use a static property on the function to reuse the canvas
  const canvas =
    (measureTextWidth as any).canvas ||
    ((measureTextWidth as any).canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  console.log(`Measuring text: "${text}" with font: ${font}, ${ctx.measureText(text).width}`);
  return ctx.measureText(text).width;
}

// import fs from 'fs';
// import path from 'path';

// export function saveJsonFile(filename:string, data:any) {
//   const jsonStr = JSON.stringify(data, null, 2); // formatted JSON string
//   const filePath = path.join(process.cwd(), 'data', filename); // save inside a 'data' folder in your project root

//   // Ensure 'data' folder exists
//   if (!fs.existsSync(path.dirname(filePath))) {
//     fs.mkdirSync(path.dirname(filePath), { recursive: true });
//   }

//   // Write file synchronously (or use fs.promises.writeFile for async)
//   fs.writeFileSync(filePath, jsonStr, 'utf8');
// }

import { useScene } from '@revideo/core';

export default makeScene2D("SCENE2", function* (view) {
  console.log("i am in scene 2d");
  const vars = useScene().variables;

  const getUsername = vars.get('username', 'Guest')!;
  const getWords    = vars.get('words', [])!; ///word level timestamps
  const getAssets   = vars.get('assets', [])!; //[{path, type, start, end}]
  const getOptions  = vars.get('options', {})!; //{wordsPerLine, subtitleStyle, logoUrl, audioUrl}

  // ✅ Call them to get actual values
  let username:any = getUsername();
  let words:any = getWords();
  let assets:any = getAssets();
  let options:any = getOptions();

  words = JSON.parse(words);
  assets = JSON.parse(assets);
  options = JSON.parse(options);

  console.log("👤 username:", username);
  console.log("📝 words:", words);
  console.log("🖼️ assets:", assets);
  console.log("⚙️ options:", options);
  // saveJsonFile('assets.json', assets);
  //  saveJsonFile('words.json', words);

  // let duration = getAudioDuration(options.audioUrl || '');
  // console.log("duration ", duration)
  // assets[assets.length-1].end = duration;
  
  const subtitleStyle = options.subtitleStyle || {};
  const fadeEnabled = options.fade ?? false;
  const fadeTime = fadeEnabled ? 0.5 : 0;

  const WORDS_PER_LINE = options.wordsPerLine ?? 3;
  const WORD_GAP = 25;
  const style = {
    fontSize: subtitleStyle.fontSize ?? 36,
    fontFamily:"700 56px Lohit Devanagari, Samyak Devanagari, Roboto, Arial, sans-serif",
    highlightColor: subtitleStyle.highlightColor ?? "#FFD700",
    normalColor: subtitleStyle.normalColor ?? "#FFF",
  };

  // Logo
  if (options.logoUrl) {
    view.add(
      <Img src={options.logoUrl} width={200} height={50} x={-540} y={340} zIndex={30} />
    );
  }

  // Audio
  if (options.audioUrl) {
    view.add(<Audio src={options.audioUrl} play={true} />);
  }

 view.add(
  <Audio 
    src="https://revideo-example-assets.s3.amazonaws.com/chill-beat-2.mp3" 
    play={true} 
    volume={0.15} 
    loop={true} 
  />
);


  // Subtitle Layer
  const subtitleRef = createRef<Layout>();
  view.add(
    <Layout
      ref={subtitleRef}
      y={260}
      zIndex={40}
      width={1280}
      height={80}
      justifyContent="center"
      alignItems="center"
    />
  );

  // Group words into lines based on assets
  const lines = groupWordsByCount(words, WORDS_PER_LINE, assets);
  const subtitleEvents = lines.map(line => ({
    line,
    start: line[0].start,
    end: line[line.length - 1].end
  }));
  // === Media Loop ===
  let currentTime = 0;
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    let mediaRef;

    if (asset.start > currentTime) {
      yield* waitFor(asset.start - currentTime);
      currentTime = asset.start;
    }

    if (asset.type === 'image') {
      mediaRef = createRef<Img>();
      view.add(
        <Img
          ref={mediaRef}
          src={asset.path}
          width={1280}
          height={720}
          opacity={0}
          zIndex={10}
        />
      );
    } else {
      mediaRef = createRef<Video>();
      view.add(
        <Video
          ref={mediaRef}
          src={asset.path}
          width={1280}
          height={720}
          opacity={0}
          zIndex={10}
          play
          loop
          volume={0}
        />
      );
    }

    // Fade in
    if (fadeEnabled) {
      yield* mediaRef().opacity(1, fadeTime);
    } else {
      mediaRef().opacity(1);
    }

    if(options.subtitles){
    // Show subtitles relevant to this asset
    for (const sub of subtitleEvents) {
      if (sub.end > asset.start && sub.start < asset.end) {
        if (sub.start > currentTime) {
          yield* waitFor(sub.start - currentTime);
          currentTime = sub.start;
        }

        for (let wIdx = 0; wIdx < sub.line.length; wIdx++) {
          const word = sub.line[wIdx];
          const duration = word.end - word.start;

          // Measure & layout text
          const font = style.fontFamily;
          const wordWidths = sub.line.map(w => measureTextWidth(w.word, font));
          const totalWidth = wordWidths.reduce((a, b) => a + b, 0) + (WORD_GAP * (sub.line.length - 1));
          const xPositions: number[] = [];
          let x = -totalWidth / 2;

          for (let i = 0; i < wordWidths.length; i++) {
            xPositions.push(x + wordWidths[i] / 2);
            x += wordWidths[i] + WORD_GAP;
          }

          // Render subtitle
          subtitleRef().removeChildren();
          subtitleRef().add(
            <Rect width={totalWidth + 40} height={80} fill="#1fa647" radius={16} x={0} y={0} zIndex={30} />
          );
          let fontfamily =  style.fontFamily.split("px ")[1];
          sub.line.forEach((w, idx) => {
            subtitleRef().add(
              <Txt
                text={w.word}
                fontSize={style.fontSize}
                fontFamily={fontfamily}
                fill={idx === wIdx ? style.highlightColor : style.normalColor}
                fontWeight={idx === wIdx ? 700 : 400}
                shadowColor="#000"
                shadowBlur={4}
                zIndex={40}
                x={xPositions[idx]}
              />
            );
          });

          yield* waitFor(duration);
        }

        subtitleRef().removeChildren();
        currentTime = sub.end;
      }
    }
  }
    // Wait for asset duration (minus fade out)
    const visibleDuration = asset.end - currentTime;
    const waitDuration = fadeEnabled ? visibleDuration - fadeTime : visibleDuration;
    if (waitDuration > 0) {
      yield* waitFor(waitDuration);
    }

    // Fade out
    if (fadeEnabled) {
      yield* mediaRef().opacity(0, fadeTime);
    } else {
      mediaRef().opacity(0);
    }

    mediaRef().remove();
    currentTime = asset.end;
  }

});

// import { useScene } from '@revideo/core';

// export default makeScene2D("SCENE2", function* (view) {
//   const usernasme = useScene().variables.get('username', 'Guest');
//   const words = useScene().variables.get('words', []);
//   const assets = useScene().variables.get('assets', []);
//   const options = useScene().variables.get('options', {});

//   console.log("username:", usernasme());
//   console.log("WORDS:", words());
//   console.log("ASSETS:", assets());
//   console.log("OPTIONS:", options());

//   // return (
//   //   <div>{words.map((w, i) => <p key={i}>{w.word}</p>)}</div>
//   // );
// })
