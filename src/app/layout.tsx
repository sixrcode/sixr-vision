
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';

// The fonts.css file can be re-imported here if it contains active @font-face rules.
// It's currently not imported as Torus font loading via next/font/local is disabled.
// import './fonts.css';
import './globals.css';

import { Toaster } from '@/components/ui/toaster';
import { AppProviders } from '@/providers/AppProviders';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CONTROL_PANEL_WIDTH_STRING } from '@/lib/constants';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

// === DATA 70 FONT CONFIGURATION ===
// IMPORTANT: Ensure the font file 'Data70.ttf' is in 'src/app/fonts/'.
const data70Font = localFont({
  src: [
    {
      path: './fonts/Data70.ttf', // Path relative to this file (src/app/layout.tsx)
      // weight and style can be specified if you have multiple .ttf files for different styles
      // For a single .ttf, you might omit weight/style or set a default.
      // If Data70.ttf includes multiple weights, you might need to specify them here
      // or load them as separate font instances if they are separate files.
    },
  ],
  variable: '--font-data70',
  display: 'swap',
  fallback: ['var(--font-geist-mono)', 'monospace'], // Fallback if Data70 fails to load
});


// === TORUS FONT CURRENTLY DISABLED DUE TO "FILE NOT FOUND" ERRORS ===
// To re-enable:
// 1. Uncomment the 'torusVariationsFont' constant definition below.
// 2. Change 'torusVariations' to use the loaded font: const torusVariations = torusVariationsFont;
// 3. Update 'src/lib/brandingConstants.ts' to use 'var(--font-torus-variations)'.
// 4. Ensure the font file 'TorusVariations-VF.woff2' (or .ttf if that's what you have) is in 'src/app/fonts/'.
//    Adjust the 'path' in the src array below if using a different file type.

/*
const torusVariationsFont = localFont({
  src: [
    {
      path: './fonts/TorusVariations-VF.woff2',
      weight: '100 900', // Example for variable font
      style: 'normal',
    },
  ],
  variable: '--font-torus-variations',
  display: 'swap',
});
*/

// const torusVariations = torusVariationsFont; // Use this if font loading is re-enabled
const torusVariations = { variable: '' }; // Placeholder if Torus font loading is disabled

export const metadata: Metadata = {
  title: 'SIXR Vision - SBNF Cosmic Grapevines',
  description: 'Audio-Reactive Visualizer with AI Features, themed for SBNF 2025',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html {
                background-color: hsl(var(--background-hsl)); /* Matches --background-hsl from globals.css */
              }
            `,
          }}
        />
      </head>
      <body className={`${poppins.variable} ${GeistMono.variable} ${data70Font.variable} ${torusVariations.variable} overflow-x-hidden`}>
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
