import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { buildDefaultVideoDescription, buildDefaultVideoTitle, normalizeVideoRecord, readVideoLibrary, writeVideoLibrary } from '../../utils/videoLibrary';

export const dynamic = 'force-dynamic';

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const matchesSearch = (video: any, query: string) => {
  if (!query) return true;
  const haystack = [
    video.title,
    video.description,
    video.prompt,
    video.script,
    video.filename,
    video.modelName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = normalizeString(searchParams.get('search'));
  const userId = normalizeString(searchParams.get('userId'));
  const onlyMine = searchParams.get('onlyMine') === 'true';

  const publicDir = path.join(process.cwd(), 'public');
  const jobsPath = path.join(process.cwd(), 'temp', 'jobs.json');

  try {
    const dbVideos = readVideoLibrary().map(normalizeVideoRecord);
    const files = fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [];
    const localVideoFiles = files.filter((file) => file.endsWith('.mp4'));

    let jobs: Record<string, any> = {};
    if (fs.existsSync(jobsPath)) {
      jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    }

    const localVideos = localVideoFiles
      .map((filename) => {
        const jobEntry = Object.values(jobs).find((j: any) => j.videoUrl === filename) as any;
        return normalizeVideoRecord({
          id: jobEntry?.jobId || filename,
          filename,
          gcsUrl: null,
          prompt: jobEntry?.prompt || jobEntry?.params?.prompt || null,
          script: jobEntry?.script || jobEntry?.params?.script || null,
          chunks: jobEntry?.chunks || null,
          createdAt: jobEntry?.finishedAt || jobEntry?.createdAt || 0,
          userId: jobEntry?.userId || 'anonymous',
          title: jobEntry?.title || buildDefaultVideoTitle(jobEntry?.prompt || jobEntry?.params?.prompt || filename),
          description: jobEntry?.description || buildDefaultVideoDescription(jobEntry?.script || jobEntry?.params?.script || jobEntry?.prompt || ''),
          modelName: jobEntry?.params?.modelName || '',
        });
      })
      .filter((video) => video.prompt || (video.chunks && video.chunks.length > 0));

    const mergedVideos = [...dbVideos];
    const seenKeys = new Set(mergedVideos.map((video) => video.id || video.filename));

    for (const localVideo of localVideos) {
      const key = localVideo.id || localVideo.filename;
      if (!seenKeys.has(key)) {
        mergedVideos.push(localVideo);
      }
    }

    const filteredVideos = mergedVideos
      .filter((video) => !onlyMine || !userId || video.userId === userId)
      .filter((video) => matchesSearch(video, search))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ videos: filteredVideos });
  } catch (error) {
    console.error('Failed to read videos or jobs:', error);
    return NextResponse.json({ error: 'Failed to read videos' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = normalizeString(body?.id);
    const title = normalizeString(body?.title);
    const description = normalizeString(body?.description);
    const publicDir = path.join(process.cwd(), 'public');
    const jobsPath = path.join(process.cwd(), 'temp', 'jobs.json');

    if (!id) {
      return NextResponse.json({ error: 'Missing video id' }, { status: 400 });
    }

    const videos = readVideoLibrary();
    let index = videos.findIndex((video) => video.id === id || video.filename === id);

    if (index === -1) {
      let jobs: Record<string, any> = {};
      if (fs.existsSync(jobsPath)) {
        jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
      }
      const jobEntry = jobs[id] || Object.values(jobs).find((job: any) => job?.jobId === id || job?.videoUrl === id);
      const filename = normalizeString(body?.filename) || normalizeString((jobEntry as any)?.videoUrl) || id;
      const gcsUrl = normalizeString(body?.gcsUrl) || normalizeString((jobEntry as any)?.videoUrl);

      if (!filename && !gcsUrl) {
        return NextResponse.json({ error: 'Video not found in gallery library' }, { status: 404 });
      }

      const localCandidatePath = path.join(publicDir, filename);
      if (filename && !gcsUrl && !fs.existsSync(localCandidatePath)) {
        return NextResponse.json({ error: 'Video not found in gallery library' }, { status: 404 });
      }

      videos.push(normalizeVideoRecord({
        id,
        filename,
        gcsUrl: gcsUrl || null,
        prompt: normalizeString((jobEntry as any)?.prompt) || normalizeString((jobEntry as any)?.params?.prompt),
        script: normalizeString((jobEntry as any)?.script) || normalizeString((jobEntry as any)?.params?.script),
        chunks: Array.isArray((jobEntry as any)?.chunks) ? (jobEntry as any).chunks : [],
        createdAt: (jobEntry as any)?.finishedAt || (jobEntry as any)?.createdAt || Date.now(),
        userId: normalizeString((jobEntry as any)?.userId) || 'anonymous',
      }));
      index = videos.length - 1;
    }

    videos[index] = normalizeVideoRecord({
      ...videos[index],
      id: videos[index].id || id,
      title: title || buildDefaultVideoTitle(videos[index].prompt || videos[index].filename),
      description,
    });

    writeVideoLibrary(videos);

    return NextResponse.json({ video: videos[index] });
  } catch (error) {
    console.error('Failed to update video metadata:', error);
    return NextResponse.json({ error: 'Failed to update video metadata' }, { status: 500 });
  }
}
