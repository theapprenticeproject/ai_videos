export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// gemini-llm.ts
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

// Helper: Convert OpenAI-style messages to Gemini chat format (no 'system' roles)
function convertToGeminiMessages(
  systemPrompt: string,
  otherPrompts: Message[],
  prompt: string
) {
  const messages = [...otherPrompts, { role: "user", content: prompt }];
  // Prepend system prompt to the first user message (Gemini does not allow a 'system' role)
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

// Basic Gemini chat call (returns plain text response)
export async function callLlm(
  apiKey: string,
  systemPrompt: string,
  prompt: string,
  otherPrompts: Message[] = [],
  model: string = "gemini-2.0-flash-lite"
): Promise<string> {
  const body = {
    contents: convertToGeminiMessages(systemPrompt, otherPrompts, prompt),
  };
  let response;
  await sleep(10000); // Optional: delay to avoid rate limits
  try{
  response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  }catch(err){
    sleep(10000);
    return callLlm(apiKey,systemPrompt,prompt);
  }

  const data = await response.json();
  if (!data.candidates?.[0]?.content?.parts) throw new Error(JSON.stringify(data));
  return data.candidates[0].content.parts.map((p: any) => p.text).join("");
}

// Gemini with JSON-structured output
export async function callStructuredLlm(
  apiKey: string,
  systemPrompt: string,
  prompt: string,
  schema: StructureSchema,
  otherPrompts: Message[] = [],
  model: string = "gemini-2.0-flash-lite"
): Promise<any> {
  const body = {
    contents: convertToGeminiMessages(systemPrompt, otherPrompts, prompt),
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: schema,
      seed:30
    }
  };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join("") || "";
  try {
    return JSON.parse(text);
  } catch (e) {
    return { parseError: true, raw: text, data };
  }
}

// --- Example usage ---

// async function testPlain() {
//   const apiKey = "";
//   const res = await callLlm(
//     apiKey,
//     "You are a science tutor.",
//     "Explain why the sky is blue in two short sentences."
//   );
//   console.log("PLAIN TEXT RESPONSE:\n", res);
// }

// async function testStructured() {
//   const apiKey = "";
//   const schema: StructureSchema = {
//     type: "object",
//     properties: {
//       acid: { type: "string", description: "Formula for hydrochloric acid" },
//       base: { type: "string", description: "Formula for its opposite compound" }
//     },
//     required: ["acid", "base"]
//   };
//   const res = await callStructuredLlm(
//     apiKey,
//     "You are an expert chemist.",
//     "Give only the formula for hydrochloric acid and its opposite as JSON.",
//     schema
//   );
//   console.log("STRUCTURED JSON RESPONSE:\n", res);
// }

// // Uncomment to run the tests
// testPlain();
// testStructured();

