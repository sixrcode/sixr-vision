'use server';
/**
 * @fileOverview A harmonious color-palette generator AI agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { defaultSafetySettings } from '../sharedConstants'; // centralised safety config

/* ────────────────────────────────
   ▸ Input / Output Schemas
   ──────────────────────────────── */

const GenerateHarmoniousPalettesInputSchema = z.object({
  /** The base hue (0-360) around which the palette will be built. */
  baseColorHue: z.number().int().min(0).max(360),
  /** Number of colours requested in the resulting palette. */
  numColors: z.number().int().min(1).max(20),
});
export type GenerateHarmoniousPalettesInput = z.infer<
  typeof GenerateHarmoniousPalettesInputSchema
>;

const GenerateHarmoniousPalettesOutputSchema = z.array(
  z.object({
    hue: z.number().min(0).max(360),
    saturation: z.number().min(0).max(100),
    brightness: z.number().min(0).max(100),
  })
);
export type GenerateHarmoniousPalettesOutput = z.infer<
  typeof GenerateHarmoniousPalettesOutputSchema
>;

/* ────────────────────────────────
   ▸ Local cache (simple Map)
   ──────────────────────────────── */

const paletteCache = new Map<string, GenerateHarmoniousPalettesOutput>();

/* ────────────────────────────────
   ▸ Gemini model name (kept close
      to avoid magic-string reuse)
   ──────────────────────────────── */

const MODEL_NAME_TEXT = 'googleai/gemini-2.0-flash';

/* ────────────────────────────────
   ▸ Prompt definition
   ──────────────────────────────── */

const generateHarmoniousPalettesPrompt = ai.definePrompt({
  name: 'generateHarmoniousPalettesPrompt',
  input: { schema: GenerateHarmoniousPalettesInputSchema },
  output: { schema: GenerateHarmoniousPalettesOutputSchema },
  prompt: `
You are a colour-palette generation AI. Given a base hue and a requested
colour count, output a JSON array of harmonious HSB values.

Base Hue (0-360): {{{baseColorHue}}}
Number of Colours: {{{numColors}}}

Return an array formatted like:
[
  { "hue": 120, "saturation": 80, "brightness": 95 },
  …
]
  `.trim(),
  config: { safetySettings: defaultSafetySettings },
});

/* ────────────────────────────────
   ▸ Flow definition
   ──────────────────────────────── */

const generateHarmoniousPalettesFlow = ai.defineFlow(
  {
    name: 'generateHarmoniousPalettesFlow',
    inputSchema: GenerateHarmoniousPalettesInputSchema,
    outputSchema: GenerateHarmoniousPalettesOutputSchema,
  },
  async (
    input: GenerateHarmoniousPalettesInput
  ): Promise<GenerateHarmoniousPalettesOutput> => {
    const cacheKey = JSON.stringify(input);

    /* 1. Try cache first */
    if (paletteCache.has(cacheKey)) {
      console.log(
        `[Cache HIT] Palette for ${cacheKey} served from memory cache.`
      );
      return paletteCache.get(cacheKey)!;
    }

    /* 2. Call Gemini via Genkit */
    console.log(
      `[Cache MISS] Generating palette (${MODEL_NAME_TEXT}) for ${cacheKey}…`
    );
    const t0 = performance.now();
    const { output } = await generateHarmoniousPalettesPrompt(input);
    const dt = (performance.now() - t0).toFixed(1);

    if (!output) {
      throw new Error('AI failed to generate a palette.');
    }

    console.log(
      `[AI] Palette generated in ${dt} ms – caching result under ${cacheKey}.`
    );
    paletteCache.set(cacheKey, output);
    return output;
  }
);

/* ────────────────────────────────
   ▸ Public helper
   ──────────────────────────────── */

export async function generateHarmoniousPalettes(
  input: GenerateHarmoniousPalettesInput
): Promise<GenerateHarmoniousPalettesOutput> {
  return generateHarmoniousPalettesFlow(input);
}
