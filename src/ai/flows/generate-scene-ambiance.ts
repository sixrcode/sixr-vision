
'use server';
/**
 * @fileOverview An AI agent that generates evocative ambiance text based on audio data and the current scene.
 *
 * - generateSceneAmbiance - Main entry point for generating ambiance text.
 * - GenerateSceneAmbianceInput - Zod schema for the input.
 * - GenerateSceneAmbianceOutput - Zod schema for the output.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { defaultSafetySettings, MODEL_NAME_TEXT_GENERATION } from '../sharedConstants';
import { GENERATE_SCENE_AMBIANCE_PROMPT } from '../prompts';

// Define a Zod schema for the audio data fields we need for this flow
const AudioDataInputSchema = z.object({
  bassEnergy: z.number().describe('Bass-band energy (0-1).'),
  midEnergy: z.number().describe('Mid-band energy (0-1).'),
  trebleEnergy: z.number().describe('Treble-band energy (0-1).'),
  rms: z.number().describe('Overall root mean square volume (0-1).'),
  bpm: z.number().describe('Estimated beats per minute of the audio.'),
  beat: z.boolean().describe('Whether a beat is currently detected.'),
});

const GenerateSceneAmbianceInputSchema = z.object({
  audioData: AudioDataInputSchema.describe('Current characteristics of the audio input.'),
  currentSceneId: z.string().describe('The ID of the currently active visualizer scene.'),
  currentSceneName: z.string().describe('The display name of the currently active visualizer scene (e.g., "Radial Burst").'),
});
export type GenerateSceneAmbianceInput = z.infer<typeof GenerateSceneAmbianceInputSchema>;

const GenerateSceneAmbianceOutputSchema = z.object({
  ambianceText: z.string().describe('A short, evocative text (1-2 sentences, ~30 words) describing the current audiovisual mood, inspired by "Cosmic Grapevines" theme.'),
});
export type GenerateSceneAmbianceOutput = z.infer<typeof GenerateSceneAmbianceOutputSchema>;

// In-memory cache for this flow
const ambianceCache = new Map<string, GenerateSceneAmbianceOutput>();

console.log(`[AI Flow Init] generateSceneAmbianceFlow uses model: ${MODEL_NAME_TEXT_GENERATION}`);

export async function generateSceneAmbiance(
  input: GenerateSceneAmbianceInput
): Promise<GenerateSceneAmbianceOutput> {
  return generateSceneAmbianceFlow(input);
}

const ambiancePrompt = ai.definePrompt({
  name: 'generateSceneAmbiancePrompt',
  input: {schema: GenerateSceneAmbianceInputSchema},
  output: {schema: GenerateSceneAmbianceOutputSchema},
  prompt: GENERATE_SCENE_AMBIANCE_PROMPT,
  config: {
    model: MODEL_NAME_TEXT_GENERATION,
    safetySettings: defaultSafetySettings,
  },
});

const generateSceneAmbianceFlow = ai.defineFlow(
  {
    name: 'generateSceneAmbianceFlow',
    inputSchema: GenerateSceneAmbianceInputSchema,
    outputSchema: GenerateSceneAmbianceOutputSchema,
  },
  async (input: GenerateSceneAmbianceInput): Promise<GenerateSceneAmbianceOutput> => {
    const cacheKey = `${input.currentSceneId}-${input.currentSceneName}-${Math.round(input.audioData.rms*10)}-${Math.round(input.audioData.bpm/10)}`; // Simplified cache key

    if (ambianceCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateSceneAmbianceFlow: Returning cached ambiance for key: ${cacheKey}`);
      return ambianceCache.get(cacheKey)!;
    }
    console.log(`[Cache Miss] generateSceneAmbianceFlow: Generating ambiance for key: "${cacheKey}" using model: ${MODEL_NAME_TEXT_GENERATION}`);
    
    const startTime = performance.now();
    const {output} = await ambiancePrompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateSceneAmbianceFlow prompt call took ${(endTime - startTime).toFixed(2)} ms for model ${MODEL_NAME_TEXT_GENERATION}`);

    if (!output || !output.ambianceText) {
      throw new Error('AI failed to generate ambiance text.');
    }
    
    ambianceCache.set(cacheKey, output);
    console.log(`[Cache Set] generateSceneAmbianceFlow: Cached ambiance for key: ${cacheKey}`);
    return output;
  }
);
