
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';

// The fonts.css file can be re-imported here if it contains active @font-face rules.
// It's currently not imported as Torus font loading via next/font/local is (now being re-enabled).
// import './fonts.css'; // Currently only contains comments
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
// Create the 'src/app/fonts/' directory if it doesn't exist.
const data70Font = localFont({
  src: [
    {
      path: './fonts/Data70.ttf', // Expects Data70.ttf in src/app/fonts/
    },
  ],
  variable: '--font-data70',
  display: 'swap',
  fallback: ['var(--font-geist-mono)', 'monospace'], // Fallback if Data70 fails to load
});


// === TORUS FONT CONFIGURATION ===
// Re-enabled to use Fontspring-DEMO-toruspro-variable.ttf
// IMPORTANT:
// 1. Ensure the font file 'Fontspring-DEMO-toruspro-variable.ttf' is in 'src/app/fonts/'.
// 2. Create the 'src/app/fonts/' directory if it doesn't exist.
const torusVariationsFont = localFont({
  src: [
    {
      // Path relative to this layout.tsx file
      path: './fonts/Fontspring-DEMO-toruspro-variable.ttf',
      // weight: '100 900', // Example for variable font - adjust if needed
      // style: 'normal',   // Adjust if needed
    },
  ],
  variable: '--font-torus-variations',
  display: 'swap',
  fallback: ['var(--font-geist-mono)', 'monospace'], // Fallback if Torus fails
});

const torusVariations = torusVariationsFont;
// const torusVariations = { variable: '' }; // Placeholder if Torus font loading is disabled

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
      <body className={`${poppins.variable} ${GeistSans.variable} ${GeistMono.variable} ${data70Font.variable} ${torusVariations.variable} overflow-x-hidden`}>
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
