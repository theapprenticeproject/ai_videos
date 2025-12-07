// import { renderVideo } from '@revideo/renderer';

import * as path from 'path';

// Using path.posix to normalize the path

// export async function main() {
//   const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
//   await renderVideo({
//     projectFile: projectFilePath,
//     settings: {    workers: 3, outFile: 'output.mp4', logProgress: true }
//   });
// }

// main().catch(err => {
//   console.error('Video rendering failed:', err);
//   process.exit(1);
// });
// import { renderVideo } from '@revideo/renderer';

// export async function main() {
//   const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
//   // const projectFilePath = 'revideo/p2_project.ts'
//   console.log(projectFilePath)
//   await renderVideo({
//     projectFile: projectFilePath,
    // variables: {
    //   words: [
    //     { word: "Hello", start: 0, end: 1 },
    //     { word: "from", start: 1, end: 2 },
    //     { word: "Revideo!", start: 2, end: 3 }
    //   ],
    //   assets: [
    //     {
    //       path: "https://cdn.pixabay.com/photo/2025/06/11/22/12/kackar-mountains-9655201_1280.jpg",
    //       type: "image",
    //       start: 0,
    //       end: 6
    //     },
    //     {
    //       path: "./test_video.mp4",
    //       type: "video",
    //       start: 6,
    //       end: 29
    //     }
    //   ],
    //   options: {
    //     wordsPerLine: 2,
    //     subtitleStyle: {
    //       fontSize: 60,
    //       highlightColor: "#FF0",
    //       normalColor: "#FFF"
    //     },
    //     logoUrl: "https://cdn.pixabay.com/photo/2019/11/23/10/31/sea-of-clouds-4646744_1280.jpg",
    //     audioUrl: "https://revideo-example-assets.s3.amazonaws.com/chill-beat-2.mp3"
    //   }
    // },
  //   settings: {
  //     outFile: 'video.mp4',
  //     logProgress: true
  //   }
  // });
//   console.log("Video rendered to video.mp4");
// }

// main();

// import { renderVideo } from "@revideo/renderer";;

// export async function renderRevideoProject(variables: any, outputFile: string) {
//   console.log("var ", variables)
//   const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
//   await renderVideo({
//     projectFile: projectFilePath,
//     variables,   // passed in as argument
//     settings: {
//       outFile: "video.mp4",
//       logProgress: true
//     }
//   });
//   return outputFile;
// }


import {renderVideo} from '@revideo/renderer'; //
import { use } from 'react';


// export async function renderPersonalizedVideo(name: string) {
//   const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
//   await renderVideo({
//     projectFile: projectFilePath,
//     variables: {
//       username:name,
//       words: JSON.stringify([
//         { word: "Hello", start: 0, end: 1 },
//         { word: "from", start: 1, end: 2 },
//         { word: "Revideo!", start: 2, end: 3 }
//       ]),
//       assets: JSON.stringify([
//         {
//           path: "../downloads/pexels-photo-1983032.jpeg",
//           type: "image",
//           start: 0,
//           end: 6
//         },
//         {
//           path: "./test_video.mp4",
//           type: "video",
//           start: 6,
//           end: 10
//         }
//       ]),
//       options: JSON.stringify({
//         wordsPerLine: 2,
//         subtitleStyle: {
//           fontSize: 60,
//           highlightColor: "#FF0",
//           normalColor: "#FFF"
//         },
//         logoUrl: "https://cdn.pixabay.com/photo/2019/11/23/10/31/sea-of-clouds-4646744_1280.jpg",
//         audioUrl: "https://revideo-example-assets.s3.amazonaws.com/chill-beat-2.mp3"
//       })
//     }, // Pass the dynamic name here
//     settings: {
//       outFile: `video-${name}.mp4`, // Specify the output filename here
//       outDir: './output', // Optional: Specify an output directory
//       workers: 3, // Adjust the number of workers as needed
//     },
//   });

//   console.log(`Video for ${name} rendered successfully!`);
// }

// (async () => {
//   await renderPersonalizedVideo('Alice');
//   // await renderPersonalizedVideo('Bob');
// })();


//export async function renderPersonalizedVideo(params: {
  //user_video_id: string;
  //words: { word: string; start: number; end: number }[];
  //assets: { path: string; type: string; start: number; end: number }[];
 // options: {
   // subtitles:boolean,
   // wordsPerLine: number;
   // subtitleStyle: { fontSize: number; highlightColor: string; normalColor: string };
    //logoUrl: string;
   // audioUrl: string;
  //};
//}) {
  //console.log("params ", params);
  //const projectFilePath = path.posix.resolve(__dirname, '..', 'revideo', 'p2_project.ts');
//let projectFilePath = path.resolve(process.cwd(),'revideo/p2_project.ts');
//projectFilePath = "/" + projectFilePath.replace(/\\/g,"/").slice(1);

  //await renderVideo({
    //projectFile: projectFilePath,
   // variables: {
     // username: params.user_video_id,
     // words: JSON.stringify(params.words),
     // assets: JSON.stringify(params.assets),
     // options: JSON.stringify(params.options),
   // },
   // settings: {
     // outFile: `video-${params.user_video_id}.mp4`,
     // outDir: './public',
     // workers: 1,
//puppeteer:{
//args:['--no-sandbox','--disable-setuid-sandbox'],
//},
  //  },
 // });

 // console.log(`Video for ${params.user_video_id} rendered successfully! with path as video-${params.user_video_id}.mp4`);
//}

//   console.log(`Video for ${name} rendered successfully!`);
// }

// (async () => {
//   await renderPersonalizedVideo('Alice');
//   // await renderPersonalizedVideo('Bob');
// })();


export async function renderPersonalizedVideo(params: {
  user_video_id: string;
  words: { word: string; start: number; end: number }[];
  assets: { path: string; type: string; start: number; end: number }[];
  options: {
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
      workers: 4,
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
