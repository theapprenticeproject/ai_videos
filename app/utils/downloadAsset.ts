// // downloadFile.ts
// import * as fs from 'fs';
// import * as path from 'path';
// import * as http from 'http';
// import * as https from 'https';
// import { URL } from 'url';

// type FileType = 'image' | 'video' | 'audio' | 'document' | 'other';

// const EXT_TYPE_MAP: Record<string, FileType> = {
//   // Images
//   '.jpg': 'image',
//   '.jpeg': 'image',
//   '.png': 'image',
//   '.gif': 'image',
//   '.webp': 'image',
//   '.bmp': 'image',
//   '.svg': 'image',
//   // Videos
//   '.mp4': 'video',
//   '.webm': 'video',
//   '.mov': 'video',
//   '.avi': 'video',
//   '.mkv': 'video',
//   '.flv': 'video',
//   // Audio
//   '.mp3': 'audio',
//   '.wav': 'audio',
//   '.aac': 'audio',
//   '.ogg': 'audio',
//   // Documents
//   '.pdf': 'document',
//   '.doc': 'document',
//   '.docx': 'document',
//   '.txt': 'document',
//   '.json': 'document'
// };

// function detectFileType(filename: string): FileType {
//   const ext = path.extname(filename).toLowerCase();
//   return EXT_TYPE_MAP[ext] || 'other';
// }

// export async function downloadFile(
//   fileUrl: string,
//   destFolder: string = './public'
// ): Promise<{ path: string; type: FileType }> {
//   return new Promise((resolve, reject) => {
//     try {
//       // Parse URL and filename
//       const urlObj = new URL(fileUrl);
//       const filename = path.basename(urlObj.pathname);
//       const fileType = detectFileType(filename);

//       // Ensure destination folder exists
//       fs.mkdirSync(destFolder, { recursive: true });

//       const destPath = path.join(destFolder, filename);
//       const fileStream = fs.createWriteStream(destPath);

//       const protocol = urlObj.protocol === 'https:' ? https : http;

//       protocol.get(fileUrl, response => {
//         if (response.statusCode && response.statusCode >= 400) {
//           reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`));
//           return;
//         }
//         response.pipe(fileStream);

//         fileStream.on('finish', () => {
//           fileStream.close();
//           resolve({ path: filename, type: fileType });
//         });
//       }).on('error', err => {
//         fs.unlink(destPath, () => {});
//         reject(err);
//       });
//     } catch (err) {
//       reject(err);
//     }
//   });
// }

// downloadFile.ts
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

type FileType = 'image' | 'video' | 'audio' | 'document' | 'other';

const EXT_TYPE_MAP: Record<string, FileType> = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image', '.bmp': 'image', '.svg': 'image',
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video', '.flv': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.aac': 'audio', '.ogg': 'audio',
  '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document', '.json': 'document'
};

function detectFileType(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TYPE_MAP[ext] || 'other';
}

interface DownloadResult {
  path: string;
  type: FileType;
}

export async function downloadFile(
  fileUrl: string,
  destFolder: string = './public',
  customFilename?: string
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(fileUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const filename = customFilename || path.basename(urlObj.pathname.split('?')[0]);
    const fileType = detectFileType(filename);
    const destPath = path.join(destFolder, filename);

    // Create destination folder
    fs.mkdirSync(destFolder, { recursive: true });

    const requestOptions: https.RequestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': urlObj.origin
      }
    };

    const makeRequest = (url: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const req = protocol.get(url, requestOptions, response => {
        // Redirect handling
        if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
          const location = response.headers.location;
          if (location) {
            const newUrl = new URL(location, urlObj).toString();
            makeRequest(newUrl, redirectCount + 1);
            return;
          }
        }

        // Error status
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        const fileStream = fs.createWriteStream(destPath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ path: destPath, type: fileType });
        });
      });

      req.on('error', err => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    makeRequest(fileUrl);
  });
}

// // Example usage:
// (async () => {
//   const fileUrl = 'https://cdn-magnific.freepik.com/result_FLUX_DEV_5c0d9d87-a411-4467-9527-0cc3ef872a13_0.jpeg?token=exp=1753451689~hmac=ea48b5279bc7ac66d162e6ca15197f314901b1ac54f8be22cce0acd915bee737';
//   const result = await downloadFile(fileUrl, './assets');
//   console.log(JSON.stringify(result, null, 2));
// })();

 