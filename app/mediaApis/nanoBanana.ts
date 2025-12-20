// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
    GoogleGenAI,
} from '@google/genai';
import mime from 'mime';
import { writeFile, createWriteStream, unlinkSync, existsSync, readFileSync } from 'fs';
import { promisify } from 'util';
import * as path from 'path';

const writeFileAsync = promisify(writeFile);

import { GEMINI_API_KEY } from '../constant';

// Initialize Gemini Client
const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
});

export async function generateNanoBananaImage(prompt: string): Promise<string | null> {
    try {
        const config = {
            responseModalities: [
                'IMAGE',
            ],
            imageConfig: {
                // '16:9' or '3:2' are standard landscape ratios
                aspectRatio: '16:9',
            },
        };
        let model = 'gemini-2.5-flash-image';

        const contents = [
            {
                role: 'user',
                parts: [
                    {
                        text: prompt,
                    },
                ],
            },
        ];

        const response = await ai.models.generateContentStream({
            model,
            config,
            contents,
        });

        let savedFilePath: string | null = null;

        for await (const chunk of response) {
            if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
                continue;
            }
            if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                const timestamp = Date.now();
                const randomId = Math.floor(Math.random() * 10000);
                const fileName = `public/generated_nano_${timestamp}_${randomId}`;

                const inlineData = chunk.candidates[0].content.parts[0].inlineData;
                const fileExtension = mime.getExtension(inlineData.mimeType || '') || 'png';
                const buffer = Buffer.from(inlineData.data || '', 'base64');

                const fullPath = `${fileName}.${fileExtension}`;
                await writeFileAsync(fullPath, buffer);
                console.log(`File ${fullPath} saved to file system.`);
                savedFilePath = fullPath;
                break;
            }
        }
        return savedFilePath;

    } catch (error) {
        console.error("Error in generateNanoBananaImage:", error);
        return null;
    }
}

export async function generateNanoBananaBatch(prompts: string[]): Promise<Map<string, string>> {
    const resultMap = new Map<string, string>();
    if (prompts.length === 0) return resultMap;

    const timestamp = Date.now();
    const batchFileName = `batch_requests_${timestamp}.jsonl`;
    const batchFilePath = path.join(process.cwd(), batchFileName);
    let resultLocalPath: string | null = null;

    try {
        // 1. Create JSONL file
        const writeStream = createWriteStream(batchFilePath, { flags: 'w' });

        const formattedRequests = prompts.map((prompt, index) => ({
            "key": `req-${index}`,
            "request": {
                "contents": [{
                    "parts": [{ "text": prompt }]
                }],
                "generation_config": {
                    "responseModalities": ["IMAGE"],
                    "imageConfig": {
                        "aspectRatio": "16:9",
                    },
                }
            }
        }));

        for (const req of formattedRequests) {
            writeStream.write(JSON.stringify(req) + '\n');
        }
        writeStream.end();

        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', () => resolve());
            writeStream.on('error', reject);
        });

        console.log(`Created batch file: ${batchFilePath}`);

        // 2. Upload File
        const uploadedFile = await ai.files.upload({
            file: batchFilePath,
            config: { mimeType: 'text/jsonl' }
        });
        console.log(`Uploaded file: ${uploadedFile.name}`);

        if (!uploadedFile.name) {
            throw new Error("Uploaded file name is undefined");
        }

        // 3. Create Batch Job
        const fileBatchJob = await ai.batches.create({
            model: 'gemini-2.5-flash-image',
            src: uploadedFile.name,
            config: {
                displayName: `batch_gen_${timestamp}`,
            }
        });

        if (!fileBatchJob.name) {
            throw new Error("Batch job name is undefined");
        }

        console.log(`Batch job created: ${fileBatchJob.name}`);

        // 4. Poll Status
        let batchJob = await ai.batches.get({ name: fileBatchJob.name });
        const completedStates = new Set([
            'JOB_STATE_SUCCEEDED',
            'JOB_STATE_FAILED',
            'JOB_STATE_CANCELLED',
            'JOB_STATE_EXPIRED',
        ]);

        let attempts = 0;
        // Check state type or cast if needed. Assuming string compatible.
        while (!completedStates.has(batchJob.state as string)) {
            console.log(`Job ${fileBatchJob.name} state: ${batchJob.state}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            if (!fileBatchJob.name) break; // Should not happen
            batchJob = await ai.batches.get({ name: fileBatchJob.name });
            attempts++;
            if (attempts > 60) {
                console.log("Batch job timed out polling (artificial limit).");
                break;
            }
        }

        console.log(`Job finished with state: ${batchJob.state}`);

        if (batchJob.state === 'JOB_STATE_SUCCEEDED' && batchJob.dest?.fileName) {
            const resultFileName = batchJob.dest.fileName;
            resultLocalPath = path.join(process.cwd(), `batch_results_${timestamp}.jsonl`);

            console.log(`Downloading results from: ${resultFileName} to ${resultLocalPath}`);

            await ai.files.download({ file: resultFileName, downloadPath: resultLocalPath });

            let fileContent = "";
            try {
                fileContent = readFileSync(resultLocalPath, 'utf8');
            } catch (readErr) {
                console.error("Failed to read result file:", readErr);
            }

            if (fileContent) {
                // 5. Parse Results
                for (const line of fileContent.split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);

                        let imageBuffer: Buffer | null = null;
                        let extension = 'png';

                        if (parsed.response && parsed.response.candidates && parsed.response.candidates[0].content.parts) {
                            for (const part of parsed.response.candidates[0].content.parts) {
                                if (part.inlineData) {
                                    extension = mime.getExtension(part.inlineData.mimeType || '') || 'png';
                                    imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                                    break;
                                }
                            }
                        }

                        if (imageBuffer && parsed.key) {
                            const reqIndexStr = parsed.key.replace('req-', '');
                            const reqIndex = parseInt(reqIndexStr);

                            // Save File
                            const uniqueId = Math.floor(Math.random() * 100000);
                            const savedFileName = `public/batch_gen_${timestamp}_${reqIndex}_${uniqueId}.${extension}`;
                            await writeFileAsync(savedFileName, imageBuffer);

                            // Map back to prompt
                            if (!isNaN(reqIndex) && reqIndex >= 0 && reqIndex < prompts.length) {
                                resultMap.set(prompts[reqIndex], savedFileName);
                            }
                        }

                    } catch (e) {
                        console.error("Error parsing result line:", e);
                    }
                }
            }

        } else {
            console.error("Batch job failed or did not succeed successfully:", batchJob);
        }

    } catch (error) {
        console.error("Error in generateNanoBananaBatch:", error);
    } finally {
        try {
            if (existsSync(batchFilePath)) {
                unlinkSync(batchFilePath);
                console.log(`Deleted temp file: ${batchFilePath}`);
            }
            if (resultLocalPath && existsSync(resultLocalPath)) {
                unlinkSync(resultLocalPath);
                console.log(`Deleted temp file: ${resultLocalPath}`);
            }
        } catch (cleanupErr) {
            console.warn("Error during file cleanup:", cleanupErr);
        }
    }

    return resultMap;
}
