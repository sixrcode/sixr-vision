
'use server';

/**
 * @fileOverview A flow to generate procedural textures and meshes from a text prompt.
 * This flow utilizes an image generation model to create visual representations.
 *
 * @exports generateAssets - An asynchronous function that takes a prompt and returns data URIs for a generated texture and a mesh preview.
 * @exports GenerateAssetsInput - The Zod schema type for the input to `generateAssets`.
 * @exports GenerateAssetsOutput - The Zod schema type for the output of `generateAssets`.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { defaultSafetySettings, MODEL_NAME_IMAGE_GENERATION } from '../sharedConstants';

const GenerateAssetsInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the desired texture or mesh.'),
});
export type GenerateAssetsInput = z.infer<typeof GenerateAssetsInputSchema>;

const GenerateAssetsOutputSchema = z.object({
  textureDataUri: z
    .string()
    .describe(
      "A data URI containing the generated texture, must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  meshDataUri: z
    .string()
    .describe(
      "A data URI containing the generated mesh preview image, must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

// In-memory cache for this flow
const generateAssetsCache = new Map<string, GenerateAssetsOutput>();
console.log(`[AI Flow Init] generateAssetsFlow uses model: ${MODEL_NAME_IMAGE_GENERATION}`);

/**
 * Generates procedural assets (texture and mesh preview) based on a text prompt.
 * @param {GenerateAssetsInput} input - The input object containing the text prompt.
 * @returns {Promise<GenerateAssetsOutput>} A promise that resolves to an object containing data URIs for the generated texture and mesh preview.
 * @throws {Error} If image generation fails to return a media URL for either asset.
 */
export async function generateAssets(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlow(input);
}

const generateAssetsFlow = ai.defineFlow(
  {
    name: 'generateAssetsFlow',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async (input: GenerateAssetsInput): Promise<GenerateAssetsOutput> => {
    const cacheKey = input.prompt;
    if (generateAssetsCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateAssetsFlow: Returning cached assets for prompt: ${cacheKey}`);
      return generateAssetsCache.get(cacheKey)!;
    }

    console.log(`[Cache Miss] generateAssetsFlow: Generating assets for prompt: "${cacheKey}" using model: ${MODEL_NAME_IMAGE_GENERATION}`);

    const texturePrompt = `Generate a seamless tileable texture based on the following artistic prompt: "${input.prompt}". Focus on abstract patterns and material qualities rather than literal depictions unless specified. Output as a square image suitable for texturing. Consider "Cosmic Grapevines" and Afrofuturist aesthetics.`;
    const meshPrompt = `Generate a visual preview of a simple 3D mesh or abstract geometric form inspired by the prompt: "${input.prompt}". This is for a preview image only, not a 3D model file. Output as a square image. Consider "Cosmic Grapevines" and Afrofuturist aesthetics.`;

    const startTime = performance.now();
    const [textureResult, meshResult] = await Promise.all([
      ai.generate({
        model: MODEL_NAME_IMAGE_GENERATION,
        prompt: texturePrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          safetySettings: defaultSafetySettings,
        },
      }),
      ai.generate({
        model: MODEL_NAME_IMAGE_GENERATION,
        prompt: meshPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          safetySettings: defaultSafetySettings,
        },
      })
    ]);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateAssetsFlow (texture & mesh parallel) ai.generate calls took ${(endTime - startTime).toFixed(2)} ms for model ${MODEL_NAME_IMAGE_GENERATION}`);
    
    const textureMedia = textureResult.media;
    const meshMedia = meshResult.media;

    if (!textureMedia?.url) {
        throw new Error('Texture generation failed to return a media URL.');
    }
    if (!meshMedia?.url) {
        throw new Error('Mesh preview generation failed to return a media URL.');
    }

    const result: GenerateAssetsOutput = {
      textureDataUri: textureMedia.url,
      meshDataUri: meshMedia.url,
    };
    
    generateAssetsCache.set(cacheKey, result);
    console.log(`[Cache Set] generateAssetsFlow: Cached assets for prompt: ${cacheKey}`);
    return result;
  }
);
