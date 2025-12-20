// To run this code you need to install the following dependencies:
// npm install @google/genai
// npm install -D @types/node

import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { writeFile } from 'fs';
import { promisify } from 'util';
import { GOOGLE_API_KEY } from '../constant';

const writeFileAsync = promisify(writeFile);

export async function generateImagen4Image(prompt: string): Promise<string | null> {
    try {
        const ai = new GoogleGenAI({
            apiKey: GOOGLE_API_KEY,
        });

        const response = await ai.models.generateImages({
            model: 'models/imagen-4.0-generate-001',
            // model: 'models/imagen-3.0-generate-002',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                personGeneration: PersonGeneration.ALLOW_ALL,
                aspectRatio: '16:9',
                // imageSize: '1K', // keeping commented as per original if it was optional or default
            },
        });

        if (!response?.generatedImages || response.generatedImages.length === 0) {
            console.error('No images generated from Imagen 4.');
            return null;
        }

        const image = response.generatedImages[0];
        if (!image.image?.imageBytes) {
            console.error('No image bytes from Imagen 4.');
            return null;
        }

        const timestamp = Date.now();
        const randomId = Math.floor(Math.random() * 10000);
        const fileName = `public/generated_imagen4_${timestamp}_${randomId}.jpeg`;

        const inlineData = image.image.imageBytes;
        const buffer = Buffer.from(inlineData || '', 'base64');

        await writeFileAsync(fileName, buffer);
        console.log(`File ${fileName} saved to file system.`);

        return fileName;

    } catch (error) {
        console.error("Error in generateImagen4Image:", error);
        return null;
    }
}
