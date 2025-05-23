
'use server';
/**
 * @fileOverview A Genkit flow to generate evocative ambiance text based on audio data and current scene.
 *
 * - generateSceneAmbiance - A function that handles the ambiance text generation.
 * - GenerateSceneAmbianceInput - The input type for the generateSceneAmbiance function.
 * - GenerateSceneAmbianceOutput - The return type for the generateSceneAmbiance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { AudioData } from '@/types'; // Assuming AudioData is defined here
import { defaultSafetySettings } from '../sharedConstants';

// Re-define a Zod schema for the parts of AudioData we need, as we can't directly import the TS type into Zod.
const AudioDataInputSchema = z.object({
  bassEnergy: z.number().describe('The energy of the bass frequencies (0-1).'),
  midEnergy: z.number().describe('The energy of the mid frequencies (0-1).'),
  trebleEnergy: z.number().describe('The energy of the treble frequencies (0-1).'),
  rms: z.number().describe('The overall root mean square volume (0-1).'),
  bpm: z.number().describe('The estimated beats per minute of the audio.'),
  beat: z.boolean().describe('Whether a beat is currently detected.'),
  // spectrum can be omitted for this flow as it's high-cardinality and less useful for high-level mood.
});

const GenerateSceneAmbianceInputSchema = z.object({
  audioData: AudioDataInputSchema.describe('Current characteristics of the audio input.'),
  currentSceneId: z.string().describe('The ID of the currently active visualizer scene (e.g., "radial_burst", "spectrum_bars").'),
  currentSceneName: z.string().describe('The display name of the currently active visualizer scene (e.g., "Radial Burst").'),
});
export type GenerateSceneAmbianceInput = z.infer<typeof GenerateSceneAmbianceInputSchema>;

const GenerateSceneAmbianceOutputSchema = z.object({
  ambianceText: z.string().describe('A short, evocative phrase or sentence (1-2 sentences, max 30 words) describing the current audiovisual mood and ambiance, ideally reflecting themes of "Cosmic Grapevines" (growth, connection, stars, seeds, vines).'),
});
export type GenerateSceneAmbianceOutput = z.infer<typeof GenerateSceneAmbianceOutputSchema>;

// In-memory cache for this flow
const generateAmbianceCache = new Map<string, GenerateSceneAmbianceOutput>();

export async function generateSceneAmbiance(input: GenerateSceneAmbianceInput): Promise<GenerateSceneAmbianceOutput> {
  return generateSceneAmbianceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSceneAmbiancePrompt',
  input: {schema: GenerateSceneAmbianceInputSchema},
  output: {schema: GenerateSceneAmbianceOutputSchema},
  prompt: `You are a creative director for an audio-visualizer. The overall theme is "Cosmic Grapevines," evoking growth, connection, and celestial journeys.
Your task is to write a short, evocative ambiance text (1-2 sentences, maximum 30 words) that captures the current mood and feeling conveyed by the audio and visuals, weaving in metaphors related to the "Cosmic Grapevines" theme (e.g., seeds, roots, vines, stars, cosmic growth, connection).

Current Scene: "{{currentSceneName}}" (ID: {{currentSceneId}})
Audio Characteristics:
- Bass Energy: {{audioData.bassEnergy}} (0-1 scale)
- Mid Energy: {{audioData.midEnergy}} (0-1 scale)
- Treble Energy: {{audioData.trebleEnergy}} (0-1 scale)
- Overall Volume (RMS): {{audioData.rms}} (0-1 scale)
- Estimated BPM: {{audioData.bpm}}
- Beat Detected: {{audioData.beat}}

Consider the scene's nature and combine it with the audio data to describe the atmosphere. For example:
- If 'Radial Burst' is active with high energy audio: "Explosive energy pulses from the core, scattering seeds of light across the cosmic void."
- If 'Mirror Silhouette' is active with low energy, atmospheric audio: "A fleeting reflection sways, a solitary seed dreaming of starlit vines."
- If 'Spectrum Bars' is active with complex audio: "Digital monoliths rise and fall, charting the growth of an intricate soundscape."

Generate the ambiance text, reflecting the "Cosmic Grapevines" theme.`,
  config: {
    safetySettings: defaultSafetySettings,
  }
});

const generateSceneAmbianceFlow = ai.defineFlow(
  {
    name: 'generateSceneAmbianceFlow',
    inputSchema: GenerateSceneAmbianceInputSchema,
    outputSchema: GenerateSceneAmbianceOutputSchema,
  },
  async (input: GenerateSceneAmbianceInput): Promise<GenerateSceneAmbianceOutput> => {
    const cacheKey = JSON.stringify(input);
    if (generateAmbianceCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateSceneAmbianceFlow: Returning cached ambiance for input: ${cacheKey}`);
      return generateAmbianceCache.get(cacheKey)!;
    }
    console.log(`[Cache Miss] generateSceneAmbianceFlow: Generating ambiance for input: ${cacheKey}`);
    
    const startTime = performance.now();
    const {output} = await prompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateSceneAmbianceFlow prompt call took ${(endTime - startTime).toFixed(2)} ms`);

    if (!output) {
      throw new Error('AI failed to generate ambiance text.');
    }

    generateAmbianceCache.set(cacheKey, output);
    console.log(`[Cache Set] generateSceneAmbianceFlow: Cached ambiance for input: ${cacheKey}`);
    return output;
  }
);
