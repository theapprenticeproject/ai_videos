import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public');
  try {
    const files = fs.readdirSync(publicDir);
    const videos = files.filter(file => file.endsWith('.mp4'));
    return NextResponse.json({ videos });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read videos' }, { status: 500 });
  }
}
