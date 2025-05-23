'use server';
/**
 * @fileOverview A harmonious color-palette generator AI agent.
 *
 * - generateHarmoniousPalettes  – main entry point
 * - GenerateHarmoniousPalettesInput / Output – typed Zod schemas
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { defaultSafetySettings } from '../sharedConstants';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types & Schemas                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const GenerateHarmoniousPalettesInputSchema = z.object({
  /** Base hue in the HSB colour space (0–360°). */
  baseColorHue: z.number(),
  /** Number of colours to return. */
  numColors: z.number(),
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

/* ────────────────────────────────────────────────────────────────────────── */

const MODEL_NAME_TEXT = 'googleai/gemini-2.0-flash';

/** Simple in-memory LRU placeholder (replace with capped-size cache soon). */
const paletteCache = new Map<string, GenerateHarmoniousPalettesOutput>();

/* ────────────────────────────────────────────────────────────────────────── */
/*  Prompt definition                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

const prompt = ai.definePrompt({
  name: 'generateHarmoniousPalettesPrompt',
  input: { schema: GenerateHarmoniousPalettesInputSchema },
  output: { schema: GenerateHarmoniousPalettesOutputSchema },
  prompt: `You are a color-palette expert. Given a base hue and a desired
number of colours, return a JSON array of harmonious HSB triples.
Hue range: 0–360. Saturation & Brightness: 0–100.
Base hue: {{{baseColorHue}}}
Palette size: {{{numColors}}}
Return only the JSON array.`,
  config: { safetySettings: defaultSafetySettings },
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

    if (paletteCache.has(cacheKey)) {
      console.log(`[Palette-Cache HIT] ${cacheKey}`);
      return paletteCache.get(cacheKey)!;
    }

    console.log(
      `[Palette-Cache MISS] Generating with ${MODEL_NAME_TEXT} for ${cacheKey}`,
    );
    const t0 = performance.now();
    const { output } = await prompt(input);
    console.log(
      `[AI] palette generation took ${(performance.now() - t0).toFixed(1)} ms`,
    );

    if (!output) throw new Error('AI failed to generate a palette.');

    paletteCache.set(cacheKey, output);
    return output;
  },
);

/* ────────────────────────────────────────────────────────────────────────── */

export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput,
): Promise<GenerateHarmoniousPalettesOutput> {
  return generateHarmoniousPalettesFlow(input);
}
