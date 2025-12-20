// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import { writeFile, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { GOOGLE_API_KEY } from '../constant';

// Function to save the binary data as a file
function saveBinaryFile(fileName: string, content: Buffer, directory: string) {
    const filePath = path.join(directory, fileName);
    writeFile(filePath, content, 'utf8', (err) => {
        if (err) {
            console.error(`Error writing file ${fileName}:`, err);
            return;
        }
        console.log(`File ${fileName} saved to ${directory}.`);
    });
}

// Main function to interact with Google Gen AI API
async function generateContent(prompt: string, fileName: string, directory: string) {
    const ai = new GoogleGenAI({
        apiKey:GOOGLE_API_KEY,
    });

    const tools = [
        {
            googleSearch: {},
        },
    ];

    const config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
            imageSize: '1K',
        },
        tools,
    };

    const model = 'gemini-3-pro-image-preview';

    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: prompt,  // Use the dynamic prompt
                },
            ],
        },
    ];

    try {
        // Generate content using the GenAI model
        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        let fileIndex = 0;
        // Iterate over the generated response chunks
        for await (const chunk of response) {
            if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
                continue;
            }

            if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                const inlineData = chunk.candidates[0].content.parts[0].inlineData;
                const fileExtension = mime.getExtension(inlineData.mimeType || '');
                const buffer = Buffer.from(inlineData.data || '', 'base64');

                // Generate a unique file name and save the binary file
                const uniqueFileName = `${fileName}_${fileIndex++}.${fileExtension}`;
                saveBinaryFile(uniqueFileName, buffer, directory);
            } else {
                console.log(chunk.text);
            }
        }
    } catch (error) {
        console.error('Error generating content:', error);
    }
}

// Example usage: Prompt, File Name, Directory
// const prompt = `
//   TYPE: Animated for kids explainer
//   Scene: Split Screen.

//   Left: A friendly-looking man, Mr. Gupta, busy arranging clothes in a modest retail shop.

//   Right: A woman, Meena, writing on a blackboard in a classroom filled with children.
// `;

// const fileName = "generated_file";  // Base name for files
// const directory = "./generated_images";  // Directory to save files

// // Ensure the directory exists or create it
// if (!existsSync(directory)) {
//     mkdirSync(directory);
// }

// // Call the function to generate and save content
// generateContent(prompt, fileName, directory);
