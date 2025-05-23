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
import { defaultSafetySettings } from '../sharedConstants';

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
const MODEL_NAME_TEXT = 'googleai/gemini-2.0-flash';

console.log(`[AI Flow Init] generateSceneAmbianceFlow uses model: ${MODEL_NAME_TEXT}`);

export async function generateSceneAmbiance(
  input: GenerateSceneAmbianceInput
): Promise<GenerateSceneAmbianceOutput> {
  return generateSceneAmbianceFlow(input);
}

const ambiancePrompt = ai.definePrompt({
  name: 'generateSceneAmbiancePrompt',
  input: {schema: GenerateSceneAmbianceInputSchema},
  output: {schema: GenerateSceneAmbianceOutputSchema},
  prompt: `
You are a creative director for an audio-visualizer experience themed "Cosmic Grapevines," inspired by Octavia E. Butler's "Parable of the Sower."
Your task is to generate a short, evocative ambiance text (1-2 sentences, maximum 30 words) that captures the current audiovisual mood.
Use metaphors of seeds, roots, vines, stars, growth, connection, and transformation where appropriate.
The language should be poetic and slightly visionary.

Current Visualizer Scene: "{{currentSceneName}}" (ID: {{currentSceneId}})
Current Audio Mood:
- Bass Energy: {{audioData.bassEnergy}}
- Mid Energy: {{audioData.midEnergy}}
- Treble Energy: {{audioData.trebleEnergy}}
- Overall Volume (RMS): {{audioData.rms}}
- Tempo (BPM): {{audioData.bpm}}
- Beat Detected: {{audioData.beat}}

Combine the scene's nature with the audio data to describe the atmosphere.
Example for high energy in "Radial Burst": "Explosive energy pulses from the core, painting the void with every beat."
Example for low energy in "Mirror Silhouette": "A fleeting reflection dances in the ethereal glow, swaying to a gentle rhythm."
Example for "Cosmic Grapevines" theme: "Tender green lights unfurl into a constellation – the music plants a seed among the stars."
  `.trim(),
  config: {
    model: MODEL_NAME_TEXT,
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
    // Simplified cache key: use scene ID and a hash of the prompt string itself,
    // as audio data is too dynamic for effective direct caching in this context.
    // For more nuanced caching, one might categorize audioData into 'low', 'medium', 'high' energy states.
    const cacheKey = `${input.currentSceneId}-${input.currentSceneName}`;

    if (ambianceCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateSceneAmbianceFlow: Returning cached ambiance for key: ${cacheKey}`);
      return ambianceCache.get(cacheKey)!;
    }
    console.log(`[Cache Miss] generateSceneAmbianceFlow: Generating ambiance for key: "${cacheKey}" using model: ${MODEL_NAME_TEXT}`);
    
    const startTime = performance.now();
    const {output} = await ambiancePrompt(input);
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateSceneAmbianceFlow prompt call took ${(endTime - startTime).toFixed(2)} ms`);

    if (!output || !output.ambianceText) {
      throw new Error('AI failed to generate ambiance text.');
    }
    
    ambianceCache.set(cacheKey, output);
    console.log(`[Cache Set] generateSceneAmbianceFlow: Cached ambiance for key: ${cacheKey}`);
    return output;
  }
);
