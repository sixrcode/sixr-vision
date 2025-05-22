
export const SIXR_S_COLOR = "hsl(var(--sixr-s-color-hsl))";
export const SIXR_I_COLOR = "hsl(var(--sixr-i-color-hsl))";
export const SIXR_X_COLOR = "hsl(var(--sixr-x-color-hsl))";
export const SIXR_R_COLOR = "hsl(var(--sixr-r-color-hsl))";

// === TORUS FONT CONFIGURATION ===
// Currently commented out due to file not found issues.
// To enable:
// 1. Ensure 'Fontspring-DEMO-toruspro-variable.ttf' is in 'src/app/fonts/'.
// 2. Uncomment the 'torusVariationsFont' definition and its usage in `src/app/layout.tsx`.
// 3. Uncomment the line below.
// const torusFontVar = 'var(--font-torus-variations)';
const torusFontVar = 'var(--font-geist-mono)'; // Fallback
export const TORUS_FONT_FAMILY = `${torusFontVar}, var(--font-geist-mono), monospace`;


// === SBNF FONT CONFIGURATION ===
// Uses CSS variables defined by next/font/local and next/font/google in src/app/layout.tsx
// Ensure 'Data70.ttf' (or the file you have) is in 'src/app/fonts/'.
export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), var(--font-geist-mono), monospace";
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";

    