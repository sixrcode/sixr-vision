
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

/**
 * Generates procedural assets (texture and mesh preview) based on a text prompt.
 * @param {GenerateAssetsInput} input - The input object containing the text prompt.
 * @returns {Promise<GenerateAssetsOutput>} A promise that resolves to an object containing data URIs for the generated texture and mesh preview.
 * @throws {Error} If image generation fails to return a media URL for either asset.
 */
export async function generateAssets(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlow(input);
}

const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

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

    console.log(`[Cache Miss] generateAssetsFlow: Generating assets for prompt: ${cacheKey}`);

    const {media: textureMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: `Generate a seamless tileable texture based on the following artistic prompt: "${input.prompt}". Focus on abstract patterns and material qualities rather than literal depictions unless specified. Output as a square image suitable for texturing.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: defaultSafetySettings,
      },
    });

    const {media: meshMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: `Generate a visual preview of a simple 3D mesh or abstract geometric form inspired by the prompt: "${input.prompt}". This is for a preview image only, not a 3D model file. Output as a square image.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        safetySettings: defaultSafetySettings,
      },
    });

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
