import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public');
  const jobsPath = path.join(process.cwd(), 'temp', 'jobs.json');
  const galleryDbPath = path.join(publicDir, 'final_videos.json');
  
  try {
    let dbVideos: any[] = [];
    if (fs.existsSync(galleryDbPath)) {
      try {
        dbVideos = JSON.parse(fs.readFileSync(galleryDbPath, 'utf8'));
      } catch (e) {
        console.error("Failed to parse final_videos.json:", e);
      }
    }

    const files = fs.readdirSync(publicDir);
    const localVideoFiles = files.filter(file => file.endsWith('.mp4'));
    
    let jobs = {};
    if (fs.existsSync(jobsPath)) {
      jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    }

    const localVideos = localVideoFiles.map(filename => {
      // Find the job that produced this video
      const jobEntry = Object.values(jobs).find((j: any) => j.videoUrl === filename) as any;
      
      return {
        filename,
        gcsUrl: null,
        prompt: jobEntry?.prompt || jobEntry?.params?.prompt || null,
        chunks: jobEntry?.chunks || null,
        createdAt: jobEntry?.finishedAt || 0,
      };
    }).filter(v => v.prompt || (v.chunks && v.chunks.length > 0));

    // Dedup: if dbVideos already has the filename (even if deleted locally), keep the db one
    const mergedVideos = [...dbVideos];
    const dbFilenames = new Set(dbVideos.map(v => v.filename));
    
    for (const lv of localVideos) {
      if (!dbFilenames.has(lv.filename)) {
        mergedVideos.push(lv);
      }
    }

    // Sort by latest createdAt if available
    mergedVideos.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ videos: mergedVideos });
  } catch (error) {
    console.error('Failed to read videos or jobs:', error);
    return NextResponse.json({ error: 'Failed to read videos' }, { status: 500 });
  }
}
