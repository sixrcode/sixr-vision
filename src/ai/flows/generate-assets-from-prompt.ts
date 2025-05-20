
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

// This specific prompt object (generateAssetsPrompt) was not being used by the generateAssetsFlow.
// The flow directly calls ai.generate with model-specific parameters for image generation.
// Removing it to avoid confusion as it implies a text-to-text model expecting data URIs in the prompt.
/*
const generateAssetsPrompt = ai.definePrompt({
  name: 'generateAssetsPrompt',
  input: {schema: GenerateAssetsInputSchema},
  output: {schema: GenerateAssetsOutputSchema},
  prompt: `You are a creative assistant that helps generate assets based on text prompts.

You will generate a texture and a mesh based on the prompt provided. The texture should be suitable for use as a material.
The mesh should be a simple 3D object.

Prompt: {{{prompt}}}

Texture Data URI: {{media url=textureDataUri}}
Mesh Data URI: {{media url=meshDataUri}}`,
});
*/

const generateAssetsFlow = ai.defineFlow(
  {
    name: 'generateAssetsFlow',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async input => {
    const {media: textureMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Ensure this model is capable of image generation
      prompt: `Generate a seamless tileable texture based on the following artistic prompt: "${input.prompt}". Focus on abstract patterns and material qualities rather than literal depictions unless specified. Output as a square image suitable for texturing.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Must include IMAGE for media output
      },
    });

    const {media: meshMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Ensure this model is capable of image generation
      prompt: `Generate a visual preview of a simple 3D mesh or abstract geometric form inspired by the prompt: "${input.prompt}". This is for a preview image only, not a 3D model file. Output as a square image.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Must include IMAGE for media output
      },
    });

    if (!textureMedia?.url) {
        throw new Error('Texture generation failed to return a media URL.');
    }
    if (!meshMedia?.url) {
        throw newError('Mesh preview generation failed to return a media URL.');
    }

    return {
      textureDataUri: textureMedia.url,
      meshDataUri: meshMedia.url,
    };
  }
);

