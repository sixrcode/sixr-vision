
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
// import localFont from 'next/font/local'; // Re-enable import if Torus font file is correctly placed
import './globals.css';
// The fonts.css file can be re-imported here if it contains active @font-face rules.
// import './fonts.css'; // Remains removed as it's not actively loading Torus and next/font/local handles it.
import { Toaster } from '@/components/ui/toaster';
import { AppProviders } from '@/providers/AppProviders';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CONTROL_PANEL_WIDTH_STRING } from '@/lib/constants';

// Configure Torus Variations font using next/font/local
// IMPORTANT: This configuration expects the font file to be at src/app/fonts/TorusVariations-VF.woff2
// Please ensure you have:
// 1. Created the 'fonts' directory inside 'src/app/' (i.e., src/app/fonts/).
// 2. Placed your 'TorusVariations-VF.woff2' file there.
// 3. The filename and casing MUST match EXACTLY.

// === TORUS FONT CURRENTLY DISABLED DUE TO "FILE NOT FOUND" ERRORS ===
// To re-enable:
// 1. Uncomment the 'localFont' import above.
// 2. Uncomment the 'torusVariationsFont' constant definition below.
// 3. Change 'torusVariations' to use the loaded font: const torusVariations = torusVariationsFont;
// 4. Update 'src/lib/brandingConstants.ts' to use 'var(--font-torus-variations)'.
// 5. Ensure the font file 'TorusVariations-VF.woff2' is in 'src/app/fonts/'.

/*
const torusVariationsFont = localFont({
  src: [
    {
      path: './fonts/TorusVariations-VF.woff2', // Path relative to this file (src/app/layout.tsx)
      weight: '100 900', // Assuming it's a variable font, specify the weight range
      style: 'normal',
    },
  ],
  variable: '--font-torus-variations', // CSS variable name
  display: 'swap', // Improves perceived loading performance
});
*/

// const torusVariations = torusVariationsFont; // Use this if font loading is re-enabled
const torusVariations = { variable: '' }; // Placeholder if font loading is disabled

export const metadata: Metadata = {
  title: 'SIXR Vision',
  description: 'Audio-Reactive Visualizer with AI Features',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${torusVariations.variable} font-sans antialiased overflow-x-hidden`}>
        <SidebarProvider style={{ "--sidebar-width": CONTROL_PANEL_WIDTH_STRING } as React.CSSProperties}>
          <AppProviders>
            {children}
            <Toaster />
          </AppProviders>
        </SidebarProvider>
      </body>
    </html>
  );
}
