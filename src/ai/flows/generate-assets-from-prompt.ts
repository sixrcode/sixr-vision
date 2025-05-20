
'use server';

/**
 * @fileOverview A flow to generate procedural textures and meshes from a text prompt.
 *
 * - generateAssets - A function that handles the asset generation process.
 * - GenerateAssetsInput - The input type for the generateAssets function.
 * - GenerateAssetsOutput - The return type for the generateAssets function.
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
      "A data URI containing the generated mesh, must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

export async function generateAssets(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlow(input);
}

const generateAssetsFlow = ai.defineFlow(
  {
    name: 'generateAssetsFlow',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async input => {
    const {media: textureMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: `Generate a seamless tileable texture based on the following artistic prompt: "${input.prompt}". Focus on abstract patterns and material qualities rather than literal depictions unless specified. Output as a square image suitable for texturing.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], 
      },
    });

    const {media: meshMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', 
      prompt: `Generate a visual preview of a simple 3D mesh or abstract geometric form inspired by the prompt: "${input.prompt}". This is for a preview image only, not a 3D model file. Output as a square image.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], 
      },
    });

    if (!textureMedia?.url) {
        throw new Error('Texture generation failed to return a media URL.');
    }
    if (!meshMedia?.url) {
        throw new Error('Mesh preview generation failed to return a media URL.');
    }

    return {
      textureDataUri: textureMedia.url,
      meshDataUri: meshMedia.url,
    };
  }
);

