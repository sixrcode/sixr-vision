
/**
 * @fileOverview Centralized prompt strings for AI flows.
 * This helps with maintainability, reusability, and potential i18n.
 */

export const HARMONIOUS_PALETTES_PROMPT = `You are a color palette generation AI. You will generate a
harmonious color palette based on the provided base color hue, and the
number of colors requested. The output should be a JSON array of HSB
(Hue, Saturation, Brightness) color values. Hue is between 0 and 360,
saturation and brightness are between 0 and 100.

Base Color Hue: {{{baseColorHue}}}
Number of Colors: {{{numColors}}}

Ensure the generated colors are visually harmonious and work well together.
Use established color theory principles to create the palette.
`;

export const SUGGEST_SCENE_FROM_AUDIO_PROMPT = `
You are an AI scene-selection expert for an audio-reactive visualiser.
Theme: **Cosmic Grapevines** (growth, connection, cosmic journey, Afrofuturist aesthetics).

Given bass/mid/treble energy and BPM, choose the most fitting scene from
the list below. Explain **why** in a short metaphor (Cosmic Grapevines themed), and provide a 2–5-word
procedural-asset prompt that aligns with the "Cosmic Grapevines" theme and the suggested scene's mood.
Asset prompts should evoke organic cosmic imagery (e.g., "stellar vine sprouts", "galactic seed burst", "nebula roots").

Scenes list:
- mirror_silhouette   (reflective performer silhouette; cosmic entity, introspective journey)
- echoing_shapes      (appearing shapes; sprouting seeds, emerging thoughts)
- frequency_rings     (concentric waves; energy ripples, communication waves)
- neon_pulse_grid     (pulsing lattice; cosmic network, interconnected pathways)
- spectrum_bars       (vertical frequency bars; energy conduits, growing vines)
- radial_burst        (center-out particle bursts; seed explosions, stellar flares)
- geometric_tunnel    (flying tunnel; journey through vine network, wormhole travel)
- strobe_light        (flashing peaks; cosmic pulses, sudden insights)
- particle_finale     (dense particle bloom; universe of stars, ultimate cosmic connection)

Bass Energy:   {{{bassEnergy}}}
Mid Energy:    {{{midEnergy}}}
Treble Energy: {{{trebleEnergy}}}
BPM:           {{{bpm}}}
  `.trim();

export const GENERATE_SCENE_AMBIANCE_PROMPT = `
You are a creative director for an audio-visualizer experience themed "Cosmic Grapevines," inspired by Octavia E. Butler's "Parable of the Sower" and Afrofuturist aesthetics.
Your task is to generate a short, evocative ambiance text (1-2 sentences, maximum 30 words) that captures the current audiovisual mood.
Use metaphors of seeds, roots, vines, stars, growth, connection, space travel, and transformation where appropriate.
The language should be poetic, slightly visionary, and aligned with Afrofuturist themes.

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
  `.trim();

export const GENERATE_VISUAL_OVERLAY_PROMPT_TEMPLATE = `
      Create a visually appealing overlay image suitable for an audio visualizer, embodying an Afrofuturist "Cosmic Grapevines" theme.
      The current visualizer scene is named "{{currentSceneName}}".
      The audio context is: {{audioDescription}}.
      The user's desired theme for the overlay is: "{{userPrompt}}".
      The image should incorporate transparency (e.g., alpha channel in PNG) or be designed to blend well (e.g., using 'overlay' or 'screen' modes).
      Focus on abstract patterns, light effects, organic vine-like structures, starry or nebular elements, and subtle Afrocentric geometric patterns. Avoid solid, opaque backgrounds unless specifically requested.
      Output as a square PNG image.
    `;
