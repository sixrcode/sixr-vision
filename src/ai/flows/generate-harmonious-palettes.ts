
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
import { defaultSafetySettings } from '../sharedConstants';

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

// In-memory cache for this flow
const generatePalettesCache = new Map<string, GenerateHarmoniousPalettesOutput>();

export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput
): Promise<GenerateHarmoniousPalettesOutput> {
  return generateHarmoniousPalettesFlow(input);
}

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
  async (input: GenerateHarmoniousPalettesInput): Promise<GenerateHarmoniousPalettesOutput> => {
    const cacheKey = JSON.stringify(input);
    if (generatePalettesCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateHarmoniousPalettesFlow: Returning cached palette for input: ${cacheKey}`);
      return generatePalettesCache.get(cacheKey)!;
    }

    console.log(`[Cache Miss] generateHarmoniousPalettesFlow: Generating palette for input: ${cacheKey}`);
    const startTime = performance.now();
    const {output} = await prompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateHarmoniousPalettesFlow prompt call took ${(endTime - startTime).toFixed(2)} ms`);
    
    if (!output) {
        throw new Error('AI failed to generate a palette.');
    }
    
    generatePalettesCache.set(cacheKey, output);
    console.log(`[Cache Set] generateHarmoniousPalettesFlow: Cached palette for input: ${cacheKey}`);
    return output;
  }
);

