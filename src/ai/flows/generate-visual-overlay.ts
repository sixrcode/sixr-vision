
'use server';
/**
 * @fileOverview A Genkit flow to generate a visual overlay image based on a prompt, audio data, and current scene.
 *
 * - generateVisualOverlay - A function that handles the overlay image generation.
 * - GenerateVisualOverlayInput - The input type for the generateVisualOverlay function.
 * - GenerateVisualOverlayOutput - The return type for the generateVisualOverlay function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { defaultSafetySettings, MODEL_NAME_IMAGE_GENERATION } from '../sharedConstants';
import { GENERATE_VISUAL_OVERLAY_PROMPT_TEMPLATE } from '../prompts';

// Re-define a Zod schema for the parts of AudioData we need.
const AudioContextInputSchema = z.object({
  bassEnergy: z.number().describe('The energy of the bass frequencies (0-1).'),
  midEnergy: z.number().describe('The energy of the mid frequencies (0-1).'),
  trebleEnergy: z.number().describe('The energy of the treble frequencies (0-1).'),
  rms: z.number().describe('The overall root mean square volume (0-1).'),
  bpm: z.number().describe('The estimated beats per minute of the audio.'),
});

const GenerateVisualOverlayInputSchema = z.object({
  prompt: z.string().describe('A user-provided text prompt describing the desired visual overlay style or theme.'),
  audioContext: AudioContextInputSchema.describe('Current characteristics of the audio input.'),
  currentSceneName: z.string().describe('The display name of the currently active visualizer scene (e.g., "Radial Burst").'),
});
export type GenerateVisualOverlayInput = z.infer<typeof GenerateVisualOverlayInputSchema>;

const GenerateVisualOverlayOutputSchema = z.object({
  overlayImageDataUri: z
    .string()
    .describe(
      "A data URI containing the generated overlay image, ideally with transparency or suitable for blending. Must include a MIME type and use Base64 encoding. Expected format: 'data:image/png;base64,<encoded_data>'."
    ),
});
export type GenerateVisualOverlayOutput = z.infer<typeof GenerateVisualOverlayOutputSchema>;

// In-memory cache for this flow
const generateOverlayCache = new Map<string, GenerateVisualOverlayOutput>();
console.log(`[AI Flow Init] generateVisualOverlayFlow uses model: ${MODEL_NAME_IMAGE_GENERATION}`);


export async function generateVisualOverlay(input: GenerateVisualOverlayInput): Promise<GenerateVisualOverlayOutput> {
  return generateVisualOverlayFlow(input);
}

// This Genkit flow does not use a separate handlebars prompt object because
// the prompt to the image generation model is constructed dynamically within the flow.
const generateVisualOverlayFlow = ai.defineFlow(
  {
    name: 'generateVisualOverlayFlow',
    inputSchema: GenerateVisualOverlayInputSchema,
    outputSchema: GenerateVisualOverlayOutputSchema,
  },
  async (input: GenerateVisualOverlayInput): Promise<GenerateVisualOverlayOutput> => {
    const cacheKey = `${input.prompt}-${input.currentSceneName}-${Math.round(input.audioContext.rms * 10)}-${Math.round(input.audioContext.bpm/10)}`;
    if (generateOverlayCache.has(cacheKey)) {
      console.log(`[Cache Hit] generateVisualOverlayFlow: Returning cached overlay for key: ${cacheKey}`);
      return generateOverlayCache.get(cacheKey)!;
    }
    console.log(`[Cache Miss] generateVisualOverlayFlow: Generating overlay for key: ${cacheKey} using model: ${MODEL_NAME_IMAGE_GENERATION}`);

    let audioDescription = "The audio is";
    if (input.audioContext.rms < 0.2) audioDescription += " calm and quiet";
    else if (input.audioContext.rms > 0.7) audioDescription += " loud and energetic";
    else audioDescription += " moderately dynamic";

    if (input.audioContext.bpm < 100) audioDescription += `, with a slow tempo (around ${input.audioContext.bpm} BPM).`;
    else if (input.audioContext.bpm > 140) audioDescription += `, with a fast tempo (around ${input.audioContext.bpm} BPM).`;
    else audioDescription += `, with a medium tempo (around ${input.audioContext.bpm} BPM).`;
    
    audioDescription += ` Bass energy is ${input.audioContext.bassEnergy.toFixed(2)}, mid energy is ${input.audioContext.midEnergy.toFixed(2)}, treble energy is ${input.audioContext.trebleEnergy.toFixed(2)}.`;

    const imageGenerationPrompt = GENERATE_VISUAL_OVERLAY_PROMPT_TEMPLATE
      .replace('{{currentSceneName}}', input.currentSceneName)
      .replace('{{audioDescription}}', audioDescription)
      .replace('{{userPrompt}}', input.prompt);


    console.log("[AI Flow Debug] Generating AI Visual Overlay with prompt:", imageGenerationPrompt);
    
    const startTime = performance.now();
    const {media} = await ai.generate({
      model: MODEL_NAME_IMAGE_GENERATION,
      prompt: imageGenerationPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], 
        safetySettings: defaultSafetySettings,
      },
    });
    const endTime = performance.now();
    console.log(`[AI Benchmark] generateVisualOverlayFlow ai.generate call took ${(endTime - startTime).toFixed(2)} ms for model ${MODEL_NAME_IMAGE_GENERATION}`);

    if (!media?.url) {
      throw new Error('Overlay image generation failed to return a media URL.');
    }

    const result: GenerateVisualOverlayOutput = {
      overlayImageDataUri: media.url,
    };

    generateOverlayCache.set(cacheKey, result);
    console.log(`[Cache Set] generateVisualOverlayFlow: Cached overlay for key: ${cacheKey}`);
    return result;
  }
);
