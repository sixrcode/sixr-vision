
export const SIXR_S_COLOR = "hsl(var(--sixr-s-color-hsl))";
export const SIXR_I_COLOR = "hsl(var(--sixr-i-color-hsl))";
export const SIXR_X_COLOR = "hsl(var(--sixr-x-color-hsl))";
export const SIXR_R_COLOR = "hsl(var(--sixr-r-color-hsl))";

// === TORUS FONT CONFIGURATION ===
// Currently commented out due to font file not found issues / being disabled.
// To enable:
// 1. Ensure 'Fontspring-DEMO-toruspro-variable.ttf' is in 'src/app/fonts/'.
// 2. Uncomment the 'torusVariationsFont' definition and its usage in `src/app/layout.tsx`.
// 3. Uncomment the line below and update the fallback.
// const torusFontVar = 'var(--font-torus-variations)';
const torusFontVar = 'monospace'; // Fallback to system monospace as GeistMono is also disabled
export const TORUS_FONT_FAMILY = `${torusFontVar}, monospace`;


// === SBNF FONT CONFIGURATION ===
// Uses CSS variables defined by next/font/local and next/font/google in src/app/layout.tsx
// Ensure 'Data70.ttf' is in 'src/app/fonts/'.
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), monospace"; // System monospace as fallback if DATA 70 or GeistMono not available
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), sans-serif";
