import fs from 'fs';
import path from 'path';
import { renderPersonalizedVideo } from '../revideo/render';

/**
 * Directly tests the Revideo rendering function using data from debug_render_data.json.
 * Run with: npx tsx scripts/test-revideo-direct.ts
 */
async function testDirectRender() {
  const debugFilePath = path.resolve(process.cwd(), 'debug_render_data.json');

  if (!fs.existsSync(debugFilePath)) {
    console.error(`❌ Error: ${debugFilePath} not found.`);
    process.exit(1);
  }

  console.log(`📖 Reading debug data from: ${debugFilePath}`);
  const rawData = fs.readFileSync(debugFilePath, 'utf8');
  const data = JSON.parse(rawData);

  // Normalize asset paths: strip any directory prefix, keep just filename.
  // Revideo's Vite server serves public/ at root, so "/file.png" or "file.png" works.
  const params = {
    user_video_id: data.user_video_id + "_direct_test",
    words: data.words,
    assets: data.assets.map((asset: any) => {
      if (asset.path && asset.path.includes('http')) return asset;
      let p = asset.path || '';
      // If path starts with public or /, use it as is (just normalize slashes for browser compatibility)
      if (p.startsWith('public') || p.startsWith('/')) {
        return { ...asset, path: p.replace(/\\/g, '/') };
      }
      return { ...asset, path: '/' + path.basename(p) };
    }),
    options: {
      ...data.options,
      logoUrl: data.options.logoUrl ? (data.options.logoUrl.startsWith('public') || data.options.logoUrl.startsWith('/') ? data.options.logoUrl.replace(/\\/g, '/') : '/' + path.basename(data.options.logoUrl)) : undefined,
      audioUrl: data.options.audioUrl ? (data.options.audioUrl.startsWith('public') || data.options.audioUrl.startsWith('/') ? data.options.audioUrl.replace(/\\/g, '/') : '/' + path.basename(data.options.audioUrl)) : undefined
    }
  };

  console.log(`🎬 Starting direct render for: ${params.user_video_id}`);
  console.log(`📂 Assets (first 2):`, JSON.stringify(params.assets.slice(0, 2), null, 2));
  console.log(`🔊 Audio URL: ${params.options.audioUrl}`);

  try {
    await renderPersonalizedVideo(params);
    console.log(`\n✅ Direct render completed successfully!`);
    console.log(`📄 Check public/video-${params.user_video_id}.mp4`);
  } catch (error) {
    console.error(`\n❌ Direct render failed:`, error);
    process.exit(1);
  }
}

testDirectRender();
