
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
import { defaultSafetySettings, MODEL_NAME_TEXT_GENERATION } from '../sharedConstants';
import { SUGGEST_SCENE_FROM_AUDIO_PROMPT } from '../prompts';

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
  suggestedAssetPrompt: z.string().describe('2-5 word prompt for procedural assets, Cosmic Grapevines themed'),
});
export type SuggestSceneFromAudioOutput = z.infer<
  typeof SuggestSceneFromAudioOutputSchema
>;

/* ────────────────────────────────────────────────────────────
   ▸  Local LRU-style cache (simple Map for now)
   ──────────────────────────────────────────────────────────── */

const sceneCache = new Map<string, SuggestSceneFromAudioOutput>();
const MAX_CACHE_SIZE = 50; // Define max size for the cache
const sceneCacheOrder: string[] = []; // For LRU logic

function getFromCache(key: string): SuggestSceneFromAudioOutput | undefined {
  if (sceneCache.has(key)) {
    const index = sceneCacheOrder.indexOf(key);
    if (index > -1) sceneCacheOrder.splice(index, 1);
    sceneCacheOrder.push(key);
    return sceneCache.get(key);
  }
  return undefined;
}

function setInCache(key: string, value: SuggestSceneFromAudioOutput): void {
  if (sceneCache.size >= MAX_CACHE_SIZE && !sceneCache.has(key)) {
    const lruKey = sceneCacheOrder.shift();
    if (lruKey) {
      sceneCache.delete(lruKey);
      console.log(`[Cache Evict] suggestSceneFromAudioFlow: Evicted ${lruKey} from cache.`);
    }
  }
  sceneCache.set(key, value);
  const index = sceneCacheOrder.indexOf(key);
  if (index > -1) sceneCacheOrder.splice(index, 1);
  sceneCacheOrder.push(key);
}

/* ────────────────────────────────────────────────────────────
   ▸  Constants
   ──────────────────────────────────────────────────────────── */
console.log(`[AI Flow Init] suggestSceneFromAudioFlow uses model: ${MODEL_NAME_TEXT_GENERATION}`);

/* ────────────────────────────────────────────────────────────
   ▸  Prompt Definition
   ──────────────────────────────────────────────────────────── */

const scenePrompt = ai.definePrompt({
  name:   'suggestSceneFromAudioPrompt',
  input:  { schema: SuggestSceneFromAudioInputSchema },
  output: { schema: SuggestSceneFromAudioOutputSchema },
  prompt: SUGGEST_SCENE_FROM_AUDIO_PROMPT,
  config: { 
    safetySettings: defaultSafetySettings,
    model: MODEL_NAME_TEXT_GENERATION,
  },
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

    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`[Cache HIT] suggestSceneFromAudioFlow for ${cacheKey}`);
      return cachedResult;
    }

    console.log(`[Cache MISS] suggestSceneFromAudioFlow: Generating scene via ${MODEL_NAME_TEXT_GENERATION} for ${cacheKey}`);
    const t0 = performance.now();
    const { output } = await scenePrompt(input);
    const dt = (performance.now() - t0).toFixed(1);

    if (!output) throw new Error('AI failed to produce a scene suggestion.');

    console.log(`[AI Benchmark] suggestSceneFromAudioFlow prompt call took ${dt} ms for model ${MODEL_NAME_TEXT_GENERATION}`);
    setInCache(cacheKey, output);
    console.log(`[Cache Set] suggestSceneFromAudioFlow: Cached scene suggestion under ${cacheKey}`);
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
