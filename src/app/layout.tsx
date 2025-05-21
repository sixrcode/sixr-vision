
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import localFont from 'next/font/local';
import './globals.css';
// import './fonts.css'; // Manual import is primarily for @font-face rules not handled by next/font
import { Toaster } from '@/components/ui/toaster';
import { AppProviders } from '@/providers/AppProviders';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CONTROL_PANEL_WIDTH_STRING } from '@/lib/constants';

// Configure Torus Variations font using next/font/local
// IMPORTANT: This configuration expects the font file to be at src/app/fonts/TorusVariations-VF.woff2
// Please ensure you have created the 'fonts' directory inside 'src/app/'
// and placed your 'TorusVariations-VF.woff2' file there.
const torusVariations = localFont({
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${torusVariations.variable} font-sans antialiased`}>
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
