
export const SIXR_S_COLOR = "hsl(var(--sixr-s-color-hsl))";
export const SIXR_I_COLOR = "hsl(var(--sixr-i-color-hsl))";
export const SIXR_X_COLOR = "hsl(var(--sixr-x-color-hsl))";
export const SIXR_R_COLOR = "hsl(var(--sixr-r-color-hsl))";

// === TORUS FONT CURRENTLY DISABLED ===
// To re-enable Torus:
// 1. Ensure 'TorusVariations-VF.woff2' is in 'src/app/fonts/'.
// 2. Uncomment Torus font loading in 'src/app/layout.tsx'.
// 3. Change this line to: export const TORUS_FONT_FAMILY = "var(--font-torus-variations), var(--font-geist-mono), monospace";
export const TORUS_FONT_FAMILY = "var(--font-geist-mono), monospace"; // Fallback if Torus font is disabled

// === DATA 70 FONT CURRENTLY DISABLED ===
// To re-enable DATA 70:
// 1. Ensure 'Data70.woff2' is in 'src/app/fonts/'.
// 2. Uncomment DATA 70 font loading in 'src/app/layout.tsx'.
// 3. Change this line to: export const SBNF_TITLE_FONT_FAMILY = "var(--font-data70), var(--font-geist-mono), monospace";
export const SBNF_TITLE_FONT_FAMILY = "var(--font-geist-mono), monospace"; // Fallback if Data70 font is disabled
export const SBNF_BODY_FONT_FAMILY = "var(--font-poppins), var(--font-geist-sans), sans-serif";
