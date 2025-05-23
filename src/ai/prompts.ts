
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

// Add other prompts here as they are extracted
// e.g., export const SCENE_SUGGESTION_PROMPT = `...`;
