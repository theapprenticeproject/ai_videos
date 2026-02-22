export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Environment Management ──────────────────────────────────────────────────

// We only want to load dotenv if we're running in a Node.js environment (standalone script or server-side).
// Browsers don't have 'process.stdout' so dotenv's ANSI detection fails.
if (typeof window === "undefined") {
  const loadEnv = async () => {
    try {
      const dotenv = await import("dotenv");
      const path = await import("path");
      const { fileURLToPath } = await import("url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const ROOT = path.resolve(__dirname, "..");
      
      dotenv.config({ path: path.join(ROOT, ".env.local") });
      dotenv.config({ path: path.join(ROOT, ".env") });
    } catch (e) {
      // If any of the above fails (e.g. bundling environment), we skip manual loading
    }
  };
  loadEnv();
}

const DEFAULT_KEY = (typeof process !== "undefined" ? (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_LLM_API_KEY) : "") || "";

// ─── Types ───────────────────────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string;
};

type StructureSchema = {
  type: string;
  properties?: {
    [key: string]: {
      type: string;
      description?: string;
    };
  };
  items?: any;
  required?: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function convertToGeminiMessages(
  systemPrompt: string,
  otherPrompts: Message[],
  prompt: string
) {
  const messages = [...otherPrompts, { role: "user", content: prompt }];
  if (systemPrompt) {
    const firstUser = messages.find(m => m.role === "user");
    if (firstUser) {
      firstUser.content = systemPrompt + "\n\n" + firstUser.content;
    } else {
      messages.unshift({ role: "user", content: systemPrompt });
    }
  }
  return messages.map(m => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: [{ text: m.content }]
  }));
}

// ─── Core LLM Functions ──────────────────────────────────────────────────────

/** Basic Gemini chat call (returns plain text) */
export async function callLlm(
  apiKey: string = DEFAULT_KEY,
  systemPrompt: string,
  prompt: string,
  otherPrompts: Message[] = [],
  model: string = "gemini-2.0-flash-lite"
): Promise<string> {
  console.log(`[llm] Calling Gemini model: "${model}"`);
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

  const body = {
    contents: convertToGeminiMessages(systemPrompt, otherPrompts, prompt),
  };

  await sleep(1000); // Subtle throttle

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error(`[llm] Failed to parse JSON response. Status: ${response.status}. Raw body:`, text);
    throw new Error(`Invalid JSON response from Gemini API: ${text.substring(0, 100)}...`);
  }

  if (!response.ok) {
    throw new Error(`Gemini API Error (${response.status}): ${JSON.stringify(data)}`);
  }

  if (!data.candidates?.[0]?.content?.parts) {
    throw new Error(`Unexpected Gemini response structure: ${JSON.stringify(data)}`);
  }

  return data.candidates[0].content.parts.map((p: any) => p.text).join("");
}

/** Gemini with JSON-structured output */
export async function callStructuredLlm(
  apiKey: string = DEFAULT_KEY,
  systemPrompt: string,
  prompt: string,
  schema: StructureSchema,
  otherPrompts: Message[] = [],
  model: string = "gemini-2.0-flash-lite"
): Promise<any> {
  console.log(`[llm] Calling Structured Gemini model: "${model}"`);
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

  const body = {
    contents: convertToGeminiMessages(systemPrompt, otherPrompts, prompt),
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: schema,
      seed: 30
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error(`[llm] Failed to parse JSON response. Status: ${response.status}. Raw body:`, text);
    throw new Error(`Invalid JSON response from Gemini API: ${text.substring(0, 100)}...`);
  }

  if (!response.ok) {
    throw new Error(`Gemini API Error (${response.status}): ${JSON.stringify(data)}`);
  }

  const resultText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  
  try {
    return JSON.parse(resultText);
  } catch (e) {
    console.warn("[llm] Failed to parse Gemini content as JSON. Returning structured error object.");
    return { parseError: true, raw: resultText, data };
  }
}

// ─── Example usage ───────────────────────────────────────────────────────────

async function testStructured() {
  const apiKey = DEFAULT_KEY;
  if (!apiKey) {
    console.error("ERROR: No API key found. Check .env.local");
    return;
  }
  const schema: StructureSchema = {
    type: "object",
    properties: {
      acid: { type: "string" },
      base: { type: "string" }
    },
    required: ["acid", "base"]
  };
  try {
    console.log("[test] Calling Structured LLM...");
    const res = await callStructuredLlm(apiKey, "Expert chemist.", "Formula for HCl and its base as JSON.", schema);
    console.log("STRUCTURED JSON RESPONSE:\n", JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error("[test] Request failed:", err.message);
  }
}

// Uncomment to run directly with 'node app/llm.ts'
// testStructured();
