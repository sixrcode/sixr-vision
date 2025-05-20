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
      'A data URI containing the generated texture, must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected the typo here
    ),
  meshDataUri: z
    .string()
    .describe(
      'A data URI containing the generated mesh, must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});
export type GenerateAssetsOutput = z.infer<typeof GenerateAssetsOutputSchema>;

export async function generateAssets(input: GenerateAssetsInput): Promise<GenerateAssetsOutput> {
  return generateAssetsFlow(input);
}

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

const generateAssetsFlow = ai.defineFlow(
  {
    name: 'generateAssetsFlow',
    inputSchema: GenerateAssetsInputSchema,
    outputSchema: GenerateAssetsOutputSchema,
  },
  async input => {
    const {media: textureMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `Generate a seamless texture based on the following prompt: ${input.prompt}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const {media: meshMedia} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `Generate a simple 3D mesh based on the following prompt: ${input.prompt}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {
      textureDataUri: textureMedia.url,
      meshDataUri: meshMedia.url,
    };
  }
);
