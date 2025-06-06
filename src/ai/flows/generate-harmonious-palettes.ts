
'use server';
/**
 * @fileOverview A harmonious color-palette generator AI agent.
 *
 * - generateHarmoniousPalettes  – main entry point
 * - GenerateHarmoniousPalettesInput / Output – typed Zod schemas
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { HARMONIOUS_PALETTES_PROMPT } from '@/ai/prompts';
import { defaultSafetySettings, MODEL_NAME_TEXT_GENERATION } from '../sharedConstants';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types & Schemas                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

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
    hue: z.number(),          // 0-360
    saturation: z.number(),   // 0-100
    brightness: z.number(),   // 0-100
  }),
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

/**
 * Generates a harmonious color palette.
 * Test cases:
 * - Input validation for numColors (min 2, max 10) should be handled by Zod.
 * - Input validation for baseColorHue (min 0, max 360) should be handled by Zod.
 * - Cache hit: Call twice with same input, assert AI model (mocked) is not called on second invocation.
 * - AI failure: Mock AI model to return undefined/null output, assert flow throws an error.
 */
export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput
): Promise<GenerateHarmoniousPalettesOutput> {
  return generateHarmoniousPalettesFlow(input);
}

console.log(`[AI Flow Init] generateHarmoniousPalettesFlow uses model: ${MODEL_NAME_TEXT_GENERATION}`);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Prompt definition                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

const harmoniousPalettePrompt = ai.definePrompt({
  name: 'generateHarmoniousPalettesPrompt',
  input: {schema: GenerateHarmoniousPalettesInputSchema},
  output: {schema: GenerateHarmoniousPalettesOutputSchema},
  prompt: HARMONIOUS_PALETTES_PROMPT,
  config: {
    safetySettings: defaultSafetySettings,
    model: MODEL_NAME_TEXT_GENERATION,
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Flow definition                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const generateHarmoniousPalettesFlow = ai.defineFlow(
  {
    name: 'generateHarmoniousPalettesFlow',
    inputSchema: GenerateHarmoniousPalettesInputSchema,
    outputSchema: GenerateHarmoniousPalettesOutputSchema,
  },
  async (
    input: GenerateHarmoniousPalettesInput,
  ): Promise<GenerateHarmoniousPalettesOutput> => {
    const cacheKey = JSON.stringify(input);
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`[Cache Hit] generateHarmoniousPalettesFlow: Returning cached palette for input: ${cacheKey}`);
      return cachedResult;
    }

    console.log(`[Cache Miss] generateHarmoniousPalettesFlow: Generating palette for input: ${cacheKey} using model: ${MODEL_NAME_TEXT_GENERATION}`);
    const startTime = performance.now();
    const {output} = await harmoniousPalettePrompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateHarmoniousPalettesFlow prompt call took ${(endTime - startTime).toFixed(2)} ms for model ${MODEL_NAME_TEXT_GENERATION}`);
    
    if (!output) {
        throw new Error('AI failed to generate a palette.');
    }
    
    setInCache(cacheKey, output);
    console.log(`[Cache Set] generateHarmoniousPalettesFlow: Cached palette for input: ${cacheKey}`);
    return output;
  },
);
