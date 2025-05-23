
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
// import { GeistSans } from 'geist/font/sans'; // Temporarily disabled due to 403 errors in Firebase Studio
// import { GeistMono } from 'geist/font/mono'; // Temporarily disabled due to 403 errors in Firebase Studio
import localFont from 'next/font/local';

// import './fonts.css'; // No longer needed for Torus as it's handled by next/font/local
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

// Fallback if GeistSans loading is disabled (due to 403 errors in Firebase Studio)
const geistSans = { variable: '' };
// Fallback if GeistMono loading is disabled (due to 403 errors in Firebase Studio)
const geistMono = { variable: '' };

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
  fallback: ['monospace'], 
});
// const data70Font = { variable: ''}; // Use this if Data70.ttf is confirmed unavailable & causing build errors

// === TORUS FONT CONFIGURATION ===
// Now using Fontspring-DEMO-toruspro-variable.ttf
// IMPORTANT: Ensure 'Fontspring-DEMO-toruspro-variable.ttf' is in 'src/app/fonts/'.
const torusVariationsFont = localFont({
  src: [
    {
      // Path relative to this layout.tsx file
      path: './fonts/Fontspring-DEMO-toruspro-variable.ttf',
    },
  ],
  variable: '--font-torus-variations',
  display: 'swap',
  fallback: ['monospace'], // Use system monospace as fallback
});
// const torusVariationsFont = { variable: '' }; // Placeholder if Torus font loading is disabled

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
      <body className={`${poppins.variable} ${geistSans.variable} ${geistMono.variable} ${data70Font.variable} ${torusVariationsFont.variable} overflow-x-hidden`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-md focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
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
