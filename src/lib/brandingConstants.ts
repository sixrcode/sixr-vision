
export const SIXR_S_COLOR = "hsl(var(--sixr-s-color-hsl))";
export const SIXR_I_COLOR = "hsl(var(--sixr-i-color-hsl))";
export const SIXR_X_COLOR = "hsl(var(--sixr-x-color-hsl))";
export const SIXR_R_COLOR = "hsl(var(--sixr-r-color-hsl))";

// Use the CSS variable defined by next/font/local for Torus Variations when re-enabled
// Currently using fallback because Torus font loading is temporarily disabled.
// To re-enable Torus:
// 1. Ensure 'TorusVariations-VF.woff2' is in 'src/app/fonts/'.
// 2. Uncomment Torus font loading in 'src/app/layout.tsx'.
// 3. Change this line to: export const TORUS_FONT_FAMILY = "var(--font-torus-variations), var(--font-geist-mono), monospace";

// export const TORUS_FONT_FAMILY = "var(--font-torus-variations), var(--font-geist-mono), monospace";
export const TORUS_FONT_FAMILY = "var(--font-geist-mono), monospace"; // Fallback if Torus font is disabled

