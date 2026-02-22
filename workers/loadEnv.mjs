import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env.local first (overriding .env) to match Next.js behavior
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

console.log('[env] Environment variables loaded from .env.local and .env');
if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_LLM_API_KEY) {
  console.warn('[env] WARNING: No LLM API keys found in environment!');
}
