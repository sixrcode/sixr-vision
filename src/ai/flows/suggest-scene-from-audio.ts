// The below code is auto-generated. Do not edit this code manually.
'use server';

/**
 * Genkit flow: suggest a visual scene from live-audio analysis.
 *
 * - suggestSceneFromAudio()         → public helper
 * - SuggestSceneFromAudioInput      → zod-inferred input type
 * - SuggestSceneFromAudioOutput     → zod-inferred output type
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { defaultSafetySettings } from '../sharedConstants';

/* ────────────────────────────────────────────────────────────
   ▸  Input / Output Schemas
   ──────────────────────────────────────────────────────────── */

const SuggestSceneFromAudioInputSchema = z.object({
  bassEnergy:   z.number().describe('Bass-band energy'),
  midEnergy:    z.number().describe('Mid-band energy'),
  trebleEnergy: z.number().describe('Treble-band energy'),
  bpm:          z.number().describe('Beats per minute'),
});
export type SuggestSceneFromAudioInput = z.infer<
  typeof SuggestSceneFromAudioInputSchema
>;

const SuggestSceneFromAudioOutputSchema = z.object({
  sceneId:              z.string().describe('ID of the suggested scene'),
  reason:               z.string().describe('Why this scene fits, in Cosmic-Grapevines metaphors'),
  suggestedAssetPrompt: z.string().describe('2-5 word prompt for procedural assets'),
});
export type SuggestSceneFromAudioOutput = z.infer<
  typeof SuggestSceneFromAudioOutputSchema
>;

/* ────────────────────────────────────────────────────────────
   ▸  Local LRU-style cache (simple Map for now)
   ──────────────────────────────────────────────────────────── */

const sceneCache = new Map<string, SuggestSceneFromAudioOutput>();

/* ────────────────────────────────────────────────────────────
   ▸  Constants
   ──────────────────────────────────────────────────────────── */

const MODEL_NAME_TEXT = 'googleai/gemini-2.0-flash'; // default text model

/* ────────────────────────────────────────────────────────────
   ▸  Prompt Definition
   ──────────────────────────────────────────────────────────── */

const scenePrompt = ai.definePrompt({
  name:   'suggestSceneFromAudioPrompt',
  input:  { schema: SuggestSceneFromAudioInputSchema },
  output: { schema: SuggestSceneFromAudioOutputSchema },
  prompt: `
You are an AI scene-selection expert for an audio-reactive visualiser.
Theme: **Cosmic Grapevines** (growth, connection, cosmic journey).

Given bass/mid/treble energy and BPM, choose the most fitting scene from
the list below, explain **why** in a short metaphor, and give a 2–5-word
procedural-asset prompt that matches the mood.

Scenes list:
- spectrum_bars       (vertical frequency bars; energy conduits)
- radial_burst        (center-out particle bursts; seed explosions)
- mirror_silhouette   (reflective performer silhouette; cosmic entity)
- particle_finale     (dense particle bloom; universe of stars)
- neon_pulse_grid     (pulsing lattice; cosmic lattice)
- frequency_rings     (concentric waves; energy ripples)
- strobe_light        (flashing peaks)
- echoing_shapes      (appearing shapes; sprouting seeds)
- geometric_tunnel    (flying tunnel; journey through vine network)

Bass Energy:   {{bassEnergy}}
Mid Energy:    {{midEnergy}}
Treble Energy: {{trebleEnergy}}
BPM:           {{bpm}}
  `.trim(),
  config: { safetySettings: defaultSafetySettings },
});

/* ────────────────────────────────────────────────────────────
   ▸  Flow Definition
   ──────────────────────────────────────────────────────────── */

const suggestSceneFromAudioFlow = ai.defineFlow(
  {
    name:         'suggestSceneFromAudioFlow',
    inputSchema:  SuggestSceneFromAudioInputSchema,
    outputSchema: SuggestSceneFromAudioOutputSchema,
  },
  async (input: SuggestSceneFromAudioInput): Promise<SuggestSceneFromAudioOutput> => {
    const cacheKey = JSON.stringify(input);

    /* 1. Try cache first */
    if (sceneCache.has(cacheKey)) {
      console.log(`[Cache HIT] Scene suggestion for ${cacheKey}`);
      return sceneCache.get(cacheKey)!;
    }

    /* 2. Call Gemini model */
    console.log(`[Cache MISS] Generating scene via ${MODEL_NAME_TEXT} for ${cacheKey}`);
    const t0 = performance.now();
    const { output } = await scenePrompt(input);
    const dt = (performance.now() - t0).toFixed(1);

    if (!output) throw new Error('AI failed to produce a scene suggestion.');

    console.log(`[AI] Scene generated in ${dt} ms – caching under ${cacheKey}`);
    sceneCache.set(cacheKey, output);
    return output;
  }
);

/* ────────────────────────────────────────────────────────────
   ▸  Public Helper
   ──────────────────────────────────────────────────────────── */

export async function suggestSceneFromAudio(
  input: SuggestSceneFromAudioInput
): Promise<SuggestSceneFromAudioOutput> {
  return suggestSceneFromAudioFlow(input);
}
