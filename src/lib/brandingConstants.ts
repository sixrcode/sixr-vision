
export const SIXR_S_COLOR = "hsl(var(--sixr-s-color-hsl))";
export const SIXR_I_COLOR = "hsl(var(--sixr-i-color-hsl))";
export const SIXR_X_COLOR = "hsl(var(--sixr-x-color-hsl))";
export const SIXR_R_COLOR = "hsl(var(--sixr-r-color-hsl))";

// === TORUS FONT RE-ENABLED ===
// Uses the CSS variable defined by next/font/local in src/app/layout.tsx
// Ensure 'Fontspring-DEMO-toruspro-variable.ttf' is in 'src/app/fonts/'.
const torusFontVar = 'var(--font-torus-variations)';
// const torusFontVar = 'var(--font-geist-mono)'; // Fallback if Torus font loading is disabled
export const TORUS_FONT_FAMILY = `${torusFontVar}, var(--font-geist-mono), monospace`;


// === DATA 70 FONT CONFIGURATION ===
// Uses the CSS variable defined by next/font/local in src/app/layout.tsx
// Ensure 'Data70.ttf' is in 'src/app/fonts/'.
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), var(--font-geist-mono), monospace";
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";
