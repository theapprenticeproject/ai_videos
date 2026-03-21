import * as path from 'path';
import {renderVideo} from '@revideo/renderer'; //
import { use } from 'react';

export async function renderPersonalizedVideo(params: {
  user_video_id: string;
  words: { word: string; start: number; end: number }[];
  assets: { path: string; type: string; start: number; end: number }[];
  options: {
    animation?: boolean;
    vidGen?: string;
    subtitles:boolean,
    wordsPerLine: number;
    subtitleStyle: { fontSize: number; highlightColor: string; normalColor: string };
    logoUrl: string;
    audioUrl: string;
  };
}) {
  console.log("params ", params);
  //const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
  // C:\Users\chawl\Desktop\PRESENT\Interhips\C4GT-The Apprentice Project\Deployment\saas2-prod\revideo\render.ts
  // let projectFilePath = "/Users/chawl/Desktop/PRESENTInterhips/C4GT-The Apprentice Project/Deployment/saas2-prod/revideo/p2_project.ts"
let projectFilePath =  path.resolve(process.cwd(),'revideo/p2_project.ts');
// projectFilePath = "/" + projectFilePath.replace(/\\/g,"/").slice(1);
projectFilePath = "/" + projectFilePath.replace(/\\/g,"/");
console.log("prject file path is : ", projectFilePath);

  await renderVideo({
    projectFile: projectFilePath,
    variables: {
      username: params.user_video_id,
      words: JSON.stringify(params.words),
      assets: JSON.stringify(params.assets),
      options: JSON.stringify(params.options),
    },
    settings: {
      outFile: `video-${params.user_video_id}.mp4`,
      outDir: './public',
         workers: 1,
      // workers: 4,
puppeteer:{
args:['--no-sandbox','--disable-setuid-sandbox'],
},
    },
  });

  console.log(`Video for ${params.user_video_id} rendered successfully! with path as video-${params.user_video_id}.mp4`);
}





// ✅ Example usage
// (async () => {
//   await renderPersonalizedVideo({
//     user_video_id: 'Alice',
//     words: [
// ✅ Example usage
// (async () => {
//   await renderPersonalizedVideo({
//     user_video_id: 'Alice',
//     words: [
//       { word: "Hello", start: 0, end: 1 }//       { word: "from", start: 1, end: 2 },
//       { word: "Revideo!", start: 2, end: 3 }
//     ],
//     assets: [
//       {
//         path: "../downloads/pexels-photo-1983032.jpeg",
//         type: "image",
//         start: 0,
//         end: 6
//       },
//       {
//         path: "./test_video.mp4",
//         type: "video",
//         start: 6,
//         end: 10
//       }
//     ],
//     options: {
//       wordsPerLine: 2,
//       subtitleStyle: {
//         fontSize: 60,
//         highlightColor: "#FF0",
//         normalColor: "#FFF"
//       },
//       logoUrl: "https://cdn.pixabay.com/photo/2019/11/23/10/31/sea-of-clouds-4646744_1280.jpg",
//       audioUrl: "https://revideo-example-assets.s3.amazonaws.com/chill-beat-2.mp3"
//     }
//   });
// })();
