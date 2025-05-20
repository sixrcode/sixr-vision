
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
    .describe('The reason why this scene was suggested based on the audio analysis.'),
  suggestedAssetPrompt: z.string().describe('A short, creative prompt for generating procedural assets (like textures or simple meshes) that would visually complement the suggested scene and audio mood. E.g., "flowing lava", "crystal shards", "pulsating nebula".'),
});
export type SuggestSceneFromAudioOutput = z.infer<
  typeof SuggestSceneFromAudioOutputSchema
>;

export async function suggestSceneFromAudio(
  input: SuggestSceneFromAudioInput
): Promise<SuggestSceneFromAudioOutput> {
  return suggestSceneFromAudioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestSceneFromAudioPrompt',
  input: {schema: SuggestSceneFromAudioInputSchema},
  output: {schema: SuggestSceneFromAudioOutputSchema},
  prompt: `You are an AI scene selector expert for an audio-reactive visualizer.

You are provided with the bass, mid, and treble energy, as well as the BPM of the current audio.
Based on this information, you will suggest the most fitting scene and provide a reason.

Consider these scenes:
- Spectrum Bars: ID 'spectrum_bars'. A scene with vertical bars that react to the different frequencies of the audio. Good for high energy across all frequencies, clear representation of sound.
- Radial Burst: ID 'radial_burst'. A scene with particles that burst from the center of the screen. Good for rhythmic music with a clear beat, percussive sounds, and high energy moments.
- Mirror Silhouette: ID 'mirror_silhouette'. A scene that creates a mirrored silhouette of the performer using a webcam. Good for slower, more atmospheric music, or performances where the artist's form is central.
- Particle Finale: ID 'particle_finale'. A scene with a large number of particles that create a visually stunning finale. Good for the end of a song, a high-energy breakdown, or climactic moments.

Bass Energy: {{bassEnergy}}
Mid Energy: {{midEnergy}}
Treble Energy: {{trebleEnergy}}
BPM: {{bpm}}

Suggest a scene ID and explain your reasoning.
Also, provide a 'suggestedAssetPrompt'. This should be a short, creative text prompt (2-5 words) for generating procedural assets (like textures or simple meshes) that would visually complement your chosen scene and the audio's mood. For example, if the music is intense and you suggest 'Radial Burst', an asset prompt could be 'explosive energy shards'. If it's atmospheric for 'Mirror Silhouette', it might be 'ethereal light streaks'.`,
});

const suggestSceneFromAudioFlow = ai.defineFlow(
  {
    name: 'suggestSceneFromAudioFlow',
    inputSchema: SuggestSceneFromAudioInputSchema,
    outputSchema: SuggestSceneFromAudioOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    if (!response.output) {
        // This case should ideally be caught by Genkit if the output schema is defined 
        // and the model fails to produce it, or if the API call itself failed.
        // Adding an explicit check for robustness.
        console.error('AI prompt for scene suggestion returned no output despite a successful API call.');
        throw new Error('AI failed to suggest a scene (no output returned from model).');
    }
    return response.output;
  }
);

