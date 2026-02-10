
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Helper for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually to support .env.local
// Load .env.local first (higher priority)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
// Load .env (fallback)
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// Ensure public directory exists for outputs
const PUBLIC_DIR = path.resolve(__dirname, '../public');
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

async function main() {
    // Dynamic imports to ensure env vars are loaded first
    const { generateNanoBananaImage, generateNanoBananaBatch } = await import('../app/mediaApis/nanoBanana');
    const { generateFreepikImage, generateFreepikVideo } = await import('../app/mediaApis/freepik');
    const { generateVeoVideo } = await import('../app/mediaApis/vertex');
    const { generateNanoBananaProImage } = await import('../app/mediaApis/nanoBananaPro');
    const { GOOGLE_API_KEY, GEMINI_API_KEY } = await import('../app/constant');

    console.log("--- API Key Debug ---");
    console.log("GOOGLE_API_KEY:", GOOGLE_API_KEY ? `${GOOGLE_API_KEY.substring(0, 5)}...` : "undefined");
    console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 5)}...` : "undefined");
    console.log("---------------------");

    const args = process.argv.slice(2);
    const service = args[0];
    const command = args[1];

    if (!service) {
        printUsage();
        return;
    }

    try {
        switch (service.toLowerCase()) {
            case 'nanobanana':
                await handleNanoBanana(command, args.slice(2), { generateNanoBananaImage, generateNanoBananaBatch });
                break;
            case 'nanobananapro':
                await handleNanoBananaPro(command, args.slice(2), { generateNanoBananaProImage });
                break;
            case 'freepik':
                await handleFreepik(command, args.slice(2), { generateFreepikImage, generateFreepikVideo });
                break;
            case 'vertex':
                await handleVertex(command, args.slice(2), { generateVeoVideo });
                break;
            default:
                console.error(`Unknown service: ${service}`);
                printUsage();
        }
    } catch (error) {
        console.error('An error occurred during execution:', error);
    }
}

async function handleNanoBanana(command: string, extraArgs: string[], apis: any) {
    const { generateNanoBananaImage, generateNanoBananaBatch } = apis;
    if (command === 'image') {
        const prompt = extraArgs[0];
        if (!prompt) {
            console.error('Usage: nanobanana image <prompt>');
            return;
        }
        console.log(`Generating NanoBanana Image for prompt: "${prompt}"...`);
        const result = await generateNanoBananaImage(prompt);
        console.log('Result:', result);
    } else if (command === 'batch') {
        const prompts = extraArgs;
        if (prompts.length === 0) {
            console.error('Usage: nanobanana batch <prompt1> [prompt2] ...');
            return;
        }
        console.log(`Generating NanoBanana Batch for ${prompts.length} prompts...`);
        console.log('Prompts:', prompts);
        const results = await generateNanoBananaBatch(prompts);
        console.log('Results Map:');
        results.forEach((path: string, prompt: string) => {
            console.log(`  "${prompt}" -> ${path}`);
        });
    } else {
        console.error(`Unknown NanoBanana command: ${command}`);
    }
}

async function handleFreepik(command: string, extraArgs: string[], apis: any) {
    const { generateFreepikImage, generateFreepikVideo } = apis;
    if (command === 'image') {
        const [model, prompt] = extraArgs;
        if (!model || !prompt) {
            console.error('Usage: freepik image <model> <prompt>');
            console.error('Models: mystic, flux-dev, classic, etc.');
            return;
        }
        console.log(`Generating Freepik Image with model ${model} for prompt: "${prompt}"...`);
        // Cast model to any to avoid strict type checking issues in this script if definition is precise
        const result = await generateFreepikImage(model as any, prompt);
        console.log('Result URL:', result);

    } else if (command === 'video') {
        const [model, prompt, imageInput] = extraArgs;
        if (!model || !prompt || !imageInput) {
            console.error('Usage: freepik video <model> <prompt> <image_input>');
            console.error('Models: kling, hailuo-02-768p, etc.');
            return;
        }
        console.log(`Generating Freepik Video with model ${model} for prompt: "${prompt}"...`);
        const result = await generateFreepikVideo(model as any, prompt, imageInput);
        console.log('Result URL:', result);
    } else {
        console.error(`Unknown Freepik command: ${command}`);
    }
}

async function handleVertex(command: string, extraArgs: string[], apis: any) {
    const { generateVeoVideo } = apis;
    if (command === 'veo') {
        const prompt = extraArgs[0];
        if (!prompt) {
            console.error('Usage: vertex veo <prompt>');
            return;
        }
        const timestamp = Date.now();
        const outputName = `veo_test_${timestamp}`;
        console.log(`Generating Vertex Veo Video for prompt: "${prompt}"...`);
        console.log(`Output Name: ${outputName}`);
        
        const result = await generateVeoVideo(prompt, outputName);
        console.log('Result:', result);
    } else {
        console.error(`Unknown Vertex command: ${command}`);
    }
}

async function handleNanoBananaPro(command: string, extraArgs: string[], apis: any) {
    const { generateNanoBananaProImage } = apis;
    if (command === 'image') {
        const prompt = extraArgs[0];
        if (!prompt) {
            console.error('Usage: nanobananaPro image <prompt>');
            return;
        }
        console.log(`Generating NanoBananaPro Image for prompt: "${prompt}"...`);
        // Using a default filename and directory for testing
        const timestamp = Date.now();
        const fileName = `nano_pro_${timestamp}`;
        // Ensure PUBLIC_DIR is accessible here, or pass it. 
        // It's defined in module scope but outside functions. 
        // Since it's a script, module scope vars are available to these functions strictly speaking if defined before.
        // But main is async. PUBLIC_DIR is defined synchronously at top. It should be fine.
        const PUBLIC_DIR = path.resolve(__dirname, '../public'); // Redefining to be safe or just use the global one.
        
        await generateNanoBananaProImage(prompt, fileName, PUBLIC_DIR);
        console.log(`Check ${PUBLIC_DIR} for files starting with ${fileName}`);
    } else {
        console.error(`Unknown NanoBananaPro command: ${command}`);
    }
}

function printUsage() {
    console.log(`
Usage: npx tsx scripts/test-media-apis.ts <service> <command> [args]

Services & Commands:
  nanobanana
    image <prompt>                  Generate a single image
    batch <prompt1> [prompt2] ...   Generate multiple images in batch

  freepik
    image <model> <prompt>          Generate an image
                                    Models: mystic, flux-dev, classic, seedream
    video <model> <prompt> <image>  Generate a video from an image
                                    Models: hailuo-02-768p, kling

  vertex
    veo <prompt>                    Generate a video using Vertex Veo
`);
}

main().catch(console.error);
