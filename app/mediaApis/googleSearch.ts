
import axios from "axios";
import {GOOGLE_SEARCH_API_KEY,GOOGLE_SEARCH_CXID} from "../constant";

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const CX_ID = GOOGLE_SEARCH_CXID;

export interface YouTubeImage {
  title: string;
  imageUrl: string;
  contextLink: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mime: string;
  source: string;
}

interface GoogleCSEItem {
  title: string;
  link: string;
  displayLink: string;
  mime: string;
  image: {
    contextLink: string;
    width: number;
    height: number;
    byteSize: number;
    thumbnailLink: string;
  };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
}

export async function searchYouTubeImages(
  query: string,
  limit = 5
): Promise<YouTubeImage[]> {
  const apiKey = GOOGLE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_CSE_API_KEY");

  const { data } = await axios.get<GoogleCSEResponse>(
    GOOGLE_CSE_ENDPOINT,
    {
      params: {
        key: apiKey,
        cx: CX_ID,
        q: query,
        searchType: "image",
        num: 10,
        imgSize: "xlarge",
        imgType: "photo",
        safe: "active",
      },
    }
  );

  console.log(data)

  if (!data.items) return [];

  return data.items
    .filter((item) => {
      const { width, height } = item.image;

      // ✅ Landscape only
      if (width <= height) return false;

      // ✅ YouTube resolution
      if (width < 1280 || height < 720) return false;

      // ❌ Remove Pinterest (low quality / rehosted)
      if (item.displayLink.includes("pinterest")) return false;

      return true;
    })
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      imageUrl: item.link,
      contextLink: item.image.contextLink,
      thumbnailUrl: item.image.thumbnailLink,
      width: item.image.width,
      height: item.image.height,
      fileSize: item.image.byteSize,
      mime: item.mime,
      source: item.displayLink,
    }));
}

// (async () => {
//   const images = await searchYouTubeImages(
//     "ai technology background futuristic"
//   );

//   console.log(images);
// })();
