// different prompt formulation
// for script writing, keyword extraction, scene json formation (structured output),
// type PromptParams = { [key: string]: Record<string, any> | string | undefined };
import data from '../dynamication.json'

type ScriptClass = "low" | "high";
const scriptFewShot: Record<ScriptClass, string> = {
  low: data.scriptFewShot.low,
  high: data.scriptFewShot.high
};


//const scriptFewShot: Record<ScriptClass, string[]> = {
  //low: [
    // `You are creating a video script for young students. Use a simple story-based example to explain the topic clearly.  
    // Follow the video structure: Hook (Problem), Hook (Challenge), Steps to Build, Ending.  
    // Use easy language and relatable characters or settings that children can imagine easily.  
    // Include reflective questions and encourage trying the activity in a fun way.  
    // Make sure to connect the story to real learning objectives in a simple manner.`
 // ],
 // high: [
   // `You are creating a video script for older students. Use day-to-day examples and real-life relativity to explain the topic clearly.  
    // Follow the video structure: Hook (Problem), Hook (Challenge), Steps to Build, Ending.  
    // Use inclusive and clear language with relevant examples students encounter daily.  
    // Integrate learning objectives based on Bloom’s Taxonomy (Understand, Apply).  
    // Encourage critical thinking, reflection, and practical attempts of the activity.`
 // ]
//};

// const scriptFewShot: Record<ScriptClass, string[]> = {
//   low: [
//     `You are creating a video script for young students. Use a simple story-based example to explain the topic clearly.  
//      Follow the video structure: Hook (Problem), Hook (Challenge), Steps to Build, Ending.  
//      Use easy language and relatable characters or settings that children can imagine easily.  
//      Include reflective questions and encourage trying the activity in a fun way.  
//      Make sure to connect the story to real learning objectives in a simple manner.
     
//      example scripts are (just refer for writing style):
//      "Hello children!
// Welcome to the new activity of Financial Literacy!
// Today's activity is called
// Money Matters"
// "In this activity, we will learn about Budgeting
// We will also learn how
// we can make smart choices
// to save and manage money for our goals 
// Let’s meet the Gupta family
// Mr. Gupta owns a clothing shop

// Meena is a teacher at a school

// And this is their son Rahul
// Rahul studies in 8th standard in a school
// He loves to read books and
// History is his favorite subject

// The Gupta family dreams of visiting the Taj Mahal in 6 months
// But to turn their dream into reality,
// what should they do?
// ..."`
//   ],
//   high: [
//     `You are creating a video script for older students. Use day-to-day examples and real-life relativity to explain the topic clearly.  
//      Follow the video structure: Hook (Problem), Hook (Challenge), Steps to Build, Ending.  
//      Use inclusive and clear language with relevant examples students encounter daily.  
//      Encourage critical thinking, reflection, and practical attempts of the activity.
      
//      example scripts are (just refer for writing style):
//      "Hello everyone!
// Welcome to the new activity of Financial Literacy!

// Aaj hum ek fun challenge karenge
// jiska naam hai 
// The Business Challenge
// Mr. Kumar ek business owner hain 
// jo ek local grocery store chalate hain. 
// Unhe apna business badhana hai aur financially stable rakhna hai.

// Mr. Kumar ko apne business ka cash flow manage karna hai, 
// emergencies ke liye ₹1,000 
// bachaana hai, 
// aur 
// bache paiso ko safe and risky investments mein invest karna hai
// Aapka challenge ye hai ki 
// aap in sabhi points ko dhyaan mein rakhte hue Mr. Kumar ke liye ek financial plan taiyaar karein.
// ...."
//      `
//   ]
// };


export function promptFormation(query:string, promptType: string, paramJson: Record<string, any>): string {
  const getClassKey = (cls: any): ScriptClass =>
    cls === "high" ? "high" : "low";

  switch (promptType) {
    case "scriptFormation": {
      const classKey = getClassKey(paramJson.contentclass);
      const context = scriptFewShot[classKey];
//       return `
//       You are an expert educational content creator. Write a video narration-only on the topic: ${query} 
// generate english/hinglish script as asked.
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

// ${context}
// Note: Provide only the narration. Do not include any headings, tags, formatting, or segment labels.Just narration , no metadata about any part of script.
// Do not make script longer than 0.5-1.25 minutes of narration which is approx 150-250 words.
// and make sure starting and ending are small , focus more on important part.
// Strictly do not add asteriks, bullet, colons , semicolors, or quotes in script.
// `    
let fprompt = `You are an expert educational content creator. Write a narration-only video script on the topic: ${query}.

Check the topic or context to decide the language:

If the query or example scripts are in Hinglish, write the script in Hinglish.

If not, write the script in English.
Always match the language style to the context provided.

Script requirements:

Duration: 0.5 to 1.25 minutes (150–250 words).

Style: Spoken, natural, and engaging — like a teacher or explainer talking directly to students. Use inclusive, age-appropriate language.

Output only the narration — no metadata, no headings, no formatting symbols.

Structure:

Hook (Problem) — Start with a relatable Indian or real-world scenario or question (max 20 seconds). Make it catchy and relevant.

Hook (Challenge) — Ask a simple but intriguing challenge or question that makes students think or try.

Main Section — Concisely explain the concept step-by-step. Use Indian or real-life examples. Integrate Sustainable Development Goals (SDGs) and 21st-century skills naturally into the narration. Avoid technical jargon. Encourage reflection or participation.

Ending — End with a short, motivating line to inspire reflection, a quiz, or a creative response.

Important:
Do not create separate sections for SDGs or skills. Weave them smoothly into the narration.
Align the learning objectives with Bloom’s Taxonomy (e.g., Understand, Apply).
Do not inclide emojis, hashtags, or any special characters.

Use this format and tone consistently, whether the script is in English or Hinglish.

Example scripts:
${context}`
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