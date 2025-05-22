
'use server';
/**
 * @fileOverview A harmonious color palette generator AI agent.
 *
 * - generateHarmoniousPalettes - A function that handles the color palette generation process.
 * - GenerateHarmoniousPalettesInput - The input type for the generateHarmoniousPalettes function.
 * - GenerateHarmoniousPalettesOutput - The return type for the generateHarmoniousPalettes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateHarmoniousPalettesInputSchema = z.object({
  baseColorHue: z
    .number()
    .describe('The base color hue for the palette, between 0 and 360.'),
  numColors: z
    .number()
    .describe('The number of colors to generate in the palette.'),
});
export type GenerateHarmoniousPalettesInput = z.infer<
  typeof GenerateHarmoniousPalettesInputSchema
>;

const GenerateHarmoniousPalettesOutputSchema = z.array(
  z.object({
    hue: z.number().describe('The hue of the color, between 0 and 360.'),
    saturation:
      z.number().describe('The saturation of the color, between 0 and 100.'),
    brightness:
      z.number().describe('The brightness of the color, between 0 and 100.'),
  })
);

export type GenerateHarmoniousPalettesOutput = z.infer<
  typeof GenerateHarmoniousPalettesOutputSchema
>;

export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput
): Promise<GenerateHarmoniousPalettesOutput> {
  return generateHarmoniousPalettesFlow(input);
}

const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const prompt = ai.definePrompt({
  name: 'generateHarmoniousPalettesPrompt',
  input: {schema: GenerateHarmoniousPalettesInputSchema},
  output: {schema: GenerateHarmoniousPalettesOutputSchema},
  prompt: `You are a color palette generation AI. You will generate a
harmonious color palette based on the provided base color hue, and the
number of colors requested. The output should be a JSON array of HSB
(Hue, Saturation, Brightness) color values. Hue is between 0 and 360,
saturation and brightness are between 0 and 100.

Base Color Hue: {{{baseColorHue}}}
Number of Colors: {{{numColors}}}

Ensure the generated colors are visually harmonious and work well together.
Use established color theory principles to create the palette.
`,
  config: {
    safetySettings: defaultSafetySettings,
  }
});

const generateHarmoniousPalettesFlow = ai.defineFlow(
  {
    name: 'generateHarmoniousPalettesFlow',
    inputSchema: GenerateHarmoniousPalettesInputSchema,
    outputSchema: GenerateHarmoniousPalettesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

