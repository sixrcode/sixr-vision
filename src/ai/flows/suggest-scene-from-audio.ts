
// The below code is auto-generated. Do not edit this code manually.
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting a scene based on audio analysis.
 *
 * - suggestSceneFromAudio - A function that takes audio analysis data and returns a suggested scene ID and asset prompt.
 * - SuggestSceneFromAudioInput - The input type for the suggestSceneFromAudio function.
 * - SuggestSceneFromAudioOutput - The return type for the suggestSceneFromAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestSceneFromAudioInputSchema = z.object({
  bassEnergy: z.number().describe('The energy of the bass frequencies in the audio.'),
  midEnergy: z.number().describe('The energy of the mid frequencies in the audio.'),
  trebleEnergy: z.number().describe('The energy of the treble frequencies in the audio.'),
  bpm: z.number().describe('The beats per minute of the audio.'),
});
export type SuggestSceneFromAudioInput = z.infer<
  typeof SuggestSceneFromAudioInputSchema
>;

const SuggestSceneFromAudioOutputSchema = z.object({
  sceneId: z.string().describe('The ID of the suggested scene.'),
  reason: z
    .string()
    .describe('The reason why this scene was suggested based on the audio analysis, ideally using metaphors of growth or cosmic connection related to the "Cosmic Grapevines" theme.'),
  suggestedAssetPrompt: z.string().describe('A short, creative prompt (2-5 words) for generating procedural assets (like textures or simple meshes) that would visually complement the suggested scene and audio mood, fitting the "Cosmic Grapevines" theme (e.g., "stellar vine sprouts", "galactic seed burst", "cosmic roots").'),
});
export type SuggestSceneFromAudioOutput = z.infer<
  typeof SuggestSceneFromAudioOutputSchema
>;

// In-memory cache for this flow
const suggestSceneCache = new Map<string, SuggestSceneFromAudioOutput>();

export async function suggestSceneFromAudio(
  input: SuggestSceneFromAudioInput
): Promise<SuggestSceneFromAudioOutput> {
  return suggestSceneFromAudioFlow(input);
}

const defaultSafetySettings = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const prompt = ai.definePrompt({
  name: 'suggestSceneFromAudioPrompt',
  input: {schema: SuggestSceneFromAudioInputSchema},
  output: {schema: SuggestSceneFromAudioOutputSchema},
  prompt: `You are an AI scene selector expert for an audio-reactive visualizer. The overall theme is "Cosmic Grapevines," inspired by Octavia E. Butler's Parable of the Sower, emphasizing growth, connection, and cosmic journey.

You are provided with the bass, mid, and treble energy, as well as the BPM of the current audio.
Based on this information, you will suggest the most fitting scene.

Consider these scenes:
- Spectrum Bars: ID 'spectrum_bars'. A scene with vertical bars that react to the different frequencies of the audio. Good for high energy across all frequencies, clear representation of sound. Could represent growing vines or energy conduits.
- Radial Burst: ID 'radial_burst'. A scene with particles that burst from the center of the screen. Good for rhythmic music with a clear beat, percussive sounds, and high energy moments. Could represent seeds bursting or stars forming.
- Mirror Silhouette: ID 'mirror_silhouette'. A scene that creates a mirrored silhouette of the performer using a webcam. Good for slower, more atmospheric music, or performances where the artist's form is central. Could represent an introspective "seed" stage or a cosmic entity.
- Particle Finale: ID 'particle_finale'. A scene with a large number of particles that create a visually stunning finale. Good for the end of a song, a high-energy breakdown, or climactic moments. Could represent a cosmic bloom or a universe of connected stars.
- Neon Pulse Grid: ID 'neon_pulse_grid'. A grid where cells pulse with light and color. Could represent a network of connections or a cosmic lattice.
- Frequency Rings: ID 'frequency_rings'. Concentric rings reacting to different frequencies. Could represent ripples of growth or cosmic energy waves.
- Strobe Light: ID 'strobe_light'. Flashes on musical beats. Good for peak energy moments.
- Echoing Shapes: ID 'echoing_shapes'. Simple geometric shapes appearing and fading. Could represent sprouting seeds or emerging cosmic forms.
- Geometric Tunnel: ID 'geometric_tunnel'. Illusion of flying through a tunnel of shapes. Could represent a journey through the cosmic vine network.


Bass Energy: {{bassEnergy}}
Mid Energy: {{midEnergy}}
Treble Energy: {{trebleEnergy}}
BPM: {{bpm}}

Suggest a scene ID.
Explain your reasoning using metaphors related to the "Cosmic Grapevines" theme (growth, connection, seeds, stars, journey).
Also, provide a 'suggestedAssetPrompt'. This should be a short, creative text prompt (2-5 words) for generating procedural assets (like textures or simple meshes) that would visually complement your chosen scene and the audio's mood, fitting the "Cosmic Grapevines" theme. Examples: "stellar vine sprouts", "galactic seed burst", "cosmic roots", "nebula flowers", "interstellar tendrils".`,
  config: {
    safetySettings: defaultSafetySettings,
  }
});

const suggestSceneFromAudioFlow = ai.defineFlow(
  {
    name: 'suggestSceneFromAudioFlow',
    inputSchema: SuggestSceneFromAudioInputSchema,
    outputSchema: SuggestSceneFromAudioOutputSchema,
  },
  async (input: SuggestSceneFromAudioInput): Promise<SuggestSceneFromAudioOutput> => {
    const cacheKey = JSON.stringify(input);
    if (suggestSceneCache.has(cacheKey)) {
      console.log(`[Cache Hit] suggestSceneFromAudioFlow: Returning cached scene suggestion for input: ${cacheKey}`);
      return suggestSceneCache.get(cacheKey)!;
    }
    console.log(`[Cache Miss] suggestSceneFromAudioFlow: Generating scene suggestion for input: ${cacheKey}`);

    const {output} = await prompt(input);
    if (!output) {
        throw new Error('AI failed to suggest a scene (no output returned from model).');
    }

    suggestSceneCache.set(cacheKey, output);
    console.log(`[Cache Set] suggestSceneFromAudioFlow: Cached scene suggestion for input: ${cacheKey}`);
    return output;
  }
);
