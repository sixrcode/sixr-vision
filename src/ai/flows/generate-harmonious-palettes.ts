
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
import { HARMONIOUS_PALETTES_PROMPT } from '@/ai/prompts'; // Import the prompt

const GenerateHarmoniousPalettesInputSchema = z.object({
  baseColorHue: z
    .number()
    .min(0, "Base color hue must be between 0 and 360.")
    .max(360, "Base color hue must be between 0 and 360.")
    .describe('The base color hue for the palette, between 0 and 360.'),
  numColors: z
    .number()
    .min(2, "Number of colors must be at least 2.")
    .max(10, "Number of colors cannot exceed 10.")
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

// LRU Cache Implementation
const MAX_CACHE_SIZE = 50;
const generatePalettesCache = new Map<string, GenerateHarmoniousPalettesOutput>();
const generatePalettesCacheOrder: string[] = [];

function getFromCache(key: string): GenerateHarmoniousPalettesOutput | undefined {
  if (generatePalettesCache.has(key)) {
    // Move key to the end of the order array (most recently used)
    const index = generatePalettesCacheOrder.indexOf(key);
    if (index > -1) {
      generatePalettesCacheOrder.splice(index, 1);
    }
    generatePalettesCacheOrder.push(key);
    return generatePalettesCache.get(key);
  }
  return undefined;
}

function setInCache(key: string, value: GenerateHarmoniousPalettesOutput): void {
  if (generatePalettesCache.size >= MAX_CACHE_SIZE && !generatePalettesCache.has(key)) {
    // Evict least recently used
    const lruKey = generatePalettesCacheOrder.shift();
    if (lruKey) {
      generatePalettesCache.delete(lruKey);
      console.log(`[Cache Evict] generateHarmoniousPalettesFlow: Evicted ${lruKey} from cache.`);
    }
  }
  generatePalettesCache.set(key, value);
  // Remove key if it exists, then add to end (most recently used)
  const index = generatePalettesCacheOrder.indexOf(key);
  if (index > -1) {
    generatePalettesCacheOrder.splice(index, 1);
  }
  generatePalettesCacheOrder.push(key);
}


export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput
): Promise<GenerateHarmoniousPalettesOutput> {
  // Input validation will be handled by Zod when the flow is invoked.
  // Test case consideration: Call with input.numColors < 2 or > 10 to check Zod error.
  // Test case consideration: Call with input.baseColorHue < 0 or > 360.
  return generateHarmoniousPalettesFlow(input);
}

const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const MODEL_NAME_TEXT = 'googleai/gemini-2.0-flash';
console.log(`[AI Flow Init] generateHarmoniousPalettesFlow uses model: ${MODEL_NAME_TEXT}`);


const harmoniousPalettePrompt = ai.definePrompt({
  name: 'generateHarmoniousPalettesPrompt',
  input: {schema: GenerateHarmoniousPalettesInputSchema},
  output: {schema: GenerateHarmoniousPalettesOutputSchema},
  prompt: HARMONIOUS_PALETTES_PROMPT, // Use imported prompt
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
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`[Cache Hit] generateHarmoniousPalettesFlow: Returning cached palette for input: ${cacheKey}`);
      // Test case consideration: Call twice with same input, second call should hit cache.
      // (Mock ai.generate and assert it's not called on second invocation).
      return cachedResult;
    }

    console.log(`[Cache Miss] generateHarmoniousPalettesFlow: Generating palette for input: ${cacheKey} using model: ${MODEL_NAME_TEXT}`);
    const startTime = performance.now();
    // The 'harmoniousPalettePrompt' defined above uses HARMONIOUS_PALETTES_PROMPT string
    const {output} = await harmoniousPalettePrompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateHarmoniousPalettesFlow prompt call took ${(endTime - startTime).toFixed(2)} ms`);
    
    if (!output) {
        // Test case consideration: Mock ai.generate to return undefined/null output.
        throw new Error('AI failed to generate a palette.');
    }
    
    setInCache(cacheKey, output);
    console.log(`[Cache Set] generateHarmoniousPalettesFlow: Cached palette for input: ${cacheKey}`);
    return output;
  }
);
