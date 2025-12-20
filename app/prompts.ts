// different prompt formulation
// for script writing, keyword extraction, scene json formation (structured output),
// type PromptParams = { [key: string]: Record<string, any> | string | undefined };
import data from '../dynamication.json'

type ScriptClass = "low" | "high";
const scriptFewShot: Record<ScriptClass, string> = {
  low: data.scriptFewShot.low,
  high: data.scriptFewShot.high
};


export function promptFormation(query:string, promptType: string, paramJson: Record<string, any>): string {
  const getClassKey = (cls: any): ScriptClass =>
    cls === "high" ? "high" : "low";

  switch (promptType) {
    case "scriptFormation": {
      const classKey = getClassKey(paramJson.contentclass);
      const context = scriptFewShot[classKey];
   
let fprompt = `
You are an experienced teacher and educational storyteller.

Your task is to write a **natural, spoken narration-only script** for a short educational video on the topic:
"${query}"

LANGUAGE RULE:
- First, understand the language of the topic and example scripts.
- If the topic or examples use Hinglish, write in Hinglish.
- Otherwise, write in clear, simple English.
- Match the same tone, vocabulary level, and flow as the examples.

SCRIPT LENGTH:
- 150 to 250 words (suitable for 30 to 75 seconds of speaking).

TONE & STYLE:
- Sound like a real teacher talking to students.
- Conversational, warm, and engaging.
- Use simple sentences, pauses, and questions.
- Avoid textbook-style explanations and heavy jargon.

STRICT OUTPUT RULE:
- Output ONLY the narration.
- No headings, no bullet points, no labels, no symbols.
- No emojis, hashtags, or special characters.

STRUCTURE (follow naturally, do NOT label sections):

1. Opening Hook:
   - Start with a relatable Indian or real-life situation or question.
   - Make it feel familiar and interesting within the first few lines.

2. Thinking Challenge:
   - Ask one simple question or challenge that makes the listener think.

3. Explanation:
   - Explain the concept step by step in a clear and simple way.
   - Use everyday examples students can relate to.
   - Naturally connect ideas like sustainability, responsibility, problem-solving, or collaboration.
   - Encourage thinking, applying, or imagining real-life use.

4. Closing:
   - End with a short motivating line.
   - Invite reflection, curiosity, or a small mental challenge.

IMPORTANT:
- Do NOT mention SDGs or skills explicitly.
- Blend them naturally into the story.
- The learning should support understanding and application.
- Keep everything smooth, human, and spoken.


`;


// REFERENCE STYLE:
// Use the following example scripts only as a style reference:
// ${context}
console.log("prompt , ",fprompt)
return fprompt; 

}


    // other cases ...

    default:
      return `Generate a prompt for '${promptType}' with data:\n\n${JSON.stringify(paramJson, null, 2)}`;
  }
}



// Follow these detailed guidelines strictly:
// ${context} 

// **Hook (Problem) [~10 seconds]**  
// - Start with a surprising or curious real-world scenario or question related to the topic, ideally an Indian or relatable example.  
// - Keep this section engaging and concise (max 20 seconds), as research shows engagement drops after this.  
// - Quickly lead students toward the “Doing” stage within these first 20 seconds.

// 2. **Hook (Challenge) [~10 seconds]**  
// - Pose a simple, intriguing challenge that invites students to actively participate or think about the topic.

// 3. **Steps to Build / INM Section [~3 minutes 20 seconds]**  
// - Guide students step-by-step to try the activity themselves.  
// - Integrate explanations of concepts, artwork, and skills seamlessly.  
// - Include connections to Sustainable Development Goals (SDGs) and relevant skills naturally within the activity.  
// - Encourage students to tweak, extend, or repeat the experiment.  
// - Use clear, simple language that is inclusive and jargon-free.  
// - Incorporate reflective questions or prompts to encourage thinking, trying, and reflecting.  
// - Ground explanations in real-life context or Indian examples wherever possible.

// 4. **Ending [~20 seconds]**  
// - Close with a short, motivating one-liner encouraging students to take a quiz or submit their artefact.  
// - The ending should reinforce the learning, prompt reflection, and be smooth and simple.

// 5. **Additional notes:**  
// - Use clear learning objectives framed by Bloom’s Taxonomy (e.g., Understand, Apply).  
// - Follow the approved video structure flow: Hook (Problem), Hook (Challenge), INM, Ending.  
// - Avoid separate sections for Skills and SDGs; integrate them into the activity.  
// - Keep the language accessible and culturally relevant.  

// ---

// **Example Scripts:**  
// [Insert 2-3 short example scripts here that model the above structure and style.]

// ---

// Write the script in a conversational, engaging tone suitable for students. Use bullet points or short paragraphs for clarity if needed.

// ---

// `;