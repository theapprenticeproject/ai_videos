import fs from "fs";
import path from "path";

export type StoredVideoRecord = {
  id?: string;
  filename: string;
  gcsUrl?: string | null;
  prompt?: string | null;
  script?: string | null;
  chunks?: any[] | null;
  createdAt?: number;
  userId?: string | null;
  title?: string | null;
  description?: string | null;
  modelName?: string | null;
};

const getGalleryDbPath = () => path.join(process.cwd(), "public", "final_videos.json");

export function readVideoLibrary(): StoredVideoRecord[] {
  const galleryDbPath = getGalleryDbPath();
  if (!fs.existsSync(galleryDbPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(galleryDbPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[videoLibrary] Failed to read final_videos.json", error);
    return [];
  }
}

export function writeVideoLibrary(records: StoredVideoRecord[]) {
  const galleryDbPath = getGalleryDbPath();
  fs.writeFileSync(galleryDbPath, JSON.stringify(records, null, 2));
}

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export function buildDefaultVideoTitle(input?: string | null) {
  const cleaned = normalizeWhitespace(input || "");
  if (!cleaned) {
    return "Untitled Video";
  }
  return cleaned.length > 80 ? `${cleaned.slice(0, 77).trim()}...` : cleaned;
}

export function buildDefaultVideoDescription(input?: string | null) {
  const cleaned = normalizeWhitespace(input || "");
  if (!cleaned) {
    return "";
  }
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

export function normalizeVideoRecord(record: StoredVideoRecord): StoredVideoRecord {
  const fallbackTitleSource = record.title || record.prompt || record.filename;
  const fallbackDescriptionSource = record.description || record.script || record.prompt || "";

  return {
    ...record,
    id: record.id || record.filename,
    gcsUrl: record.gcsUrl || null,
    prompt: record.prompt || "",
    script: record.script || "",
    chunks: Array.isArray(record.chunks) ? record.chunks : [],
    createdAt: record.createdAt || Date.now(),
    userId: record.userId || "anonymous",
    title: buildDefaultVideoTitle(fallbackTitleSource),
    description: buildDefaultVideoDescription(fallbackDescriptionSource),
    modelName: record.modelName || "",
  };
}

export function upsertVideoRecord(record: StoredVideoRecord) {
  const records = readVideoLibrary();
  const normalized = normalizeVideoRecord(record);
  const targetIndex = records.findIndex((item) =>
    item.id === normalized.id ||
    item.filename === normalized.filename ||
    (normalized.gcsUrl && item.gcsUrl === normalized.gcsUrl)
  );

  if (targetIndex >= 0) {
    records[targetIndex] = normalizeVideoRecord({
      ...records[targetIndex],
      ...normalized,
    });
  } else {
    records.push(normalized);
  }

  writeVideoLibrary(records);
  return normalized;
}
